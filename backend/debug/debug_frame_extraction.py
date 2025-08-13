#!/usr/bin/env python3
"""
Debug script to analyze frame extraction for a specific video
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from ad_processing import ViralFrameExtractor
import tempfile
import yt_dlp

def debug_frame_extraction(video_url):
    """Debug frame extraction process step by step"""
    
    print(f"\n{'='*60}")
    print(f"DEBUGGING FRAME EXTRACTION")
    print(f"Video URL: {video_url}")
    print(f"{'='*60}\n")
    
    # Download video
    print("📥 Downloading video...")
    temp_video_path = tempfile.mktemp(suffix='.mp4')
    
    ydl_opts = {
        'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
        'outtmpl': temp_video_path,
        'no_warnings': True,
    }
    
    # Try to add Chrome cookies if available
    try:
        ydl_opts['cookiesfrombrowser'] = ('chrome', None, None, None)
        print("Using Chrome cookies for download")
    except Exception:
        print("Chrome cookies not available, trying without")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return
    
    file_size_mb = Path(temp_video_path).stat().st_size / (1024 * 1024)
    print(f"✅ Downloaded: {file_size_mb:.1f} MB")
    
    # Initialize extractor
    extractor = ViralFrameExtractor(
        jump_cut_threshold=0.73,
        max_frames_per_video=30,
        target_frames_per_video=30
    )
    
    # Get video length
    video_length = extractor.get_video_length(temp_video_path)
    print(f"\n📹 Video duration: {video_length:.2f} seconds")
    
    # Step 1: Detect jump cut timestamps
    print(f"\n{'='*60}")
    print("STEP 1: JUMP CUT DETECTION")
    print(f"{'='*60}")
    
    jump_cut_timestamps = extractor.detect_jump_cut_timestamps(temp_video_path, video_length)
    
    print(f"\n📊 Jump Cut Detection Results:")
    print(f"   Total jump cuts detected: {len(jump_cut_timestamps)}")
    print(f"   Jump cut timestamps and scores:")
    
    for i, (timestamp, score) in enumerate(jump_cut_timestamps[:10]):  # Show first 10
        print(f"      {i+1:2d}. {timestamp:6.2f}s - similarity: {score:.3f}")
    
    if len(jump_cut_timestamps) > 10:
        print(f"      ... and {len(jump_cut_timestamps) - 10} more")
    
    # Step 2: Filter to 30 most significant
    if len(jump_cut_timestamps) > 30:
        print(f"\n📉 Filtering to 30 most significant jump cuts...")
        selected_timestamps = extractor.select_most_significant_timestamps(jump_cut_timestamps, 30)
        print(f"   Selected {len(selected_timestamps)} jump cuts")
        print(f"   Selected timestamps:")
        for i, (timestamp, score) in enumerate(selected_timestamps[:10]):
            print(f"      {i+1:2d}. {timestamp:6.2f}s - similarity: {score:.3f}")
        if len(selected_timestamps) > 10:
            print(f"      ... and {len(selected_timestamps) - 10} more")
    else:
        selected_timestamps = jump_cut_timestamps
        print(f"\n✅ Using all {len(selected_timestamps)} jump cuts (within limit)")
    
    # Step 3: Define scenes
    print(f"\n{'='*60}")
    print("STEP 2: SCENE DEFINITION")
    print(f"{'='*60}")
    
    scenes = extractor.define_scenes_from_timestamps(selected_timestamps, video_length)
    print(f"\n📊 Scene Definition Results:")
    print(f"   Total scenes defined: {len(scenes)}")
    print(f"   Scene durations:")
    
    for i, scene in enumerate(scenes[:10]):  # Show first 10
        print(f"      Scene {i+1:2d}: {scene['start']:6.2f}s - {scene['end']:6.2f}s (duration: {scene['duration']:.2f}s)")
    
    if len(scenes) > 10:
        print(f"      ... and {len(scenes) - 10} more scenes")
    
    # Step 4: Extract frames
    print(f"\n{'='*60}")
    print("STEP 3: FRAME EXTRACTION")
    print(f"{'='*60}")
    
    frames = extractor.extract_frames_from_scenes(scenes, temp_video_path, 30)
    
    print(f"\n📊 Frame Extraction Results:")
    print(f"   Total frames extracted: {len(frames)}")
    
    # Count frame types
    jump_cut_count = sum(1 for f in frames if f.frame_type == 'jump_cut')
    scene_interval_count = sum(1 for f in frames if f.frame_type == 'scene_interval')
    
    print(f"   Frame types:")
    print(f"      Jump cuts: {jump_cut_count}")
    print(f"      Scene intervals: {scene_interval_count}")
    
    print(f"\n   Frame details (first 15):")
    for i, frame in enumerate(frames[:15]):
        print(f"      {i+1:2d}. {frame.timestamp:6.2f}s - type: {frame.frame_type:15s} - scene: {frame.scene_id}")
    
    if len(frames) > 15:
        print(f"      ... and {len(frames) - 15} more frames")
    
    # Cleanup
    try:
        Path(temp_video_path).unlink(missing_ok=True)
        print(f"\n✅ Cleanup complete")
    except:
        pass
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Jump cuts detected: {len(jump_cut_timestamps)}")
    print(f"Jump cuts selected: {len(selected_timestamps)}")
    print(f"Scenes defined: {len(scenes)}")
    print(f"Frames extracted: {len(frames)}")
    print(f"  - Jump cut frames: {jump_cut_count}")
    print(f"  - Scene interval frames: {scene_interval_count}")

if __name__ == "__main__":
    # Test with the Instagram video
    url = "https://www.instagram.com/reels/DNEgqLpyF1M/"
    debug_frame_extraction(url)