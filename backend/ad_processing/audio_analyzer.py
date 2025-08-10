"""
Audio Analyzer for Marketing App Backend
Copied and adapted from viral-content-analyzer
"""

import os
import subprocess
import tempfile
import time
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from pathlib import Path
import logging
from openai import OpenAI

# Import settings
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config.settings import settings

# Configure logging
logger = logging.getLogger(__name__)

def get_ffmpeg_paths():
    """Get ffmpeg and ffprobe binary paths"""
    import shutil
    
    # First, check if system binaries are available
    ffmpeg_sys = shutil.which('ffmpeg')
    ffprobe_sys = shutil.which('ffprobe')
    
    if ffmpeg_sys and ffprobe_sys:
        return ffmpeg_sys, ffprobe_sys
    
    # Try static-ffmpeg (includes both ffmpeg and ffprobe)
    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()  # Add to PATH
        
        # Test if they're now available
        ffmpeg_static = shutil.which('ffmpeg')
        ffprobe_static = shutil.which('ffprobe')
        
        if ffmpeg_static and ffprobe_static:
            return ffmpeg_static, ffprobe_static
            
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Error with static-ffmpeg: {e}")
    
    # Try imageio-ffmpeg (only ffmpeg)
    try:
        import imageio_ffmpeg
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Check for ffprobe in same directory
        ffmpeg_dir = os.path.dirname(ffmpeg_path)
        potential_ffprobe = os.path.join(ffmpeg_dir, 'ffprobe')
        
        if os.name == 'nt' and not potential_ffprobe.endswith('.exe'):
            potential_ffprobe += '.exe'
            
        if os.path.exists(potential_ffprobe):
            return ffmpeg_path, potential_ffprobe
        else:
            # Use system ffprobe if available
            ffprobe_sys = shutil.which('ffprobe')
            if ffprobe_sys:
                return ffmpeg_path, ffprobe_sys
        
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Error with imageio-ffmpeg: {e}")
    
    # Final fallback to system binaries (might not exist)
    logger.warning("Using system binary fallback - may not work if not installed")
    return 'ffmpeg', 'ffprobe'


@dataclass
class TranscriptSegment:
    """Container for transcript segment with timing"""
    start: float
    end: float
    text: str
    confidence: Optional[float] = None

@dataclass
class AudioExtraction:
    """Container for audio extraction results"""
    duration: float
    transcript_segments: List[TranscriptSegment]
    full_transcript: str
    error: Optional[str] = None

class AudioExtractor:
    """
    Simple audio extractor for advertisement analysis.
    
    ONLY extracts transcript segments with timestamps.
    NO analysis - that happens later in the pipeline.
    """
    
    def __init__(self, 
                 openai_api_key: str = None,
                 ffmpeg_path: str = None,
                 enable_speech_analysis: bool = False):
        """
        Initialize the audio extractor.
        
        Args:
            openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
            ffmpeg_path: Path to ffmpeg binary (auto-detected if None)
            enable_speech_analysis: Disabled - OpenAI doesn't support audio analysis
        """
        self.openai_api_key = openai_api_key or settings.OPENAI_API_KEY
        if not self.openai_api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY env var or pass openai_api_key parameter.")
        
        self.client = OpenAI(api_key=self.openai_api_key)
        
        # Auto-detect ffmpeg path if not provided
        if ffmpeg_path is None:
            detected_ffmpeg, _ = get_ffmpeg_paths()
            self.ffmpeg_path = detected_ffmpeg
        else:
            self.ffmpeg_path = ffmpeg_path
        self.enable_speech_analysis = enable_speech_analysis
        
        # Audio extraction settings optimized for speech
        self.audio_settings = {
            'sample_rate': 16000,  # 16kHz for Whisper
            'channels': 1,  # Mono
            'codec': 'pcm_s16le'  # 16-bit PCM
        }
    
    def extract_audio_from_video(self, video_path: str) -> str:
        """
        Extract audio from video file to temporary WAV file.
        
        Returns:
            str: Path to temporary audio file
        """
        logger.info(f"Extracting audio from video: {video_path}")
        
        # Create temporary audio file
        fd, temp_audio_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        
        try:
            # Build ffmpeg command
            cmd = [
                self.ffmpeg_path,
                '-i', video_path,
                '-vn',  # No video
                '-acodec', self.audio_settings['codec'],
                '-ar', str(self.audio_settings['sample_rate']),
                '-ac', str(self.audio_settings['channels']),
                '-y',  # Overwrite output
                temp_audio_path
            ]
            
            # Execute ffmpeg
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
                raise RuntimeError("Audio extraction produced empty file")
            
            logger.info(f"Audio extracted successfully: {os.path.getsize(temp_audio_path)} bytes")
            return temp_audio_path
            
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg failed: {e.stderr}")
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
            raise RuntimeError(f"Audio extraction failed: {e.stderr}")
        except Exception as e:
            logger.error(f"Audio extraction error: {e}")
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
            raise
    
    def transcribe_audio(self, audio_path: str) -> List[TranscriptSegment]:
        """
        Transcribe audio using OpenAI Whisper API with timestamps.
        
        Returns:
            List of transcript segments with timing information
        """
        logger.info("Starting Whisper transcription...")
        
        try:
            with open(audio_path, 'rb') as audio_file:
                # Use Whisper API with segment-level timestamps
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",  # Get timestamps
                    timestamp_granularities=["segment"],  # Segment timestamps only
                    language="en",  # Specify language for better accuracy
                    temperature=0.0  # Zero temperature for most deterministic output
                )
            
            # Convert response to TranscriptSegment objects
            segments = []
            
            # Common Whisper hallucinations on music/silence
            HALLUCINATION_PATTERNS = [
                'thanks for watching',
                'thank you for watching', 
                'thanks so much for watching',
                'please subscribe',
                'like and subscribe',
                'bye bye',
                'you',
                'thank you',
                'thanks',
                '.'
            ]
            
            # Check if the entire transcript might be a hallucination
            full_text = response.text.strip().lower()
            is_likely_hallucination = any(pattern in full_text for pattern in HALLUCINATION_PATTERNS) and len(full_text) < 50
            
            # Check if we got any segments
            if hasattr(response, 'segments') and response.segments and not is_likely_hallucination:
                for segment in response.segments:
                    # Only include segments with actual text content
                    text = segment.text.strip()
                    text_lower = text.lower()
                    
                    # Skip common hallucinations and very short segments
                    if (text and 
                        text_lower not in ['', ' ', '[music]', '[silence]'] and
                        not any(pattern == text_lower for pattern in HALLUCINATION_PATTERNS) and
                        len(text) > 2):
                        
                        # Check confidence if available
                        confidence = getattr(segment, 'avg_logprob', None)
                        if confidence is None or confidence > -1.5:  # Only include confident segments
                            segments.append(TranscriptSegment(
                                start=segment.start,
                                end=segment.end,
                                text=text,
                                confidence=confidence
                            ))
            
            # If no segments found, log a warning
            if not segments:
                logger.warning("No speech segments detected in audio - might be music only or silent")
                # Return a single segment indicating no speech
                duration = 0.0
                try:
                    # audio_path is the parameter passed to transcribe_audio
                    import os
                    if os.path.exists(audio_path):
                        duration = self.get_audio_duration(audio_path)
                except Exception as e:
                    logger.warning(f"Could not get audio duration: {e}")
                    duration = 10.0  # Default duration
                
                segments.append(TranscriptSegment(
                    start=0.0,
                    end=duration,
                    text="[No speech detected - background music/sounds only]",
                    confidence=0.0
                ))
            
            logger.info(f"Transcription complete: {len(segments)} segments")
            return segments
            
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            raise RuntimeError(f"Transcription failed: {e}")
    
    
    def get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration using ffprobe."""
        try:
            # Use auto-detected ffprobe path
            _, ffprobe_path = get_ffmpeg_paths()
            
            result = subprocess.run([
                ffprobe_path, '-v', 'error', '-show_entries',
                'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
                audio_path
            ], capture_output=True, text=True, check=True)
            
            return float(result.stdout.strip())
        except Exception as e:
            logger.warning(f"Could not get audio duration: {e}")
            return 0.0
    
    
    def extract_audio(self, video_path: str) -> AudioExtraction:
        """
        Extract audio transcript with timestamps.
        
        This is the main entry point - ONLY extracts, NO analysis.
        
        Args:
            video_path: Path to video file
            
        Returns:
            AudioExtraction object with transcript segments
        """
        logger.info(f"Starting audio extraction for: {video_path}")
        start_time = time.time()
        
        temp_audio_path = None
        
        try:
            # Step 1: Extract audio from video
            temp_audio_path = self.extract_audio_from_video(video_path)
            
            # Step 2: Get audio duration
            duration = self.get_audio_duration(temp_audio_path)
            
            # Step 3: Transcribe audio with Whisper
            transcript_segments = self.transcribe_audio(temp_audio_path)
            
            # Step 4: Build full transcript
            full_transcript = " ".join(segment.text for segment in transcript_segments)
            
            processing_time = time.time() - start_time
            logger.info(f"Audio extraction complete in {processing_time:.2f}s")
            
            return AudioExtraction(
                duration=duration,
                transcript_segments=transcript_segments,
                full_transcript=full_transcript
            )
            
        except Exception as e:
            logger.error(f"Audio extraction failed: {e}")
            return AudioExtraction(
                duration=0.0,
                transcript_segments=[],
                full_transcript="",
                error=str(e)
            )
        finally:
            # Clean up temporary audio file
            if temp_audio_path and os.path.exists(temp_audio_path):
                try:
                    os.remove(temp_audio_path)
                    logger.info("Cleaned up temporary audio file")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file: {e}")