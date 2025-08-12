#!/usr/bin/env python3
"""
FastAPI server for Marketing App backend processing endpoints
"""

import os
import sys
import asyncio
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl, Field
import uvicorn
import json

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ad_processing import ViralFrameExtractor, AudioExtractor, AdAnalyzer, VideoCompressor
from config.settings import settings

app = FastAPI(
    title="Marketing App Backend",
    description="Video processing endpoints for advertisement analysis",
    version="1.0.0",
)

# --- Standard error helper & handlers ---

def err(status:int, code:str, message:str):
    return HTTPException(status_code=status, detail={"code": code, "message": message})

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Ensure uniform shape
    detail = exc.detail
    if isinstance(detail, str):
        detail = {"code": "ERROR", "message": detail}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": {"code":"UNEXPECTED_ERROR","message": str(exc)}})

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class AnalyzeAdRequest(BaseModel):
    url: HttpUrl = Field(..., description="YouTube, Instagram, or TikTok video URL")
    content_description: Optional[str] = Field(None, description="Optional description of the video content")

class AnalyzeAdResponse(BaseModel):
    id: str
    url: str
    summary: str
    visualStyle: str
    audioStyle: str
    duration: float
    chunks: List[Dict]
    processing_info: Dict = Field(..., description="Processing metadata")

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str

class ProcessFileResponse(BaseModel):
    success: bool
    content: str
    filename: str
    file_size: int
    file_type: str
    page_count: Optional[int] = None
    error: Optional[str] = None

# Global processor instance
class VideoProcessor:
    def __init__(self):
        self.compressor = VideoCompressor()
        self.frame_extractor = ViralFrameExtractor()
        self.audio_extractor = AudioExtractor()
        self.analyzer = AdAnalyzer()
        # outputs directory
        self.outputs_dir = Path(__file__).parent / 'video_outputs'
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
    
    async def process_video_url(self, video_url: str, content_description: Optional[str] = None) -> Dict:
        """Process video from URL and return structured analysis"""
        print(f"🎬 Processing Video: {video_url}", flush=True)
        
        temp_video_path = None
        try:
            # Step 1: Download video to temp file
            print("📥 Downloading video...", flush=True)
            
            # Create temp file path
            temp_video_path = tempfile.mktemp(suffix='.mp4')
            
            # Download using yt-dlp
            import yt_dlp
            ydl_opts = {
                'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
                'outtmpl': temp_video_path,
                'no_warnings': True,
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
                },
            }
            
            # Only use Chrome cookies if explicitly enabled (to avoid Chrome popups)
            if os.getenv('USE_CHROME_COOKIES', 'false').lower() == 'true':
                try:
                    # Try different cookie extraction methods for encrypted Chrome cookies
                    # Method 1: Default profile with keychain access
                    ydl_opts['cookiesfrombrowser'] = ('chrome', None, None, None)
                    print("📥 Using Chrome cookies for download", flush=True)
                except Exception as cookie_err:
                    print(f"⚠️ Chrome cookies not available: {cookie_err}", flush=True)
                    try:
                        # Method 2: Try with explicit profile path
                        ydl_opts['cookiesfrombrowser'] = ('chrome', 'Default', None, None)
                        print("📥 Trying Chrome cookies with Default profile", flush=True)
                    except Exception as profile_err:
                        print(f"⚠️ Chrome Default profile cookies failed: {profile_err}", flush=True)
            else:
                print("📥 Skipping Chrome cookies (set USE_CHROME_COOKIES=true to enable)", flush=True)
            
            download_success = False
            
            # Try downloading with cookies first (if enabled)
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_url])
                download_success = True
                print("✅ Download successful with cookies", flush=True)
            except Exception as dl_err:
                print(f"⚠️ Download failed with cookies: {dl_err}", flush=True)
                
                # Fallback: Try without cookies if cookies were enabled
                if 'cookiesfrombrowser' in ydl_opts:
                    print("🔄 Retrying download without cookies...", flush=True)
                    fallback_opts = ydl_opts.copy()
                    del fallback_opts['cookiesfrombrowser']  # Remove cookies
                    
                    try:
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                            ydl.download([video_url])
                        download_success = True
                        print("✅ Download successful without cookies", flush=True)
                    except Exception as fallback_err:
                        print(f"❌ Download also failed without cookies: {fallback_err}", flush=True)
                
                if not download_success:
                    raise err(400, "UNSUPPORTED_URL", f"Unsupported or restricted URL: {video_url}")
            
            # Check if file was downloaded
            if not Path(temp_video_path).exists() or Path(temp_video_path).stat().st_size == 0:
                raise err(400, "DOWNLOAD_FAILED", "Video download failed - file not found or empty")
            
            file_size_mb = Path(temp_video_path).stat().st_size / (1024 * 1024)
            print(f"✅ Video downloaded successfully ({file_size_mb:.1f} MB)", flush=True)
            
            # Step 2: Extract frames
            print("🎞️ Extracting frames with scene detection...", flush=True)
            print(f"   Video path: {temp_video_path}", flush=True)
            print(f"   File size: {file_size_mb:.1f} MB", flush=True)
            
            print(f"🎬 MAIN: Calling frame_extractor.extract_frames()...", flush=True)
            frames = self.frame_extractor.extract_frames(temp_video_path)
            print(f"✅ MAIN: Extracted {len(frames)} frames from {len(set(f.scene_id for f in frames))} scenes", flush=True)
            
            # Step 3: Extract audio
            print("🎤 Extracting and transcribing audio...", flush=True)
            audio_extraction = self.audio_extractor.extract_audio(temp_video_path)
            if audio_extraction.error:
                print(f"⚠️ Audio extraction warning: {audio_extraction.error}", flush=True)
            print(f"✅ Audio transcribed: {len(audio_extraction.full_transcript)} characters", flush=True)
            
            # Step 4: Analyze with OpenAI
            print("🤖 Analyzing with OpenAI...", flush=True)
            print(f"   Sending {len(frames)} frames to GPT for analysis...", flush=True)
            print(f"   Audio transcript length: {len(audio_extraction.full_transcript)} characters", flush=True)
            
            try:
                print(f"🎯 MAIN: Calling analyzer.analyze_advertisement()...", flush=True)
                analysis_json = await self.analyzer.analyze_advertisement(
                    frames=frames,
                    audio_extraction=audio_extraction,
                    original_url=str(video_url),
                    content_description=content_description
                )
                print(f"✅ MAIN: Analysis complete: {len(analysis_json.get('chunks', []))} chunks identified", flush=True)
            except Exception as analysis_error:
                print(f"❌ OpenAI analysis failed: {analysis_error}", flush=True)
                # Convert analysis failures to specific error codes
                error_msg = str(analysis_error).lower()
                if "json parsing" in error_msg or "parsing failed" in error_msg:
                    raise err(422, "ANALYSIS_PARSING_FAILED", f"AI response could not be parsed: {str(analysis_error)}")
                elif "image" in error_msg or "unsupported" in error_msg:
                    raise err(422, "FRAME_ENCODING_ERROR", f"Frame encoding issue: {str(analysis_error)}")
                elif "rate limit" in error_msg or "quota" in error_msg:
                    raise err(429, "RATE_LIMITED", "OpenAI rate limit exceeded. Please try again later.")
                elif "timeout" in error_msg:
                    raise err(408, "ANALYSIS_TIMEOUT", "Analysis timed out. Video may be too complex.")
                else:
                    raise err(500, "ANALYSIS_FAILED", f"Video analysis failed: {str(analysis_error)}")
            
            # Add processing metadata
            analysis_json['processing_info'] = {
                'processed_at': datetime.now().isoformat(),
                'file_size_mb': round(file_size_mb, 2),
                'frames_extracted': len(frames),
                'scenes_detected': len(set(f.scene_id for f in frames)),
                'audio_segments': len(audio_extraction.transcript_segments),
                'transcript_length': len(audio_extraction.full_transcript)
            }
            
            # Persist JSON to disk
            try:
                slug = (
                    video_url.replace('https://','').replace('http://','')
                    .replace('/','_').replace('?','_').replace('&','_')
                )[:80]
                fname = f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{slug}.json"
                out_path = self.outputs_dir / fname
                with open(out_path, 'w') as f:
                    json.dump(analysis_json, f, indent=2)
                analysis_json['processing_info']['saved_json'] = str(out_path)
                print(f"💾 Saved analysis JSON: {out_path}", flush=True)
            except Exception as save_err:
                print(f"⚠️ Failed to save analysis JSON: {save_err}")
            
            return analysis_json
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error during processing: {e}")
            import traceback
            traceback.print_exc()
            raise err(500, "PROCESSING_FAILED", f"Video processing failed: {str(e)}")
        
        finally:
            # Cleanup temp file
            try:
                if temp_video_path and Path(temp_video_path).exists():
                    Path(temp_video_path).unlink(missing_ok=True)
            except:
                pass

# Initialize global processor
processor = VideoProcessor()

@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Detailed health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )

@app.post("/analyze-ad", response_model=AnalyzeAdResponse)
async def analyze_ad(request: AnalyzeAdRequest):
    """
    Analyze advertisement from video URL
    
    Supports YouTube, Instagram, and TikTok URLs.
    Returns structured JSON analysis with visual and audio breakdowns.
    """
    try:
        # Process the video
        analysis = await processor.process_video_url(
            str(request.url),
            request.content_description
        )
        
        return AnalyzeAdResponse(**analysis)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise err(500, "UNEXPECTED_ERROR", str(e))

@app.post("/process-file", response_model=ProcessFileResponse)
async def process_file(file: UploadFile = File(...)):
    """
    Process uploaded file and extract text content
    
    Supports PDF, TXT, CSV, JSON, and Markdown files.
    Returns extracted text content for use in AI processing.
    """
    try:
        print(f"📄 Processing file: {file.filename} ({file.content_type})")
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Process based on file type
        if file.content_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
            return await process_pdf_file(file.filename, file_content, file_size)
        elif file.content_type.startswith('text/') or file.filename.lower().endswith(('.txt', '.csv', '.json', '.md', '.markdown')):
            return process_text_file(file.filename, file_content, file_size, file.content_type)
        else:
            raise err(400, "UNSUPPORTED_FILE_TYPE", f"File type {file.content_type} is not supported")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ File processing error: {e}")
        import traceback
        traceback.print_exc()
        raise err(500, "FILE_PROCESSING_FAILED", f"File processing failed: {str(e)}")

@app.post("/process-pdf-raw")
async def process_pdf_raw(request: Request):
    """
    Process PDF sent as raw bytes in request body
    """
    try:
        # Get filename and content type from headers
        filename = request.headers.get('x-filename', 'document.pdf')
        content_type = request.headers.get('content-type', 'application/pdf')
        
        # Read raw bytes from request body
        pdf_content = await request.body()
        file_size = len(pdf_content)
        
        print(f"📄 Processing raw PDF: {filename} ({file_size} bytes)")
        print(f"📄 Content type: {type(pdf_content)}")
        print(f"📄 Content length: {len(pdf_content)}")
        print(f"📄 First 50 bytes: {pdf_content[:50]}")
        
        return await process_pdf_file(filename, pdf_content, file_size)
        
    except Exception as e:
        print(f"❌ Raw PDF processing error: {e}")
        import traceback
        traceback.print_exc()
        raise err(500, "RAW_PDF_PROCESSING_FAILED", f"Raw PDF processing failed: {str(e)}")

async def process_pdf_file(filename: str, content: bytes, file_size: int) -> ProcessFileResponse:
    """Process PDF file and extract text content"""
    try:
        import PyPDF2
        from io import BytesIO
        
        print(f"📄 Processing PDF: {filename} ({file_size} bytes)")
        print(f"📄 Content type: {type(content)}")
        print(f"📄 Content length: {len(content)}")
        print(f"📄 First 50 bytes: {content[:50]}")
        
        # Create PDF reader from bytes
        pdf_stream = BytesIO(content)
        pdf_reader = PyPDF2.PdfReader(pdf_stream)
        
        # Extract text from all pages
        full_text = ""
        page_count = len(pdf_reader.pages)
        
        for i, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                if page_text.strip():
                    full_text += f"--- Page {i + 1} ---\\n{page_text.strip()}\\n\\n"
            except Exception as page_error:
                print(f"⚠️ Failed to process page {i + 1}: {page_error}")
                full_text += f"--- Page {i + 1} ---\\n[Page processing failed]\\n\\n"
        
        print(f"✅ PDF processed: {page_count} pages, {len(full_text)} characters extracted")
        
        if not full_text.strip():
            return ProcessFileResponse(
                success=False,
                content=f"[PDF: {filename} - {file_size/1024:.1f}KB - No text content found]",
                filename=filename,
                file_size=file_size,
                file_type="application/pdf",
                page_count=page_count,
                error="No extractable text found in PDF"
            )
        
        return ProcessFileResponse(
            success=True,
            content=full_text.strip(),
            filename=filename,
            file_size=file_size,
            file_type="application/pdf",
            page_count=page_count
        )
        
    except Exception as e:
        print(f"❌ PDF processing failed: {e}")
        return ProcessFileResponse(
            success=False,
            content=f"[PDF: {filename} - {file_size/1024:.1f}KB - Processing failed: {str(e)}]",
            filename=filename,
            file_size=file_size,
            file_type="application/pdf",
            error=f"PDF processing failed: {str(e)}"
        )

def process_text_file(filename: str, content: bytes, file_size: int, content_type: str) -> ProcessFileResponse:
    """Process text-based files"""
    try:
        # Decode text content
        text_content = content.decode('utf-8')
        
        # Format based on file type
        if filename.lower().endswith('.csv'):
            formatted_content = f"CSV Data:\\n{text_content.strip()}"
        elif filename.lower().endswith('.json'):
            try:
                # Validate and pretty-print JSON
                parsed_json = json.loads(text_content)
                formatted_content = f"JSON Data:\\n{json.dumps(parsed_json, indent=2)}"
            except json.JSONDecodeError:
                formatted_content = f"JSON Data (raw):\\n{text_content.strip()}"
        else:
            formatted_content = text_content.strip()
        
        print(f"✅ Text file processed: {len(formatted_content)} characters")
        
        return ProcessFileResponse(
            success=True,
            content=formatted_content,
            filename=filename,
            file_size=file_size,
            file_type=content_type
        )
        
    except UnicodeDecodeError as e:
        return ProcessFileResponse(
            success=False,
            content=f"[File: {filename} - {file_size/1024:.1f}KB - Text encoding error]",
            filename=filename,
            file_size=file_size,
            file_type=content_type,
            error=f"Text encoding error: {str(e)}"
        )

@app.get("/supported-platforms")
async def supported_platforms():
    """Get list of supported video platforms"""
    return {
        "platforms": [
            {
                "name": "YouTube",
                "domains": ["youtube.com", "youtu.be"],
                "formats": ["Short videos", "Regular videos"]
            },
            {
                "name": "Instagram",
                "domains": ["instagram.com"],
                "formats": ["Reels"]
            },
            {
                "name": "TikTok",
                "domains": ["tiktok.com"],
                "formats": ["Videos"]
            }
        ],
        "limitations": {
            "max_duration": f"{settings.MAX_VIDEO_DURATION} seconds",
            "max_file_size": f"{settings.MAX_VIDEO_SIZE_MB} MB"
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )