#!/usr/bin/env python3
"""
Compare frame data between test script and production pipeline
"""
import cv2
import numpy as np
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from ad_processing.frame_extractor import FrameData, ViralFrameExtractor
from config.settings import settings

def compare_frame_sources():
    """Compare frames from different sources"""
    print("🔍 Comparing frame data sources...")
    
    # Method 1: Load from saved JPEG (like test script)
    saved_frame_path = "video_outputs/www.instagram.compDNBhZWxyjQS/frames/frame_000_0.00s_sceneNone_JUMPCUT.jpg"
    if Path(saved_frame_path).exists():
        print("\n📁 Method 1: Loading from saved JPEG file")
        cv_image_saved = cv2.imread(saved_frame_path)
        
        frame_from_saved = FrameData(
            image=cv_image_saved,
            timestamp=0.0,
            frame_type='jump_cut'
        )
        
        print(f"  Image shape: {cv_image_saved.shape}")
        print(f"  Image dtype: {cv_image_saved.dtype}")
        print(f"  Image min/max: {cv_image_saved.min()}/{cv_image_saved.max()}")
        print(f"  Image color format: BGR (from cv2.imread)")
        
        # Test encoding
        try:
            base64_saved = frame_from_saved.to_base64()
            print(f"  ✅ Base64 encoding: {len(base64_saved)} chars")
        except Exception as e:
            print(f"  ❌ Base64 encoding failed: {e}")
    
    # Method 2: Extract fresh frame from video (like production)
    print("\n🎬 Method 2: Fresh extraction from video")
    
    # Use the downloaded video file
    video_files = list(Path("/var/folders").glob("**/tmp*.mp4"))
    video_path = None
    
    # Find most recent temp video file or use a test video
    if video_files:
        video_path = str(max(video_files, key=lambda p: p.stat().st_mtime))
        print(f"  Using temp video: {Path(video_path).name}")
    else:
        print("  No temp video found, downloading fresh...")
        # We could download fresh here, but let's try with existing frames first
    
    if video_path and Path(video_path).exists():
        try:
            extractor = ViralFrameExtractor()
            fresh_frame = extractor.extract_single_frame(video_path, 0.0)
            
            if fresh_frame:
                print(f"  Image shape: {fresh_frame.image.shape}")
                print(f"  Image dtype: {fresh_frame.image.dtype}")
                print(f"  Image min/max: {fresh_frame.image.min()}/{fresh_frame.image.max()}")
                print(f"  Image color format: BGR (from ffmpeg->cv2)")
                
                # Test encoding
                try:
                    base64_fresh = fresh_frame.to_base64()
                    print(f"  ✅ Base64 encoding: {len(base64_fresh)} chars")
                    
                    # Compare the two base64 strings
                    if 'base64_saved' in locals():
                        print(f"\n🔄 Comparison:")
                        print(f"  Saved frame base64 length: {len(base64_saved)}")
                        print(f"  Fresh frame base64 length: {len(base64_fresh)}")
                        print(f"  Are they identical? {base64_saved == base64_fresh}")
                        
                        if base64_saved != base64_fresh:
                            print(f"  First difference at char: {next((i for i in range(min(len(base64_saved), len(base64_fresh))) if base64_saved[i] != base64_fresh[i]), 'No difference in common length')}")
                    
                except Exception as e:
                    print(f"  ❌ Base64 encoding failed: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print("  ❌ Failed to extract fresh frame")
                
        except Exception as e:
            print(f"  ❌ Fresh extraction failed: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("  ❌ No video file available")
    
    # Method 3: Check the actual frames used in production
    print("\n🏭 Method 3: Check production frame processing")
    
    # Look at the most recent processing output
    latest_dir = Path("video_outputs/www.instagram.compDNBhZWxyjQS")
    if latest_dir.exists():
        frame_files = list((latest_dir / "frames").glob("*.jpg"))
        if frame_files:
            # Check first few frames for any patterns
            print(f"  Found {len(frame_files)} frames in latest output")
            
            for i, frame_file in enumerate(frame_files[:3]):
                print(f"\n  Checking frame {i+1}: {frame_file.name}")
                
                # Load and check properties
                img = cv2.imread(str(frame_file))
                if img is not None:
                    print(f"    Shape: {img.shape}")
                    print(f"    Size on disk: {frame_file.stat().st_size} bytes")
                    
                    # Create FrameData and test encoding
                    frame_data = FrameData(image=img, timestamp=float(i), frame_type='jump_cut')
                    try:
                        b64 = frame_data.to_base64()
                        print(f"    ✅ Encodes to {len(b64)} chars")
                    except Exception as e:
                        print(f"    ❌ Encoding failed: {e}")
                else:
                    print(f"    ❌ Could not load image")

if __name__ == "__main__":
    compare_frame_sources()