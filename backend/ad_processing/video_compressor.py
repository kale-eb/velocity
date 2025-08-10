import os
import base64
import tempfile
import subprocess
from pathlib import Path
import yt_dlp

# Import settings
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config.settings import settings


class VideoCompressor:
    def __init__(self, max_size_mb=None):
        self.max_size_mb = max_size_mb if max_size_mb is not None else settings.MAX_VIDEO_SIZE_MB
        self.max_size_bytes = self.max_size_mb * 1024 * 1024
        
    def download_and_compress_video(self, url: str) -> str:
        """
        Download video from URL and compress to base64 (max 5MB)
        Returns base64 encoded video string
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            # Step 1: Download video
            download_path = self._download_video(url, temp_dir)
            
            # Step 2: Compress video to target size
            compressed_path = self._compress_video(download_path, temp_dir)
            
            # Step 3: Convert to base64
            base64_video = self._video_to_base64(compressed_path)
            
            return base64_video
    
    def _download_video(self, url: str, temp_dir: str) -> str:
        """Download video using yt-dlp"""
        output_path = os.path.join(temp_dir, 'downloaded_video.%(ext)s')
        
        ydl_opts = {
            'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
            'outtmpl': output_path,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Find the downloaded file
        for file in os.listdir(temp_dir):
            if file.startswith('downloaded_video'):
                return os.path.join(temp_dir, file)
        
        raise Exception("Download failed - no file found")
    
    def _compress_video(self, input_path: str, temp_dir: str) -> str:
        """Compress video to target size using ffmpeg"""
        output_path = os.path.join(temp_dir, 'compressed_video.mp4')
        
        # Get video duration first
        duration = self._get_video_duration(input_path)
        
        # Calculate target bitrate for desired file size
        # Formula: bitrate = (target_size_bits / duration_seconds) * 0.8 (80% for video, 20% for audio)
        target_bitrate = int((self.max_size_bytes * 8 / duration) * 0.8)
        
        # Ensure minimum quality
        target_bitrate = max(target_bitrate, 200000)  # Min 200k bitrate
        
        # Compress with ffmpeg
        cmd = [
            'ffmpeg', '-i', input_path,
            '-c:v', 'libx264',
            '-b:v', f'{target_bitrate}',
            '-c:a', 'aac',
            '-b:a', '64k',
            '-preset', 'medium',
            '-crf', '28',
            '-maxrate', f'{int(target_bitrate * 1.2)}',
            '-bufsize', f'{int(target_bitrate * 2)}',
            '-vf', 'scale=640:360',  # Reduce resolution to help with size
            '-y',  # Overwrite output
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg compression failed: {result.stderr}")
        
        # Check if file size is acceptable
        file_size = os.path.getsize(output_path)
        if file_size > self.max_size_bytes:
            # If still too large, try more aggressive compression
            return self._aggressive_compress(input_path, temp_dir)
        
        return output_path
    
    def _aggressive_compress(self, input_path: str, temp_dir: str) -> str:
        """More aggressive compression if initial attempt was too large"""
        output_path = os.path.join(temp_dir, 'compressed_aggressive.mp4')
        
        duration = self._get_video_duration(input_path)
        target_bitrate = int((self.max_size_bytes * 8 / duration) * 0.7)  # 70% for video
        target_bitrate = max(target_bitrate, 100000)  # Min 100k bitrate
        
        cmd = [
            'ffmpeg', '-i', input_path,
            '-c:v', 'libx264',
            '-b:v', f'{target_bitrate}',
            '-c:a', 'aac',
            '-b:a', '32k',  # Lower audio bitrate
            '-preset', 'fast',
            '-crf', '32',   # Higher CRF (lower quality)
            '-maxrate', f'{target_bitrate}',
            '-bufsize', f'{int(target_bitrate * 1.5)}',
            '-vf', 'scale=480:270',  # Even smaller resolution
            '-r', '20',     # Reduce framerate to 20fps
            '-y',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Aggressive compression failed: {result.stderr}")
        
        return output_path
    
    def _get_video_duration(self, video_path: str) -> float:
        """Get video duration in seconds"""
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', video_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return 30.0  # Default fallback
        
        try:
            import json
            data = json.loads(result.stdout)
            return float(data['format']['duration'])
        except:
            return 30.0
    
    def _video_to_base64(self, video_path: str) -> str:
        """Convert video file to base64 string"""
        with open(video_path, 'rb') as video_file:
            video_data = video_file.read()
            base64_data = base64.b64encode(video_data).decode('utf-8')
            
            # Add data URL prefix for video
            return f"data:video/mp4;base64,{base64_data}"


# Test function
if __name__ == "__main__":
    compressor = VideoCompressor(max_size_mb=5)
    
    # Test with a URL
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    try:
        base64_video = compressor.download_and_compress_video(test_url)
        print(f"Success! Base64 video length: {len(base64_video)} characters")
        print(f"Estimated size: {len(base64_video) * 3/4 / 1024 / 1024:.2f} MB")
    except Exception as e:
        print(f"Error: {e}")