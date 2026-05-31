import re
import uuid
from typing import List, Dict, Any
from lxml import etree
from shapely.geometry import Polygon, Point
from shapely.errors import TopologicalError

# Namespace SVG standard
SVG_NS = "http://www.w3.org/2000/svg"
nsmap = {'svg': SVG_NS}

def parse_points(points_str: str) -> List[tuple]:
    """Parse string points 'x,y x,y' menjadi list of tuples (x,y)"""
    try:
        points = []
        raw_pairs = points_str.strip().split()
        for pair in raw_pairs:
            x, y = map(float, pair.split(','))
            points.append((x, y))
        return points
    except Exception:
        return []

def extract_svg_elements(svg_root: etree._Element):
    """Mengekstrak poligon kavling dan teks dari SVG"""
    polygons_data = []
    texts_data = []

    # Ambil semua elemen polygon dan polyline
    for tag in ['.//svg:polygon', './/svg:polyline']:
        for idx, poly in enumerate(svg_root.xpath(tag, namespaces=nsmap)):
            pts_str = poly.get('points')
            if not pts_str:
                continue
                
            pts = parse_points(pts_str)
            if len(pts) < 3:
                continue
                
            try:
                shapely_poly = Polygon(pts)
                if not shapely_poly.is_valid:
                    shapely_poly = shapely_poly.buffer(0)
                    
                if 100 < shapely_poly.area < 500000:
                    polygons_data.append({
                        "element": poly,
                        "geometry": shapely_poly,
                        "id": poly.get('id') or f"generated_polygon_{len(polygons_data)}"
                    })
            except Exception:
                continue

    # Ambil elemen rect
    for idx, rect in enumerate(svg_root.xpath('.//svg:rect', namespaces=nsmap)):
        try:
            x = float(rect.get('x', 0))
            y = float(rect.get('y', 0))
            w = float(rect.get('width', 0))
            h = float(rect.get('height', 0))
            if w <= 0 or h <= 0:
                continue
                
            pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
            shapely_poly = Polygon(pts)
            if 100 < shapely_poly.area < 500000:
                polygons_data.append({
                    "element": rect,
                    "geometry": shapely_poly,
                    "id": rect.get('id') or f"generated_rect_{len(polygons_data)}"
                })
        except Exception:
            continue

    # Ambil semua elemen text
    for text_elem in svg_root.xpath('.//svg:text', namespaces=nsmap):
        try:
            # Try to get x/y from text or its first tspan
            x_str = text_elem.get('x')
            y_str = text_elem.get('y')
            if x_str is None or y_str is None:
                tspan = text_elem.find('.//svg:tspan', namespaces=nsmap)
                if tspan is not None:
                    x_str = tspan.get('x', x_str)
                    y_str = tspan.get('y', y_str)
            
            x = float(x_str) if x_str else 0
            y = float(y_str) if y_str else 0
            
            # Text content
            text_str = "".join(text_elem.itertext()).strip()
            if not text_str:
                continue
                
            texts_data.append({
                "element": text_elem,
                "text": text_str,
                "point": Point(x, y)
            })
        except ValueError:
            continue

    return polygons_data, texts_data

def is_valid_kavling_number(text: str) -> bool:
    """Mengecek apakah teks sesuai dengan format penamaan kavling (bukan ukuran luas/jalan)"""
    # Mengabaikan teks keterangan umum
    ignore_words = ["jalan", "taman", "rth", "skala", "keterangan", "spesifikasi", "catatan", "gerbang", "utama", "pohon", "row"]
    text_upper = text.upper()
    for word in ignore_words:
        if word in text_upper:
            return False
            
    # Mengabaikan ukuran dimensi seperti "7 x 12" atau "6 m"
    if re.search(r'\d+\s*[xX*]\s*\d+', text) or re.search(r'\d+\s*[mM]\b', text_upper):
        return False
        
    # Cocokkan regex standar nomor kavling
    # ^[A-Z]{1,3}[- ]?\d{1,4}$
    if re.match(r'^(BLOK\s*)?[A-Z]{1,3}[-\s]?\d{1,4}$', text_upper):
        return True
    if re.match(r'^K[V]?[-\s]?\d{1,4}$', text_upper):
        return True
        
    return True  # Fallback

def analyze_svg_content(svg_content: bytes) -> Dict[str, Any]:
    """Menganalisis konten SVG dan mengembalikan data kavling beserta SVG yang dianotasi"""
    
    # Parse XML
    parser = etree.XMLParser(remove_blank_text=True)
    root = etree.fromstring(svg_content, parser)
    
    # Ekstrak dimensi viewBox SVG (penting untuk koordinat mapping)
    svg_w: float = 0.0
    svg_h: float = 0.0
    viewbox_str = root.get('viewBox', '')
    if viewbox_str:
        parts = viewbox_str.strip().replace(',', ' ').split()
        if len(parts) >= 4:
            svg_w = float(parts[2])
            svg_h = float(parts[3])
    if not svg_w:
        raw_w = root.get('width', '0')
        raw_h = root.get('height', '0')
        svg_w = float(''.join(c for c in raw_w if c.isdigit() or c == '.') or '0')
        svg_h = float(''.join(c for c in raw_h if c.isdigit() or c == '.') or '0')
    
    polygons, texts = extract_svg_elements(root)
    
    results = []
    missing_count = 0
    assigned_texts = set()

    # Logika Point-in-Polygon: Pasangkan teks ke dalam poligon
    for p_idx, p_data in enumerate(polygons):
        poly_geom = p_data["geometry"]
        centroid = poly_geom.centroid
        
        assigned_label = None
        status = "belum_ada_nomor"
        confidence = 0.90 # Tinggi karena ini vektor native
        
        # Cari teks yang ada di dalam poligon ini
        for t_data in texts:
            if t_data["text"] in assigned_texts:
                continue
                
            # Jika titik teks ada di dalam batas poligon kavling
            if poly_geom.contains(t_data["point"]):
                if is_valid_kavling_number(t_data["text"]):
                    assigned_label = t_data["text"]
                    status = "sudah_ada_nomor"
                    assigned_texts.add(assigned_label)
                    break
        
        # Jika teks tidak persis di dalam, cek yang jaraknya sangat dekat (toleransi offset)
        if not assigned_label:
            for t_data in texts:
                if t_data["text"] in assigned_texts:
                    continue
                # Jarak batas luar poligon ke titik teks
                if poly_geom.distance(t_data["point"]) < 10.0:
                    if is_valid_kavling_number(t_data["text"]):
                        assigned_label = t_data["text"]
                        status = "sudah_ada_nomor"
                        confidence = 0.75 # Turun karena menggunakan toleransi jarak
                        assigned_texts.add(assigned_label)
                        break

        if status == "sudah_ada_nomor":
            gen_id = assigned_label 
            
            elem = p_data["element"]
            if not elem.get("stroke"):
                elem.set("stroke", "#22C55E")
                elem.set("stroke-width", "1")

            bounds = poly_geom.bounds # (minx, miny, maxx, maxy)
            
            # Ekstrak titik polygon asli dari geometry Shapely
            coords_list = list(poly_geom.exterior.coords)[:-1]  # Hapus titik penutup duplikat
            polygon_points = [{"x": round(x, 2), "y": round(y, 2)} for x, y in coords_list]
            
            results.append({
                "generated_id": gen_id,
                "detected_label": assigned_label,
                "status": status,
                "x": round(bounds[0], 2),
                "y": round(bounds[1], 2),
                "width": round(bounds[2] - bounds[0], 2),
                "height": round(bounds[3] - bounds[1], 2),
                "center_x": round(centroid.x, 2),
                "center_y": round(centroid.y, 2),
                "area": round(poly_geom.area, 2),
                "confidence": confidence,
                "polygon_points": polygon_points,
                "source": "svg_text",
                "notes": ""
            })

    # Output SVG yang telah dianotasi (dimodifikasi) ke bentuk bytes
    annotated_svg_bytes = etree.tostring(root, encoding="utf-8", xml_declaration=True)
    
    return {
        "kavlings": results,
        "annotated_svg": annotated_svg_bytes.decode("utf-8"),
        "meta": {
            "original_width": svg_w,
            "original_height": svg_h,
        }
    }
