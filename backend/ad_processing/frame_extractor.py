"""
Frame Extractor for Marketing App Backend
Copied and adapted from viral-content-analyzer
"""

import cv2
import numpy as np
import subprocess
import tempfile
import os
import io
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Callable, Union
from dataclasses import dataclass
from PIL import Image
import logging
import time
import hashlib
import base64

# Import settings
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config.settings import settings

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def _histogram_comparison(frame1: np.ndarray, frame2: np.ndarray) -> float:
    """Fast histogram-based similarity comparison"""
    # Convert to HSV for better color representation
    hsv1 = cv2.cvtColor(frame1, cv2.COLOR_RGB2HSV)
    hsv2 = cv2.cvtColor(frame2, cv2.COLOR_RGB2HSV)
    
    # Calculate histograms for each channel
    hist1_h = cv2.calcHist([hsv1], [0], None, [50], [0, 180])
    hist1_s = cv2.calcHist([hsv1], [1], None, [60], [0, 256])
    hist1_v = cv2.calcHist([hsv1], [2], None, [60], [0, 256])
    
    hist2_h = cv2.calcHist([hsv2], [0], None, [50], [0, 180])
    hist2_s = cv2.calcHist([hsv2], [1], None, [60], [0, 256])
    hist2_v = cv2.calcHist([hsv2], [2], None, [60], [0, 256])
    
    # Compare histograms using correlation
    corr_h = cv2.compareHist(hist1_h, hist2_h, cv2.HISTCMP_CORREL)
    corr_s = cv2.compareHist(hist1_s, hist2_s, cv2.HISTCMP_CORREL)
    corr_v = cv2.compareHist(hist1_v, hist2_v, cv2.HISTCMP_CORREL)
    
    # Weighted average (luminance is most important for duplicates)
    similarity = (corr_h * 0.2 + corr_s * 0.3 + corr_v * 0.5)
    return similarity

def _perceptual_hash(frame1: np.ndarray, frame2: np.ndarray) -> float:
    """Perceptual hash-based similarity comparison"""
    def phash(image: np.ndarray, hash_size: int = 16) -> str:
        # Resize to 32x32 then crop to hash_size x hash_size
        resized = cv2.resize(image, (32, 32))
        
        # Convert to grayscale if needed
        if len(resized.shape) == 3:
            resized = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)
        
        # Apply DCT (Discrete Cosine Transform)
        dct = cv2.dct(np.float32(resized))
        
        # Extract top-left hash_size x hash_size
        dct_low_freq = dct[:hash_size, :hash_size]
        
        # Calculate median
        median = np.median(dct_low_freq)
        
        # Generate hash based on median
        hash_bits = dct_low_freq > median
        return ''.join(['1' if bit else '0' for bit in hash_bits.flatten()])
    
    hash1 = phash(frame1)
    hash2 = phash(frame2)
    
    # Calculate Hamming distance
    hamming_distance = sum(c1 != c2 for c1, c2 in zip(hash1, hash2))
    max_distance = len(hash1)
    
    # Convert to similarity (0-1, where 1 is identical)
    similarity = 1 - (hamming_distance / max_distance)
    return similarity

def _difference_hash(frame1: np.ndarray, frame2: np.ndarray) -> float:
    """Difference hash (d-hash) based similarity comparison - good for texture variations"""
    def dhash(image: np.ndarray, hash_size: int = 8) -> str:
        # Resize to (hash_size + 1) x hash_size to allow for difference calculation
        resized = cv2.resize(image, (hash_size + 1, hash_size))
        
        # Convert to grayscale if needed
        if len(resized.shape) == 3:
            resized = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)
        
        # Calculate horizontal gradient (difference between adjacent pixels)
        diff = resized[:, 1:] > resized[:, :-1]
        
        # Convert to binary string
        return ''.join(['1' if bit else '0' for bit in diff.flatten()])
    
    hash1 = dhash(frame1)
    hash2 = dhash(frame2)
    
    # Calculate Hamming distance
    hamming_distance = sum(c1 != c2 for c1, c2 in zip(hash1, hash2))
    max_distance = len(hash1)
    
    # Convert to similarity (0-1, where 1 is identical)
    similarity = 1 - (hamming_distance / max_distance)
    return similarity

def _delta_intensity(frame1: np.ndarray, frame2: np.ndarray) -> float:
    """Delta intensity - measures brightness/luminance change between frames"""
    # Convert to grayscale if needed
    if len(frame1.shape) == 3:
        gray1 = cv2.cvtColor(frame1, cv2.COLOR_RGB2GRAY)
    else:
        gray1 = frame1
        
    if len(frame2.shape) == 3:
        gray2 = cv2.cvtColor(frame2, cv2.COLOR_RGB2GRAY)
    else:
        gray2 = frame2
    
    # Calculate mean intensity for each frame
    mean1 = np.mean(gray1)
    mean2 = np.mean(gray2)
    
    # Calculate the absolute difference in mean intensity
    intensity_diff = abs(mean1 - mean2)
    
    # Normalize to 0-1 range where 1 is identical (no change)
    # Max possible difference is 255, so we normalize by that
    # We use an exponential decay to make small changes more significant
    similarity = np.exp(-intensity_diff / 30.0)  # 30 is a tuning parameter
    
    return similarity

def _combined_similarity(frame1: np.ndarray, frame2: np.ndarray) -> float:
    """Combined similarity method using histogram + perceptual hash"""
    hist_sim = _histogram_comparison(frame1, frame2)
    hash_sim = _perceptual_hash(frame1, frame2)
    
    # Weighted combination (75% perceptual hash, 25% histogram)
    combined_similarity = (hist_sim * 0.25 + hash_sim * 0.75)
    return combined_similarity

def _is_jump_cut(frame1: np.ndarray, frame2: np.ndarray, threshold: float = None) -> tuple[bool, dict]:
    """
    Jump cut detection based on combined similarity (histogram + perceptual hash).
    Delta intensity veto removed to detect more legitimate jump cuts.
    
    Returns:
        tuple: (is_jump_cut, metrics_dict)
        - is_jump_cut: bool indicating if this is a jump cut
        - metrics_dict: dict with all similarity metrics for debugging
    """
    # Use default threshold if not provided
    if threshold is None:
        threshold = 0.65  # Default from settings
    
    # Calculate all metrics
    combined_sim = _combined_similarity(frame1, frame2)
    delta_intensity = _delta_intensity(frame1, frame2)  # Still calculate for logging
    
    # Simple check: combined similarity below threshold
    is_jump_cut = combined_sim < threshold
    
    # Compile metrics for debugging
    metrics = {
        'combined_similarity': combined_sim,
        'delta_intensity': delta_intensity,
        'initial_jump_cut': is_jump_cut,
        'delta_intensity_veto': False,  # No longer using veto
        'final_jump_cut': is_jump_cut,
        'threshold': threshold
    }
    
    return is_jump_cut, metrics

@dataclass
class FrameData:
    """Container for frame data with metadata"""
    image: np.ndarray  # Raw image data
    timestamp: float   # Time in video (seconds)
    frame_type: str    # 'interval', 'jump_cut', or 'scene_interval'
    similarity_score: Optional[float] = None  # Similarity to previous frame (lower = bigger jump cut)
    duration: Optional[float] = None  # Duration this frame represents
    scene_id: Optional[int] = None  # Scene number this frame belongs to
    
    def to_pil(self) -> Image.Image:
        """Convert numpy array to PIL Image"""
        # Convert BGR to RGB for PIL
        if len(self.image.shape) == 3:
            rgb_image = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
        else:
            rgb_image = self.image
        return Image.fromarray(rgb_image)
    
    def to_base64(self, max_size: int = None, quality: int = None) -> str:
        """Convert frame to base64 for API submission with configurable compression.
        
        This method now saves frames to temporary JPEG files first, then loads them back.
        This mimics the successful test script approach and should fix image encoding issues.
        """
        try:
            # Use settings defaults if not specified
            if max_size is None:
                max_size = getattr(settings, 'FRAME_IMAGE_MAX_SIZE', 512)
            if quality is None:
                quality = getattr(settings, 'FRAME_IMAGE_QUALITY', 70)
            
            pil_img = self.to_pil()
            logger.debug(f"Original image mode: {pil_img.mode}, size: {pil_img.size}")
            
            # Always convert to RGB mode for JPEG compatibility
            if pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')
                logger.debug(f"Converted to RGB mode")
            
            # Create temporary file path
            timestamp_str = f"{self.timestamp:.2f}".replace('.', '_')
            temp_filename = f"temp_frame_{timestamp_str}_{int(time.time())}.jpg"
            temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
            
            try:
                # Step 1: Save to temporary JPEG file (like test scripts do)
                pil_img.save(temp_path, format='JPEG', quality=quality, optimize=True)
                logger.debug(f"Saved temporary frame to: {temp_path}")
                
                # Step 2: Load the JPEG file back (this normalizes the image data)
                saved_img = Image.open(temp_path)
                saved_img.load()  # Ensure image data is loaded into memory
                logger.debug(f"Loaded saved image - mode: {saved_img.mode}, size: {saved_img.size}")
                
                # Step 3: Apply compression/resizing to the normalized image
                width, height = saved_img.size
                if max(width, height) > max_size:
                    scale = max_size / max(width, height)
                    new_width = max(1, int(width * scale))  # Ensure at least 1 pixel
                    new_height = max(1, int(height * scale))  # Ensure at least 1 pixel
                    saved_img = saved_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    logger.debug(f"Resized to: {saved_img.size}")
                
                # Step 4: Convert to base64 with final compression
                buffer = io.BytesIO()
                saved_img.save(buffer, format='JPEG', quality=quality, optimize=True)
                buffer.seek(0)
                
                image_data = buffer.read()
                if len(image_data) == 0:
                    raise ValueError("Generated empty image data")
                
                logger.debug(f"Final JPEG data size: {len(image_data)} bytes")
                
                # Step 5: Validate the JPEG data by trying to reopen it
                test_buffer = io.BytesIO(image_data)
                try:
                    test_img = Image.open(test_buffer)
                    test_img.verify()
                    logger.debug(f"Final JPEG validation passed")
                except Exception as verify_error:
                    raise ValueError(f"Generated invalid JPEG data: {verify_error}")
                
                base64_str = base64.b64encode(image_data).decode('utf-8')
                logger.debug(f"Base64 length: {len(base64_str)}")
                
                return f"data:image/jpeg;base64,{base64_str}"
            
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                        logger.debug(f"Cleaned up temporary file: {temp_path}")
                    except Exception as cleanup_error:
                        logger.warning(f"Failed to cleanup temp file {temp_path}: {cleanup_error}")
            
        except Exception as e:
            logger.error(f"Error converting frame to base64: {e}")
            logger.error(f"Frame timestamp: {self.timestamp}, type: {self.frame_type}")
            logger.error(f"Original image shape: {self.image.shape if hasattr(self.image, 'shape') else 'N/A'}")
            raise
    
    def to_bytes(self, format='JPEG', quality=85) -> bytes:
        """Convert to compressed bytes for API calls"""
        pil_img = self.to_pil()
        buffer = io.BytesIO()
        pil_img.save(buffer, format=format, quality=quality, optimize=True)
        return buffer.getvalue()

class ViralFrameExtractor:
    """
    Frame extractor for advertisement analysis.
    Simplified version focused on marketing app needs.
    """
    
    def __init__(self, 
                 ffmpeg_path: str = 'ffmpeg',
                 ffprobe_path: str = 'ffprobe',
                 jump_cut_threshold: float = None,
                 max_frames_per_video: int = 30,
                 target_frames_per_video: int = None,
                 max_video_duration: float = None):
        """
        Initialize the frame extractor.
        
        Args:
            ffmpeg_path: Path to ffmpeg binary
            ffprobe_path: Path to ffprobe binary
            jump_cut_threshold: Similarity threshold for detecting jump cuts (uses config default if None)
            max_frames_per_video: Maximum frames to extract per video
            target_frames_per_video: Target number of frames to aim for (uses config default if None)
            max_video_duration: Maximum video duration in seconds (uses config default if None)
        """
        self.ffmpeg_path = ffmpeg_path
        self.ffprobe_path = ffprobe_path
        self.jump_cut_threshold = jump_cut_threshold if jump_cut_threshold is not None else settings.JUMP_CUT_THRESHOLD
        self.max_frames_per_video = max_frames_per_video
        self.target_frames_per_video = target_frames_per_video if target_frames_per_video is not None else settings.TARGET_FRAMES_PER_VIDEO
        self.max_video_duration = max_video_duration if max_video_duration is not None else settings.MAX_VIDEO_DURATION
        
    def get_video_length(self, video_path: str) -> float:
        """Get video duration using ffprobe."""
        try:
            result = subprocess.run([
                self.ffprobe_path, "-v", "error", "-show_entries",
                "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", 
                video_path
            ], capture_output=True, text=True, check=True)
            
            duration = float(result.stdout.strip())
            
            # Enforce 90-second limit
            if duration > self.max_video_duration:
                raise ValueError(f"Video duration ({duration:.1f}s) exceeds maximum allowed duration ({self.max_video_duration}s)")
            
            return duration
        except (subprocess.CalledProcessError, ValueError) as e:
            logger.error(f"Failed to get video length for {video_path}: {e}")
            raise ValueError(f"Could not determine video length: {e}")
    
    def extract_frames(self, video_path: str) -> List[FrameData]:
        """
        Main extraction pipeline for marketing app.
        Uses jump cut detection + gap filling approach.
        """
        start_time = time.time()
        logger.info(f"Starting frame extraction for {video_path}")
        
        try:
            # Get video metadata
            video_length = self.get_video_length(video_path)
            logger.info(f"Video duration: {video_length:.2f}s (limit: {self.max_video_duration}s)")
            
            # Step 1: Jump cut detection → timestamps only
            jump_cut_timestamps = self.detect_jump_cut_timestamps(video_path, video_length)
            print(f"🎬 JUMP CUT DETECTION RESULTS:", flush=True)
            print(f"   Total jump cuts detected: {len(jump_cut_timestamps)}", flush=True)
            print(f"   Max frames allowed: {self.max_frames_per_video}", flush=True)
            print(f"   Target frames to aim for: {self.target_frames_per_video}", flush=True)
            
            logger.info(f"🎬 JUMP CUT DETECTION RESULTS:")
            logger.info(f"   Total jump cuts detected: {len(jump_cut_timestamps)}")
            logger.info(f"   Max frames allowed: {self.max_frames_per_video}")
            logger.info(f"   Target frames to aim for: {self.target_frames_per_video}")
            
            # Step 2: Timestamp-based frame extraction
            frames = self.extract_frames_from_timestamps(jump_cut_timestamps, video_path, video_length, self.max_frames_per_video)
            logger.info(f"🎬 FINAL EXTRACTION: {len(frames)} total frames from timestamp-based approach")
            
            # Calculate frame durations
            frames = self.calculate_frame_durations(frames, video_length)
            
            extraction_time = time.time() - start_time
            logger.info(f"Frame extraction completed in {extraction_time:.2f}s: {len(frames)} final frames")
            
            return frames
                
        except Exception as e:
            logger.error(f"Frame extraction failed for {video_path}: {e}")
            raise
    
    def detect_jump_cut_timestamps(self, video_path: str, video_length: float) -> List[Tuple[float, Dict]]:
        """
        Detect jump cuts and return timestamps with full metrics.
        Returns list of (timestamp, metrics_dict) tuples.
        """
        logger.info(f"Detecting jump cuts at 6 FPS for {video_length:.2f}s video")
        
        fps = 6.0
        interval = 1.0 / fps  # 1/6 second = ~0.167s
        
        jump_cut_timestamps = []
        
        # Always include first frame as jump cut with best possible scores
        first_metrics = {
            'combined_similarity': 0.0,
            'histogram_similarity': 0.0,
            'delta_intensity': 0.0,
            'combined_score': 0.0  # histogram + delta for ranking
        }
        jump_cut_timestamps.append((0.0, first_metrics))
        logger.debug(f"First frame at 0.0s marked as jump cut")
        
        # Extract and compare frames at 6 FPS
        current_time = interval
        previous_frame = None
        
        # Extract first frame for comparison
        previous_frame = self.extract_single_frame(video_path, 0.0)
        if not previous_frame:
            logger.warning("Could not extract first frame")
            return jump_cut_timestamps
        
        while current_time < video_length:
            current_frame = self.extract_single_frame(video_path, current_time)
            if not current_frame:
                current_time += interval
                continue
            
            # Calculate all similarity metrics
            hist_sim = _histogram_comparison(previous_frame.image, current_frame.image)
            delta_int = _delta_intensity(previous_frame.image, current_frame.image)
            combined_sim = _combined_similarity(previous_frame.image, current_frame.image)
            
            # Use combined similarity for jump cut detection threshold
            is_jump_cut = combined_sim < self.jump_cut_threshold
            
            if is_jump_cut:
                metrics = {
                    'combined_similarity': combined_sim,
                    'histogram_similarity': hist_sim,
                    'delta_intensity': delta_int,
                    'combined_score': (hist_sim + delta_int) / 2  # Average of histogram and delta for ranking
                }
                jump_cut_timestamps.append((current_time, metrics))
                logger.debug(f"Jump cut detected at {current_time:.3f}s (combined: {combined_sim:.3f}, hist: {hist_sim:.3f}, delta: {delta_int:.3f}, score: {metrics['combined_score']:.3f})")
            else:
                logger.debug(f"No jump cut at {current_time:.3f}s (combined: {combined_sim:.3f})")
            
            previous_frame = current_frame
            current_time += interval
        
        logger.info(f"Jump cut detection complete: {len(jump_cut_timestamps)} jump cuts detected")
        return jump_cut_timestamps
    
    def extract_frames_from_timestamps(self, jump_cut_timestamps: List[Tuple[float, Dict]], video_path: str, video_length: float, max_frames: int) -> List[FrameData]:
        """
        Complete timestamp-first frame extraction pipeline.
        1. Select most significant jump cuts (if > max_frames)
        2. Define scenes from selected timestamps 
        3. Allocate and extract frames using positioning strategy
        """
        if not jump_cut_timestamps:
            return self.extract_interval_frames_to_target(video_path, video_length, max_frames)
        
        # Step 1: Filter jump cut timestamps if needed
        if len(jump_cut_timestamps) > max_frames:
            selected_timestamps = self.select_most_significant_timestamps(jump_cut_timestamps, max_frames)
            logger.info(f"📉 FILTERED: {len(jump_cut_timestamps)} jump cuts → {len(selected_timestamps)} most significant")
        else:
            selected_timestamps = jump_cut_timestamps
            logger.info(f"✅ USING ALL: {len(selected_timestamps)} jump cuts (within limit)")
        
        # Step 2: Define scenes from selected timestamps
        scenes = self.define_scenes_from_timestamps(selected_timestamps, video_length)
        logger.info(f"🎬 SCENES: Defined {len(scenes)} scenes from {len(selected_timestamps)} jump cuts")
        
        # Step 3: Allocate frames to scenes and extract
        frames = self.extract_frames_from_scenes(scenes, video_path, max_frames)
        
        return frames
    
    def select_most_significant_timestamps(self, jump_cut_timestamps: List[Tuple[float, Dict]], max_count: int) -> List[Tuple[float, Dict]]:
        """
        Select the most significant jump cuts based on histogram + delta intensity scores.
        Lower combined score = more significant jump cut.
        Always keeps the first timestamp.
        """
        if len(jump_cut_timestamps) <= max_count:
            return jump_cut_timestamps
        
        # Sort by combined score (histogram + delta intensity), lowest first = biggest jump cuts
        sorted_timestamps = sorted(jump_cut_timestamps, key=lambda x: x[1]['combined_score'])
        
        # Select the max_count most significant jump cuts
        selected_timestamps = sorted_timestamps[:max_count]
        
        # Sort back into chronological order
        selected_timestamps.sort(key=lambda x: x[0])
        
        # Log selected scores
        logger.info(f"Selected {max_count} jump cuts with lowest histogram+delta scores:")
        for i, (timestamp, metrics) in enumerate(selected_timestamps[:10]):
            logger.info(f"  {i+1:2d}. {timestamp:6.2f}s - hist: {metrics['histogram_similarity']:.3f}, delta: {metrics['delta_intensity']:.3f}, combined: {metrics['combined_score']:.3f}")
        if len(selected_timestamps) > 10:
            logger.info(f"  ... and {len(selected_timestamps) - 10} more")
        
        return selected_timestamps
    
    def define_scenes_from_timestamps(self, timestamps: List[Tuple[float, Dict]], video_length: float) -> List[Dict]:
        """
        Define scenes based on jump cut timestamps.
        Returns list of scene dictionaries with start, end, duration.
        """
        if not timestamps:
            return []
        
        scenes = []
        
        # Sort timestamps just to be safe
        timestamps.sort(key=lambda x: x[0])
        
        # Extract just the timestamp values
        timestamp_values = [t[0] for t in timestamps]
        
        # Create scenes between consecutive timestamps
        for i in range(len(timestamp_values)):
            if i == len(timestamp_values) - 1:
                # Last scene: from last jump cut to end of video
                start_time = timestamp_values[i]
                end_time = video_length
            else:
                # Regular scene: from this jump cut to next
                start_time = timestamp_values[i]
                end_time = timestamp_values[i + 1]
            
            duration = end_time - start_time
            
            # Only include scenes longer than 0.5 seconds
            if duration > 0.5:
                scenes.append({
                    'start': start_time,
                    'end': end_time,
                    'duration': duration,
                    'jump_cut_timestamp': start_time
                })
        
        return scenes
    
    def extract_frames_from_scenes(self, scenes: List[Dict], video_path: str, max_frames: int) -> List[FrameData]:
        """
        Extract frames from scenes using intelligent positioning strategy.
        """
        if not scenes:
            return []
        
        # Allocate frames to scenes
        frame_allocation = self._allocate_frames_to_scenes(scenes, max_frames)
        
        all_frames = []
        
        # Extract frames for each scene
        for i, (scene, frames_for_scene) in enumerate(zip(scenes, frame_allocation)):
            scene_id = i + 1
            scene_frames = self._extract_scene_frames(scene, frames_for_scene, scene_id, video_path)
            all_frames.extend(scene_frames)
            
            # Stop if we've reached the max frame limit
            if len(all_frames) >= max_frames:
                logger.info(f"Reached max frame limit of {max_frames}, stopping extraction")
                all_frames = all_frames[:max_frames]
                break
            
            logger.debug(f"Scene {scene_id}: {scene['start']:.1f}s-{scene['end']:.1f}s ({scene['duration']:.1f}s) → {len(scene_frames)} frames")
        
        # Sort by timestamp and ensure exact count
        all_frames.sort(key=lambda f: f.timestamp)
        
        if len(all_frames) > max_frames:
            logger.info(f"Truncating {len(all_frames)} frames to {max_frames} max limit")
            all_frames = all_frames[:max_frames]
        
        logger.info(f"🎬 Frame extraction complete: {len(scenes)} scenes processed, {len(all_frames)} total frames")
        return all_frames
    
    def _extract_scene_frames(self, scene: Dict, frame_count: int, scene_id: int, video_path: str) -> List[FrameData]:
        """
        Extract frames within a scene using positioning strategy.
        Same logic as before but with cleaner separation.
        """
        if frame_count <= 0:
            return []
        
        start_time = scene['start']
        end_time = scene['end']
        duration = scene['duration']
        
        # Calculate frame positions based on count
        if frame_count == 1:
            # Middle of scene
            positions = [0.5]
        elif frame_count == 2:
            # 1/3 and 2/3 marks
            positions = [1/3, 2/3]
        elif frame_count == 3:
            # Start, middle, end
            positions = [0.0, 0.5, 1.0]
        else:
            # Start, evenly distributed middle frames, end
            positions = [0.0]  # Start
            
            # Middle frames evenly distributed
            if frame_count > 2:
                middle_frames = frame_count - 2
                for i in range(1, middle_frames + 1):
                    position = i / (middle_frames + 1)
                    positions.append(position)
            
            positions.append(1.0)  # End
        
        # Extract frames at calculated positions
        scene_frames = []
        for i, position in enumerate(positions):
            # Calculate timestamp (avoid exact end to prevent edge cases)
            if position >= 1.0:
                timestamp = end_time - 0.1  # Slightly before end
            else:
                timestamp = start_time + (duration * position)
            
            # Ensure timestamp is within bounds
            timestamp = max(start_time, min(timestamp, end_time - 0.1))
            
            frame = self.extract_single_frame(video_path, timestamp)
            if frame:
                # Use proper frame types for analyzer
                frame.frame_type = 'jump_cut' if i == 0 else 'scene_interval'
                frame.scene_id = scene_id
                scene_frames.append(frame)
                logger.debug(f"  Scene {scene_id} frame {i+1}/{frame_count} at {timestamp:.3f}s (position: {position:.2f})")
        
        return scene_frames
    
    def detect_jump_cuts(self, video_path: str, video_length: float) -> List[FrameData]:
        """
LEGACY METHOD: Detect jump cuts by sampling at 6 FPS and comparing consecutive frames.
        This method is replaced by detect_jump_cut_timestamps() but kept for compatibility.
        """
        logger.info(f"Detecting jump cuts at 6 FPS for {video_length:.2f}s video")
        
        fps = 6.0
        interval = 1.0 / fps  # 1/6 second = ~0.167s
        
        frames = []
        jump_cut_frames = []
        
        # Extract all frames at 6 FPS
        current_time = 0.0
        while current_time < video_length:
            frame = self.extract_single_frame(video_path, current_time)
            if frame:
                frame.frame_type = 'candidate'
                frames.append(frame)
                logger.debug(f"Extracted candidate frame at {current_time:.3f}s")
            current_time += interval
        
        if not frames:
            logger.warning("No frames extracted during jump cut detection")
            return []
        
        # Always keep first frame as a jump cut (with lowest possible score to ensure it's kept)
        frames[0].frame_type = 'jump_cut'
        frames[0].similarity_score = 0.0  # Ensure first frame is always kept
        jump_cut_frames.append(frames[0])
        logger.debug(f"First frame at {frames[0].timestamp:.3f}s marked as jump cut")
        
        # Compare consecutive frames to detect jump cuts
        for i in range(1, len(frames)):
            current_frame = frames[i]
            previous_frame = frames[i - 1]
            
            # Use intelligent jump cut detection with delta intensity veto
            is_jump_cut, metrics = _is_jump_cut(previous_frame.image, current_frame.image, self.jump_cut_threshold)
            
            if is_jump_cut:
                current_frame.frame_type = 'jump_cut'
                current_frame.similarity_score = metrics['combined_similarity']  # Store the similarity score
                jump_cut_frames.append(current_frame)
                logger.debug(f"Jump cut detected at {current_frame.timestamp:.3f}s (combined: {metrics['combined_similarity']:.3f})")
            else:
                logger.debug(f"No jump cut at {current_frame.timestamp:.3f}s (combined: {metrics['combined_similarity']:.3f})")
        
        logger.info(f"Jump cut detection complete: {len(jump_cut_frames)} jump cuts from {len(frames)} candidates")
        return jump_cut_frames
    
        """
        """
    def _allocate_frames_to_scenes(self, scenes: List[Dict], total_frames: int) -> List[int]:
        """
        Allocate frames to scenes proportionally based on duration.
        Ensures each scene gets at least 1 frame, with longer scenes getting more.
        """
        if not scenes:
            return []
        
        # Calculate total scene duration
        total_duration = sum(scene['duration'] for scene in scenes)
        
        # Allocate frames proportionally (now that we have <= total_frames scenes)
        allocation = []
        frames_allocated = 0
        
        for i, scene in enumerate(scenes):
            if i == len(scenes) - 1:
                # Last scene gets remaining frames
                frames_for_scene = total_frames - frames_allocated
            else:
                # Proportional allocation with minimum 1
                proportion = scene['duration'] / total_duration
                frames_for_scene = max(1, int(proportion * total_frames))
            
            # Cap at reasonable maximum per scene
            frames_for_scene = min(frames_for_scene, 6)  # Reduced max to allow more scenes
            allocation.append(frames_for_scene)
            frames_allocated += frames_for_scene
        
        # If we've allocated too many frames, reduce from scenes with most frames
        while frames_allocated > total_frames:
            # Find scene with most frames and reduce by 1
            max_idx = allocation.index(max(allocation))
            if allocation[max_idx] > 1:  # Don't go below 1
                allocation[max_idx] -= 1
                frames_allocated -= 1
            else:
                break
        
        logger.info(f"Frame allocation: {allocation} (total: {sum(allocation)})")
        
        return allocation
    
    def fill_gaps_between_jump_cuts(self, jump_cut_frames: List[FrameData], video_path: str, video_length: float, target_count: int) -> List[FrameData]:
        """
LEGACY METHOD: Fill scenes (gaps between jump cuts) with frames to capture movement within each scene.
        This method is replaced by sample_scenes_intelligently() but kept for compatibility.
        """
        if not jump_cut_frames:
            # No jump cuts, fall back to regular interval extraction
            return self.extract_interval_frames_to_target(video_path, video_length, target_count)
        
        # Sort jump cuts by timestamp
        jump_cut_frames.sort(key=lambda f: f.timestamp)
        
        # Define scenes based on jump cuts
        scenes = []
        
        # Scene before first jump cut (if exists)
        if jump_cut_frames[0].timestamp > 1.0:  # Only if scene > 1 second
            scenes.append({
                'start': 0.0,
                'end': jump_cut_frames[0].timestamp,
                'duration': jump_cut_frames[0].timestamp,
                'jump_cut_frame': None
            })
        
        # Scenes between consecutive jump cuts
        for i in range(len(jump_cut_frames) - 1):
            start_time = jump_cut_frames[i].timestamp
            end_time = jump_cut_frames[i + 1].timestamp
            duration = end_time - start_time
            
            scenes.append({
                'start': start_time,
                'end': end_time,
                'duration': duration,
                'jump_cut_frame': jump_cut_frames[i]
            })
        
        # Final scene after last jump cut
        last_timestamp = jump_cut_frames[-1].timestamp
        if video_length - last_timestamp > 1.0:  # Only if scene > 1 second
            scenes.append({
                'start': last_timestamp,
                'end': video_length,
                'duration': video_length - last_timestamp,
                'jump_cut_frame': jump_cut_frames[-1]
            })
        else:
            # If final scene is too short, add the last jump cut to the previous scene
            if scenes:
                scenes[-1]['jump_cut_frame'] = jump_cut_frames[-1]
        
        if not scenes:
            logger.info("No scenes found - returning jump cuts only")
            return jump_cut_frames
        
        logger.info(f"Found {len(scenes)} scenes to fill with frames")
        
        # Calculate frames per scene
        total_scene_duration = sum(scene['duration'] for scene in scenes)
        frames_available = target_count - len(jump_cut_frames)
        
        if frames_available <= 0:
            return jump_cut_frames
        
        all_frames = []
        
        # Add frames for each scene
        for i, scene in enumerate(scenes):
            scene_frames = []
            scene_id = i + 1
            
            # Add the jump cut frame that starts this scene (if exists)
            if scene['jump_cut_frame']:
                scene['jump_cut_frame'].scene_id = scene_id
                scene_frames.append(scene['jump_cut_frame'])
            
            # Calculate frames for this scene (proportional to duration, min 1, max 6)
            scene_proportion = scene['duration'] / total_scene_duration
            frames_for_scene = max(1, min(6, int(scene_proportion * frames_available)))
            
            logger.debug(f"Scene {scene_id}: {scene['start']:.1f}s-{scene['end']:.1f}s ({scene['duration']:.1f}s) → {frames_for_scene} frames")
            
            # Add interval frames within the scene
            if frames_for_scene > 0 and scene['duration'] > 2.0:  # Only if scene is long enough
                for j in range(frames_for_scene):
                    if j == frames_for_scene - 1:
                        # Last frame: position towards the end (80-90% of the scene)
                        position_fraction = 0.85 + (0.1 * (j / max(1, frames_for_scene - 1)))
                    else:
                        # Other frames: distribute evenly in first 80% of scene
                        position_fraction = (j + 1) / (frames_for_scene + 1) * 0.8
                    
                    timestamp = scene['start'] + (scene['duration'] * position_fraction)
                    
                    # Make sure we don't exceed scene boundaries
                    if scene['start'] < timestamp < scene['end'] and timestamp < video_length:
                        frame = self.extract_single_frame(video_path, timestamp)
                        if frame:
                            frame.frame_type = 'scene_interval'
                            frame.scene_id = scene_id
                            scene_frames.append(frame)
                            logger.debug(f"  Added scene frame at {timestamp:.3f}s (position: {position_fraction:.2f})")
            
            all_frames.extend(scene_frames)
        
        # Add any remaining jump cut frames that weren't included in scenes
        for jc_frame in jump_cut_frames:
            if not any(jc_frame.timestamp == f.timestamp for f in all_frames):
                all_frames.append(jc_frame)
        
        # Sort all frames by timestamp
        all_frames.sort(key=lambda f: f.timestamp)
        
        logger.info(f"Scene-based extraction complete: {len(scenes)} scenes, {len(all_frames)} total frames")
        return all_frames
    
    def reduce_frames_evenly(self, frames: List[FrameData], target_count: int) -> List[FrameData]:
        """
        Reduce frames by selecting those with the lowest similarity scores (biggest jump cuts).
        This preserves the most significant scene changes.
        """
        if len(frames) <= target_count:
            return frames
        
        if target_count == 1:
            return [frames[0]]
        
        # Sort frames by similarity score (lowest first = biggest jump cuts)
        # Frames with similarity_score of None get a high score (1.0) to be deprioritized
        frames_with_scores = [(frame.similarity_score if frame.similarity_score is not None else 1.0, frame) for frame in frames]
        frames_with_scores.sort(key=lambda x: x[0])  # Sort by similarity score, lowest first
        
        # Select the target_count frames with lowest similarity scores (biggest jump cuts)
        selected_frames = [frame for score, frame in frames_with_scores[:target_count]]
        
        # Sort final selection by timestamp to maintain chronological order
        selected_frames.sort(key=lambda f: f.timestamp)
        
        # Log which frames were selected with their scores
        selected_scores = [f.similarity_score for f in selected_frames]
        logger.info(f"Selected {len(selected_frames)} frames with biggest jump cuts from {len(frames)} candidates")
        logger.info(f"Selected similarity scores (lower = bigger jump cut): {[f'{s:.3f}' if s is not None else 'N/A' for s in selected_scores]}")
        
        return selected_frames

    def extract_interval_frames_to_target(self, video_path: str, video_length: float, target_count: int) -> List[FrameData]:
        """Extract frames at regular intervals to reach target frame count."""
        frames = []
        
        # Calculate interval to get target number of frames
        interval = video_length / (target_count + 1)
        
        logger.info(f"Extracting {target_count} frames with {interval:.2f}s intervals")
        
        for i in range(target_count):
            # Start after first interval to avoid very beginning
            timestamp = (i + 1) * interval
            
            # Make sure we don't go past video length
            if timestamp >= video_length:
                break
            
            frame = self.extract_single_frame(video_path, timestamp)
            
            if frame:
                frame.frame_type = 'interval'
                frames.append(frame)
                logger.debug(f"Frame {i+1}/{target_count} at {timestamp:.2f}s extracted")
        
        logger.info(f"Successfully extracted {len(frames)} interval frames")
        return frames

    def extract_single_frame(self, video_path: str, timestamp: float) -> Optional[FrameData]:
        """Extract a single frame at a specific timestamp."""
        try:
            cmd = [
                self.ffmpeg_path,
                '-ss', str(timestamp),
                '-i', video_path,
                '-frames:v', '1',
                '-f', 'image2pipe',
                '-pix_fmt', 'rgb24',
                '-vcodec', 'rawvideo',
                '-'
            ]
            
            # Get video dimensions
            probe_cmd = [
                self.ffprobe_path, '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0',
                video_path
            ]
            
            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
            dimensions = probe_result.stdout.strip().rstrip('x').split('x')
            width, height = map(int, dimensions)
            
            result = subprocess.run(cmd, capture_output=True, check=True)
            
            if result.stdout:
                frame_array = np.frombuffer(result.stdout, dtype=np.uint8)
                frame_array = frame_array.reshape((height, width, 3))
                
                # Convert RGB to BGR for OpenCV compatibility
                frame_bgr = cv2.cvtColor(frame_array, cv2.COLOR_RGB2BGR)
                
                return FrameData(
                    image=frame_bgr,
                    timestamp=timestamp,
                    frame_type='interval',
                    duration=None
                )
        except Exception as e:
            logger.error(f"Failed to extract frame at {timestamp}s: {e}")
            return None
    
    
    def calculate_frame_durations(self, frames: List[FrameData], video_length: float) -> List[FrameData]:
        """Calculate duration each frame represents in the video."""
        if not frames:
            return frames
            
        for i, frame in enumerate(frames):
            if i == len(frames) - 1:
                # Last frame goes to end of video
                frame.duration = video_length - frame.timestamp
            else:
                # Duration until next frame
                frame.duration = frames[i + 1].timestamp - frame.timestamp
                
        return frames
    
    def group_frames_by_scenes(self, frames: List[FrameData]) -> Dict[int, List[FrameData]]:
        """
        Group frames by their scene_id for scene-based analysis.
        
        Returns:
            Dict mapping scene_id to list of frames in that scene
        """
        scenes = {}
        for frame in frames:
            scene_id = frame.scene_id or 1  # Default to scene 1 if no scene_id
            if scene_id not in scenes:
                scenes[scene_id] = []
            scenes[scene_id].append(frame)
        
        # Sort frames within each scene by timestamp
        for scene_id in scenes:
            scenes[scene_id].sort(key=lambda f: f.timestamp)
        
        logger.info(f"Grouped {len(frames)} frames into {len(scenes)} scenes")
        return scenes