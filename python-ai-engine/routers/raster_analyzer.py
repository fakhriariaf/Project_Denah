import cv2
import numpy as np
import re
import base64
import os
from typing import Dict, Any

# Lazy-loaded OCR reader — not loaded at module import time.
# This saves ~800MB RAM on startup when raster AI is disabled.
_reader = None

def get_reader():
    """Lazy-load EasyOCR reader on first use. Optionally release after request."""
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(['en', 'id'], gpu=False)
    return _reader

def release_reader():
    """Release OCR reader to free memory after request (if env var set)."""
    global _reader
    if os.getenv("AI_RELEASE_OCR_AFTER_REQUEST", "false").lower() == "true":
        _reader = None

def is_valid_kavling_number(text: str) -> bool:
    """Mengecek apakah hasil OCR sesuai format penamaan kavling"""
    ignore_words = ["jalan", "taman", "rth", "skala", "keterangan", "spesifikasi", "catatan", "gerbang", "utama", "pohon", "row", "m"]
    text_upper = text.upper()
    
    for word in ignore_words:
        if word in text_upper:
            return False
            
    # Mengabaikan ukuran dimensi seperti "7 x 12" atau "6 m"
    if re.search(r'\d+\s*[xX*]\s*\d+', text) or re.search(r'\d+\s*[mM]\b', text_upper):
        return False
        
    # Cocokkan regex standar nomor kavling
    if re.match(r'^(BLOK\s*)?[A-Z]{1,3}[-\s]?\d{1,4}$', text_upper):
        return True
    if re.match(r'^K[V]?[-\s]?\d{1,4}$', text_upper):
        return True
        
    return len(text_upper) >= 2 and len(text_upper) <= 6

def analyze_raster_content(image_bytes: bytes) -> Dict[str, Any]:
    """Menganalisis file citra (PNG/JPG) menggunakan OpenCV & EasyOCR"""
    
    # 1. Konversi bytes ke OpenCV Image (NumPy array)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    original_image = image.copy()
    
    if image is None:
        raise ValueError("Gagal membaca gambar.")
        
    height, width, _ = image.shape
    
    # 2. Preprocessing
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Perbaiki kontras (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    gray = clahe.apply(gray)
    
    # Adaptive thresholding
    thresh = cv2.adaptiveThreshold(
        gray, 255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 11, 3
    )
    
    # Morphological close untuk menyambungkan garis putus-putus
    # Iterasi 1 saja agar tidak merge kavling yang berdampingan
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)
    
    # 3. Deteksi kontur
    contours, hierarchy = cv2.findContours(morph, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    results = []
    missing_count = 0
    assigned_texts = set()
    
    for idx, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        
        # Filter 1: Area (Terlalu kecil atau terlalu besar diabaikan)
        if area < 1000 or area > (width * height * 0.2):
            continue
            
        peri = cv2.arcLength(cnt, True)
        # Approx lebih ketat (0.01) agar presisi sudut kavling terjaga
        approx = cv2.approxPolyDP(cnt, 0.01 * peri, True)
        
        # Kavling umumnya memiliki 4-8 sudut
        if 4 <= len(approx) <= 8:
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = float(w) / h
            
            # Filter: Bukan garis panjang jalanan (rasio < 0.15 atau > 7)
            if 0.15 < aspect_ratio < 7.0:
                # Tambahan: solidity check (area polygon / bounding box area)
                # Kavling biasanya memiliki solidity > 0.6 (tidak terlalu berlubang)
                hull = cv2.convexHull(approx)
                hull_area = cv2.contourArea(hull)
                solidity = area / hull_area if hull_area > 0 else 0
                if solidity < 0.5:
                    continue
                # Titik pusat
                cx = x + (w // 2)
                cy = y + (h // 2)
                
                # 4. OCR pada Bounding Box ini saja (Crop)
                # Beri sedikit padding agar huruf di tepi tidak terpotong
                pad = 2
                crop_y1 = max(0, y + pad)
                crop_y2 = min(height, y + h - pad)
                crop_x1 = max(0, x + pad)
                crop_x2 = min(width, x + w - pad)
                
                roi = gray[crop_y1:crop_y2, crop_x1:crop_x2]
                
                # Ekstrak teks
                ocr_results = get_reader().readtext(roi)
                
                assigned_label = None
                status = "belum_ada_nomor"
                confidence = 0.80 # Default untuk shape detection
                
                if len(ocr_results) > 0:
                    for bbox, text, conf in ocr_results:
                        clean_text = text.strip()
                        if is_valid_kavling_number(clean_text):
                            assigned_label = clean_text
                            status = "sudah_ada_nomor"
                            confidence = round(conf, 2)
                            assigned_texts.add(clean_text)
                            break
                            
                # Ekstrak titik polygon asli (bukan bounding box)
                polygon_points = [
                    {"x": float(pt[0][0]), "y": float(pt[0][1])}
                    for pt in approx
                ]

                # 5. Visual Marking & Result Appending
                if status == "sudah_ada_nomor":
                    gen_id = assigned_label
                    # Stroke tipis hijau untuk kavling beres
                    cv2.drawContours(original_image, [approx], -1, (0, 255, 0), 2)
                    
                    bounds = cv2.boundingRect(approx) # x, y, w, h
                    results.append({
                        "generated_id": gen_id,
                        "detected_label": assigned_label,
                        "status": status,
                        "x": bounds[0],
                        "y": bounds[1],
                        "width": bounds[2],
                        "height": bounds[3],
                        "center_x": cx,
                        "center_y": cy,
                        "area": area,
                        "confidence": confidence,
                        "polygon_points": polygon_points,
                        "source": "opencv_easyocr",
                        "notes": ""
                    })

    # 6. Encode image hasil modifikasi ke Base64 PNG
    _, buffer = cv2.imencode('.png', original_image)
    encoded_png = base64.b64encode(buffer).decode('utf-8')
    
    # Release OCR reader if configured (free memory after request)
    release_reader()
    
    return {
        "kavlings": results,
        "annotated_png_base64": encoded_png,
        "meta": {
            "original_width": width,
            "original_height": height
        }
    }
