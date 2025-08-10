"""
Advertisement Processing Module

This module contains all the components for processing video advertisements:
- Frame extraction with scene detection
- Audio transcription and analysis
- Advertisement analysis and structured output
- Video compression and format conversion
"""

from .frame_extractor import ViralFrameExtractor, FrameData
from .audio_analyzer import AudioExtractor, AudioExtraction, TranscriptSegment
from .ad_analyzer import AdAnalyzer
from .video_compressor import VideoCompressor

__all__ = [
    'ViralFrameExtractor',
    'FrameData',
    'AudioExtractor', 
    'AudioExtraction',
    'TranscriptSegment',
    'AdAnalyzer',
    'VideoCompressor'
]