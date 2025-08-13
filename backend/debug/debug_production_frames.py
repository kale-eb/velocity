#!/usr/bin/env python3
"""
Debug production frame processing by testing different approaches
"""
import asyncio
import openai
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from ad_processing.frame_extractor import ViralFrameExtractor
from config.settings import settings

async def debug_production_frames():
    """Debug different frame processing approaches"""
    
    # Find temp video
    video_files = list(Path("/var/folders").glob("**/tmp*.mp4"))
    if not video_files:
        print("❌ No temp video found")
        return
    
    video_path = str(max(video_files, key=lambda p: p.stat().st_mtime))
    print(f"🎬 Using video: {Path(video_path).name}")
    
    # Extract frames using production method
    extractor = ViralFrameExtractor()
    frames = extractor.extract_frames(video_path)
    
    print(f"📊 Extracted {len(frames)} frames using production method")
    
    # Test just the first 3 frames with OpenAI
    test_frames = frames[:3]
    
    for i, frame in enumerate(test_frames):
        print(f"\n🔍 Testing frame {i+1}:")
        print(f"  Original shape: {frame.image.shape}")
        print(f"  Frame type: {frame.frame_type}")
        print(f"  Timestamp: {frame.timestamp:.2f}s")
        
        # Test different compression approaches
        approaches = [
            ("Production settings", lambda f: f.to_base64()),
            ("Force 512px/70%", lambda f: f.to_base64(max_size=512, quality=70)),  
            ("Smaller 256px", lambda f: f.to_base64(max_size=256, quality=70)),
            ("Higher quality", lambda f: f.to_base64(max_size=512, quality=90)),
        ]
        
        for name, method in approaches:
            try:
                base64_data = method(frame)
                print(f"  ✅ {name}: {len(base64_data)} chars")
                
                # Test individual frame with OpenAI
                try:
                    client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                    
                    response = await client.chat.completions.create(
                        model="gpt-4.1",
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Describe this frame briefly. Test: {name}"
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": base64_data}
                                    }
                                ]
                            }
                        ],
                        max_tokens=100
                    )
                    
                    print(f"    ✅ OpenAI accepted: {len(response.choices[0].message.content)} chars response")
                    
                except Exception as api_error:
                    print(f"    ❌ OpenAI rejected: {api_error}")
                    
            except Exception as e:
                print(f"  ❌ {name}: {e}")
        
        # Only test first frame to avoid rate limits
        break

if __name__ == "__main__":
    asyncio.run(debug_production_frames())