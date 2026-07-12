from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from routers.svg_analyzer import analyze_svg_content
import uvicorn
import os
import secrets

# Low-memory mode: only import raster analyzer if enabled
ENABLE_RASTER_AI = os.getenv("ENABLE_RASTER_AI", "false").lower() == "true"

app = FastAPI(
    title="Housing Siteplan Analysis AI Engine",
    description="Microservice for Computer Vision and Vector Parsing on Siteplans",
    version="1.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_api_key(x_api_key: str | None = Header(default=None)):
    """Validate X-API-Key header against AI_ENGINE_API_KEY env var."""
    expected = os.getenv("AI_ENGINE_API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="AI engine API key is not configured")
    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@app.get("/")
def read_root():
    raster_status = "enabled" if ENABLE_RASTER_AI else "disabled (low-memory mode)"
    return {
        "status": "online",
        "message": "Siteplan AI Engine is running",
        "raster_ai": raster_status
    }

@app.post("/api/v1/analyze-siteplan", dependencies=[Depends(verify_api_key)])
async def analyze_siteplan(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    ext = file.filename.split('.')[-1].lower()
    content = await file.read()
    
    if ext == 'svg':
        try:
            result = analyze_svg_content(content)
            
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
        return {"status": "success", "message": f"Received PDF file: {file.filename}", "data": []}
        
    elif ext in ['png', 'jpg', 'jpeg']:
        # Low-memory mode: reject raster analysis when disabled
        if not ENABLE_RASTER_AI:
            raise HTTPException(
                status_code=503,
                detail="Raster image analysis is disabled (low-memory mode). Only SVG files are supported. Upload an SVG siteplan or contact admin to enable raster AI."
            )
        
        try:
            # Lazy import — only load heavy modules when actually needed
            from routers.raster_analyzer import analyze_raster_content
            
            result = analyze_raster_content(content)
            
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
