from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers.svg_analyzer import analyze_svg_content
from routers.raster_analyzer import analyze_raster_content
import uvicorn
import os

app = FastAPI(
    title="Housing Siteplan Analysis AI Engine",
    description="Microservice for Computer Vision and Vector Parsing on Siteplans",
    version="1.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    # SECURITY FIX: Restrict CORS to frontend URL only — was allow_origins=["*"]
    # Set FRONTEND_URL env var in production (e.g. https://your-domain.com)
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Siteplan AI Engine is running"}

@app.post("/api/v1/analyze-siteplan")
async def analyze_siteplan(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Check file extension
    ext = file.filename.split('.')[-1].lower()
    
    # Read file content
    content = await file.read()
    
    if ext == 'svg':
        try:
            # Jalankan logika SVG Analysis
            result = analyze_svg_content(content)
            
            # Hitung statistik untuk summary
            kavlings = result["kavlings"]
            total = len(kavlings)
            sudah_ada = sum(1 for k in kavlings if k["status"] == "sudah_ada_nomor")
            belum_ada = sum(1 for k in kavlings if k["status"] == "belum_ada_nomor")
            duplikat = sum(1 for k in kavlings if k["status"] == "nomor_duplikat")
            tidak_jelas = sum(1 for k in kavlings if k["status"] == "nomor_tidak_jelas")
            
            summary = {
                "total": total,
                "sudah_ada_nomor": sudah_ada,
                "belum_ada_nomor": belum_ada,
                "nomor_duplikat": duplikat,
                "nomor_tidak_jelas": tidak_jelas
            }
            
            return {
                "status": "success",
                "message": f"Successfully analyzed SVG: {file.filename}",
                "summary": summary,
                "data": kavlings,
                "meta": {
                    "original_width": result.get("meta", {}).get("original_width", 0),
                    "original_height": result.get("meta", {}).get("original_height", 0),
                    "source": "svg"
                },
                "annotated_svg": result["annotated_svg"]
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error analyzing SVG: {str(e)}")
    
    elif ext == 'pdf':
        # TODO: Implement PDF Parsing logic
        return {"status": "success", "message": f"Received PDF file: {file.filename}", "data": []}
        
    elif ext in ['png', 'jpg', 'jpeg']:
        try:
            # Jalankan logika Raster Analysis (OpenCV + OCR)
            result = analyze_raster_content(content)
            
            # Hitung statistik
            kavlings = result["kavlings"]
            total = len(kavlings)
            sudah_ada = sum(1 for k in kavlings if k["status"] == "sudah_ada_nomor")
            belum_ada = sum(1 for k in kavlings if k["status"] == "belum_ada_nomor")
            duplikat = sum(1 for k in kavlings if k["status"] == "nomor_duplikat")
            tidak_jelas = sum(1 for k in kavlings if k["status"] == "nomor_tidak_jelas")
            
            summary = {
                "total": total,
                "sudah_ada_nomor": sudah_ada,
                "belum_ada_nomor": belum_ada,
                "nomor_duplikat": duplikat,
                "nomor_tidak_jelas": tidak_jelas
            }
            
            return {
                "status": "success",
                "message": f"Successfully analyzed Raster Image: {file.filename}",
                "summary": summary,
                "data": kavlings,
                "annotated_png_base64": result["annotated_png_base64"]
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")
    
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
