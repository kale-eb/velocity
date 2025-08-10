#!/usr/bin/env python3
"""
Complete video processing pipeline test script.
Downloads, processes, and analyzes any YouTube/Instagram/TikTok video.

Usage: python process_video.py <video_url>
Example: python process_video.py "https://www.instagram.com/reels/DNBhZWxyjQS/"
"""

import asyncio
import sys
import json
import tempfile
import shutil
import time
from datetime import datetime
from pathlib import Path
from PIL import Image

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ad_processing import ViralFrameExtractor, AudioExtractor, AdAnalyzer, VideoCompressor

class VideoProcessor:
    def __init__(self, output_base_dir="./video_outputs"):
        self.output_base_dir = Path(output_base_dir)
        self.compressor = VideoCompressor()
        self.frame_extractor = ViralFrameExtractor()
        self.audio_extractor = AudioExtractor()
        self.analyzer = AdAnalyzer()
        
    def create_output_folder(self, video_url: str) -> Path:
        """Create output folder for this video (overwrites if exists)"""
        # Create safe folder name from URL without timestamp
        safe_name = video_url.replace("https://", "").replace("http://", "")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-")[:50]
        
        output_folder = self.output_base_dir / safe_name
        
        # Remove existing folder if it exists
        if output_folder.exists():
            import shutil
            shutil.rmtree(output_folder)
            print(f"🗑️ Removed existing output folder: {output_folder}")
        
        output_folder.mkdir(parents=True, exist_ok=True)
        return output_folder
        
    def save_frames(self, frames, output_folder: Path):
        """Save extracted frames as images"""
        frames_folder = output_folder / "frames"
        frames_folder.mkdir(exist_ok=True)
        
        print(f"💾 Saving {len(frames)} frames...")
        
        for i, frame in enumerate(frames):
            # Create descriptive filename with frame type clearly indicated
            frame_type_label = {
                'jump_cut': 'JUMPCUT',
                'scene_interval': 'FILL',
                'interval': 'FILL',
                'candidate': 'CANDIDATE'
            }.get(frame.frame_type, frame.frame_type.upper())
            
            filename = f"frame_{i:03d}_{frame.timestamp:.2f}s_scene{frame.scene_id}_{frame_type_label}.jpg"
            filepath = frames_folder / filename
            
            # Convert and save
            pil_img = frame.to_pil()
            # Resize for storage efficiency
            if max(pil_img.size) > 1024:
                pil_img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            pil_img.save(filepath, 'JPEG', quality=90)
            
        print(f"✅ Frames saved to: {frames_folder}")
        return frames_folder
        
    def save_transcript(self, audio_extraction, output_folder: Path):
        """Save raw transcript data"""
        transcript_file = output_folder / "transcript.json"
        
        transcript_data = {
            "duration": audio_extraction.duration,
            "full_transcript": audio_extraction.full_transcript,
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end, 
                    "text": seg.text,
                    "confidence": seg.confidence
                }
                for seg in audio_extraction.transcript_segments
            ],
            "error": audio_extraction.error
        }
        
        with open(transcript_file, 'w') as f:
            json.dump(transcript_data, f, indent=2)
            
        print(f"✅ Transcript saved to: {transcript_file}")
        return transcript_file
        
    def save_analysis(self, analysis_json, output_folder: Path):
        """Save final OpenAI analysis"""
        analysis_file = output_folder / "analysis.json"
        
        with open(analysis_file, 'w') as f:
            json.dump(analysis_json, f, indent=2)
            
        print(f"✅ Analysis saved to: {analysis_file}")
        return analysis_file
        
    def save_summary(self, video_url: str, frames, audio_extraction, analysis_json, output_folder: Path):
        """Save processing summary"""
        summary_file = output_folder / "summary.md"
        
        # Group frames by scenes for summary and count frame types
        scenes = {}
        frame_type_counts = {}
        
        for frame in frames:
            # Group by scene
            scene_id = frame.scene_id or 1
            if scene_id not in scenes:
                scenes[scene_id] = []
            scenes[scene_id].append(frame)
            
            # Count frame types
            frame_type = frame.frame_type
            frame_type_counts[frame_type] = frame_type_counts.get(frame_type, 0) + 1
        
        summary = f"""# Video Processing Summary

**URL:** {video_url}
**Processed:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Video Analysis
- **Duration:** {audio_extraction.duration:.1f} seconds
- **Total Frames Extracted:** {len(frames)}
- **Scenes Detected:** {len(scenes)}
- **Jump Cut Threshold:** {self.frame_extractor.jump_cut_threshold}

## Frame Type Breakdown
- **Jump Cut Frames:** {frame_type_counts.get('jump_cut', 0)} (scenes detected through jump cuts)
- **Fill/Interval Frames:** {frame_type_counts.get('scene_interval', 0) + frame_type_counts.get('interval', 0)} (gap-filling frames within scenes)
- **Other Frames:** {sum(count for frame_type, count in frame_type_counts.items() if frame_type not in ['jump_cut', 'scene_interval', 'interval'])}

## Scene Breakdown
"""
        
        for scene_id in sorted(scenes.keys()):
            scene_frames = scenes[scene_id]
            start_time = min(f.timestamp for f in scene_frames)
            end_time = max(f.timestamp for f in scene_frames)
            
            # Count frame types in this scene
            scene_jump_cuts = sum(1 for f in scene_frames if f.frame_type == 'jump_cut')
            scene_fills = sum(1 for f in scene_frames if f.frame_type in ['scene_interval', 'interval'])
            
            summary += f"""
### Scene {scene_id}
- **Time Range:** {start_time:.1f}s - {end_time:.1f}s ({end_time - start_time:.1f}s duration)
- **Total Frames:** {len(scene_frames)} ({scene_jump_cuts} jump cuts, {scene_fills} fills)
- **Frame Details:**
"""
            
            # List each frame with clear type indication
            for frame in scene_frames:
                frame_type_desc = {
                    'jump_cut': '🎬 JUMP CUT',
                    'scene_interval': '⏱️ FILL',
                    'interval': '⏱️ FILL',
                    'candidate': '📋 CANDIDATE'
                }.get(frame.frame_type, f'❓ {frame.frame_type.upper()}')
                
                summary += f"  - {frame.timestamp:.1f}s: {frame_type_desc}\n"
        
        summary += f"""
## Audio Processing
- **Transcript Segments:** {len(audio_extraction.transcript_segments)}
- **Full Transcript:** "{audio_extraction.full_transcript[:200]}{'...' if len(audio_extraction.full_transcript) > 200 else ''}"
- **Audio Error:** {audio_extraction.error or 'None'}

## OpenAI Analysis
- **Model Used:** {self.analyzer.model}
- **Analysis ID:** {analysis_json.get('id', 'N/A')}
- **Chunks Generated:** {len(analysis_json.get('chunks', []))}
- **Summary:** {analysis_json.get('summary', 'N/A')}

## Output Files
- `frames/` - Extracted jump cut frames as JPEG images
- `transcript.json` - Raw audio transcript with timestamps
- `analysis.json` - Complete OpenAI analysis in structured format
- `summary.md` - This summary file
"""
        
        with open(summary_file, 'w') as f:
            f.write(summary)
            
        print(f"✅ Summary saved to: {summary_file}")
        return summary_file

    async def process_video(self, video_url: str):
        """Complete video processing pipeline with timing"""
        print(f"🎬 Processing Video: {video_url}")
        print("=" * 80)
        
        # Create output folder
        output_folder = self.create_output_folder(video_url)
        print(f"📁 Output folder: {output_folder}")
        print()
        
        # Track timing for each stage
        timing_data = {}
        total_start_time = time.time()
        
        temp_video_path = None
        try:
            # Step 1: Download video to temp file
            print("📥 Step 1: Downloading video...")
            download_start = time.time()
            
            # Create temp file path
            temp_video_path = tempfile.mktemp(suffix='.mp4')
            
            # Download using yt-dlp (same as VideoCompressor but save to file)
            import yt_dlp
            ydl_opts = {
                'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
                'outtmpl': temp_video_path,
                'no_warnings': False,  # Show warnings for debugging
                # Instagram-specific options
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
                },
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
            
            # Check if file was downloaded
            if not Path(temp_video_path).exists() or Path(temp_video_path).stat().st_size == 0:
                raise Exception(f"Video download failed - file not found or empty")
            
            download_time = time.time() - download_start
            timing_data['download'] = download_time
            
            file_size_mb = Path(temp_video_path).stat().st_size / (1024 * 1024)
            print(f"✅ Video downloaded successfully ({file_size_mb:.1f} MB) - {download_time:.2f}s")
            print()
            
            # Step 2 & 3: Extract frames and audio in parallel
            print("🔄 Step 2&3: Extracting frames and audio in parallel...")
            parallel_start = time.time()
            
            # Define async wrapper functions for parallel execution
            async def extract_frames_async():
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, self.frame_extractor.extract_frames, temp_video_path)
            
            async def extract_audio_async():
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, self.audio_extractor.extract_audio, temp_video_path)
            
            # Run both extractions in parallel
            frame_task = asyncio.create_task(extract_frames_async())
            audio_task = asyncio.create_task(extract_audio_async())
            
            # Wait for both to complete
            frames, audio_extraction = await asyncio.gather(frame_task, audio_task)
            
            parallel_time = time.time() - parallel_start
            timing_data['parallel_extraction'] = parallel_time
            
            if audio_extraction.error:
                print(f"⚠️ Audio extraction warning: {audio_extraction.error}")
            
            print(f"✅ Parallel extraction complete:")
            print(f"   🎞️ Frames: {len(frames)} from {len(set(f.scene_id for f in frames))} scenes")
            print(f"   🎤 Audio: {len(audio_extraction.full_transcript)} characters")
            print(f"   ⏱️ Total parallel time: {parallel_time:.2f}s")
            print()
            
            # Step 4: Analyze with OpenAI
            print("🤖 Step 4: Analyzing with OpenAI...")
            openai_start = time.time()
            analysis_json = await self.analyzer.analyze_advertisement(
                frames=frames,
                audio_extraction=audio_extraction,
                original_url=video_url
            )
            openai_time = time.time() - openai_start
            timing_data['openai_analysis'] = openai_time
            
            print(f"✅ Analysis complete: {len(analysis_json.get('chunks', []))} chunks identified - {openai_time:.2f}s")
            print()
            
            # Step 5: Save all outputs
            print("💾 Step 5: Saving outputs...")
            save_start = time.time()
            self.save_frames(frames, output_folder)
            self.save_transcript(audio_extraction, output_folder)
            self.save_analysis(analysis_json, output_folder)
            self.save_summary(video_url, frames, audio_extraction, analysis_json, output_folder)
            save_time = time.time() - save_start
            timing_data['save_outputs'] = save_time
            
            total_time = time.time() - total_start_time
            timing_data['total'] = total_time
            
            print()
            print("🎉 Processing Complete!")
            print(f"📁 All files saved to: {output_folder}")
            print()
            
            # Display timing breakdown
            print("⏱️ Timing Breakdown:")
            print(f"   📥 Download:         {timing_data['download']:.2f}s ({timing_data['download']/total_time*100:.1f}%)")
            print(f"   🔄 Parallel extract: {timing_data['parallel_extraction']:.2f}s ({timing_data['parallel_extraction']/total_time*100:.1f}%) [frames + audio]")
            print(f"   🤖 OpenAI analysis:  {timing_data['openai_analysis']:.2f}s ({timing_data['openai_analysis']/total_time*100:.1f}%)")
            print(f"   💾 Save outputs:     {timing_data['save_outputs']:.2f}s ({timing_data['save_outputs']/total_time*100:.1f}%)")
            print(f"   🏁 Total time:       {total_time:.2f}s")
            print()
            
            # Display quick analysis preview
            print("📋 Quick Preview:")
            print(f"   Summary: {analysis_json.get('summary', 'N/A')}")
            print(f"   Duration: {audio_extraction.duration:.1f}s")
            print(f"   Scenes: {len(set(f.scene_id for f in frames))}")
            print(f"   Transcript: \"{audio_extraction.full_transcript[:100]}{'...' if len(audio_extraction.full_transcript) > 100 else ''}\"")
            
            return output_folder
            
        except Exception as e:
            print(f"❌ Error during processing: {e}")
            import traceback
            traceback.print_exc()
            return None
            
        finally:
            # Cleanup temp file
            try:
                if temp_video_path and Path(temp_video_path).exists():
                    Path(temp_video_path).unlink(missing_ok=True)
            except:
                pass

async def main():
    if len(sys.argv) != 2:
        print("Usage: python process_video.py <video_url>")
        print()
        print("Examples:")
        print("  python process_video.py \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"")
        print("  python process_video.py \"https://www.instagram.com/reels/DNBhZWxyjQS/\"")
        print("  python process_video.py \"https://www.tiktok.com/@user/video/123456789\"")
        return
        
    video_url = sys.argv[1]
    processor = VideoProcessor()
    await processor.process_video(video_url)

if __name__ == "__main__":
    asyncio.run(main())