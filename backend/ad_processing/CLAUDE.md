# Ad Processing Module Documentation

## Overview
The `ad_processing` module is a sophisticated video analysis pipeline designed for extracting and analyzing short-form video advertisements from social media platforms. It combines intelligent frame extraction, audio transcription, and AI-powered content analysis to produce structured JSON data for marketing insights.

## Core Components

### 1. Frame Extractor (`frame_extractor.py`)
**Purpose**: Intelligent extraction of key frames from videos using jump cut detection

**Key Features**:
- **Multi-metric Similarity Analysis**:
  - Perceptual Hash (75%): DCT-based structural comparison
  - Histogram Comparison (25%): Color distribution analysis
  - Delta Intensity: Brightness change measurement with veto system
  - D-Hash: Texture variation detection (informational)

- **Jump Cut Detection Algorithm**:
  ```python
  def _is_jump_cut(frame1, frame2, threshold=0.73):
      combined_sim = _combined_similarity(frame1, frame2)
      delta_intensity = _delta_intensity(frame1, frame2)
      
      initial_jump_cut = combined_sim < threshold
      delta_veto = delta_intensity > 0.9  # Veto if too similar
      
      return initial_jump_cut and not delta_veto
  ```

- **Scene-Based Gap Filling**: Automatically fills gaps between jump cuts to reach target frame count
- **Configurable Compression**: Optimized for API token usage (512px, 70% quality)

**Configuration**:
- Jump cut threshold: 0.73
- Target frames: 20 per video
- Max frames: 30 per video
- Delta intensity veto: >0.9 similarity

### 2. Audio Analyzer (`audio_analyzer.py`)
**Purpose**: Extract and transcribe audio using OpenAI Whisper

**Key Features**:
- Automatic audio extraction from video files
- Whisper API integration for accurate transcription
- Timestamped transcript segments
- Full transcript generation

**Process**:
1. Extract audio track using FFmpeg
2. Convert to optimal format (16kHz, mono, PCM)
3. Submit to Whisper API
4. Parse timestamped segments

### 3. Ad Analyzer (`ad_analyzer.py`)
**Purpose**: AI-powered analysis using GPT-4 Vision

**Key Features**:
- **Optimized Token Usage**:
  - 512px images @ 70% JPEG quality
  - 255 tokens per image (66.7% reduction)
  - 20 frames per batch (single API call for most videos)

- **Multi-Pass Processing**: Handles videos with >20 jump cuts
- **Structured JSON Output**: Consistent format for frontend consumption

**Output Structure**:
```json
{
  "id": "ad_identifier",
  "url": "source_url",
  "summary": "overview",
  "visualStyle": "visual description",
  "audioStyle": "audio description",
  "duration": 91.23,
  "entities": {
    "people": [
      {
        "id": "presenter",
        "role": "content creator",
        "appearance": "detailed description",
        "demographics": "age, gender, etc"
      }
    ],
    "products": [
      {
        "id": "main_product",
        "name": "product name",
        "description": "detailed description",
        "category": "category"
      }
    ],
    "locations": [
      {
        "id": "location_1",
        "type": "setting type",
        "description": "detailed description",
        "lighting": "lighting style"
      }
    ]
  },
  "chunks": [
    {
      "id": "chunk_001",
      "type": "shot",
      "startTime": 0.0,
      "endTime": 8.67,
      "visual": {
        "subjects": ["presenter", "main_product"],
        "location": "location_1",
        "action": "what's happening",
        "subjectChanges": {
          "presenter": "changes from base",
          "main_product": "how it's shown"
        },
        "cameraAngle": "shot description",
        "movement": "camera/subject movement",
        "textOverlay": "any text",
        "newElements": "one-off items"
      },
      "audio": {...}
    }
  ]
}
```

**Key Benefits of Entity-Based Structure**:
- **Reduced Redundancy**: Describe recurring elements once in entities section
- **Smaller Output**: Reference entities by ID instead of re-describing
- **Better Organization**: Clear separation of static vs. dynamic elements
- **Easier Processing**: Frontend can cache entity data and apply changes
- **Token Efficiency**: Significantly reduces GPT-4 output tokens

### 4. Video Compressor (`video_compressor.py`)
**Purpose**: Download and compress videos for processing

**Key Features**:
- Multi-platform support (Instagram, TikTok, YouTube, etc.)
- Automatic compression to 5MB limit
- Format standardization (MP4, H.264)
- Bitrate optimization

## Processing Pipeline

```
1. Video Input (URL/Path)
   ↓
2. Download & Compress (if needed)
   ↓
3. Frame Extraction
   ├── Jump Cut Detection (6 FPS sampling)
   ├── Delta Intensity Veto
   └── Scene-Based Gap Filling
   ↓
4. Audio Extraction & Transcription
   ├── FFmpeg Audio Extraction
   └── Whisper API Transcription
   ↓
5. AI Analysis
   ├── Frame Compression (512px, 70% quality)
   ├── Batch Processing (≤20 frames)
   └── GPT-4 Vision Analysis
   ↓
6. Structured JSON Output
```

## Configuration Files

### `config/app_config.json`
```json
{
  "video_processing": {
    "jump_cut_threshold": 0.73,
    "target_frames_per_video": 20,
    "max_frames_per_video": 30
  },
  "api": {
    "max_frames_per_batch": 20,
    "frame_image_max_size": 512,
    "frame_image_quality": 70
  }
}
```

### `config/prompts.json`
Contains system and user prompts for GPT-4 analysis, structured to ensure consistent JSON output.

## Performance Optimizations

### Token Usage (per 20 frames)
- **Before**: 8,120 tokens (8 frames @ 1024px)
- **After**: 7,100 tokens (20 frames @ 512px)
- **Improvement**: 2.5x more frames in similar token budget

### Processing Speed
- **Before**: Multiple API calls with context passing
- **After**: Single API call for most videos (≤20 jump cuts)
- **Improvement**: 3-4x faster for typical videos

### Jump Cut Accuracy
- **Delta Intensity Veto**: Prevents false positives from lighting changes
- **75% Perceptual Hash**: Better structural change detection
- **0.73 Threshold**: More sensitive to actual scene changes

## Debug Tools

### `debug_jump_cuts.py`
Unified debug interface for jump cut detection analysis:
- Real-time frame comparison
- Similarity metric visualization
- Veto status display
- Interactive threshold adjustment
- HTML report generation

**Usage**:
```bash
# Load existing report
python debug_jump_cuts.py

# Process new video
python debug_jump_cuts.py "https://instagram.com/reel/..."
```

### `estimate_tokens.py`
Token usage calculator for different compression settings:
- Estimates tokens per image
- Calculates total API costs
- Validates context window limits

## Error Handling

**Analysis Failures**: No longer creates fallback data - returns proper HTTP errors instead:
- **422 ANALYSIS_PARSING_FAILED**: AI response could not be parsed as JSON
- **422 FRAME_ENCODING_ERROR**: Frame encoding/image processing issues 
- **429 RATE_LIMITED**: OpenAI rate limit exceeded
- **408 ANALYSIS_TIMEOUT**: Analysis timed out (video too complex)
- **500 ANALYSIS_FAILED**: General analysis failure

**Video Processing Limits**:
- **Video Duration Limit**: 95 seconds max
- **File Size Limit**: 5MB after compression
- **Download Errors**: 400 UNSUPPORTED_URL or DOWNLOAD_FAILED
- **Retry Logic**: Automatic retries with exponential backoff

**Quality Assurance**: System fails fast rather than producing low-quality fallback data

## Future Improvements

1. **Adaptive Compression**: Dynamic quality based on content complexity
2. **Scene Classification**: ML-based scene type detection
3. **Audio Analysis**: Music tempo and emotion detection
4. **Batch Processing**: Multiple videos in parallel
5. **Caching Layer**: Redis for processed frame data

## Dependencies

- **OpenAI**: GPT-4 Vision API, Whisper API
- **FFmpeg**: Video/audio processing
- **OpenCV**: Image processing and comparison
- **Pillow**: Image compression and format conversion
- **yt-dlp**: Multi-platform video downloading
- **NumPy**: Numerical operations for similarity metrics

## Testing

Run the processing pipeline:
```bash
python process_video.py "https://www.instagram.com/reel/..."
```

Debug jump cut detection:
```bash
python debug_jump_cuts.py "video_url_or_path"
```

Estimate token usage:
```bash
python estimate_tokens.py
```

## Important Notes

- Always check token usage before increasing batch sizes
- Monitor delta intensity veto rates for false positive prevention
- Keep frame compression settings balanced (quality vs. tokens)
- Use debug tools to validate jump cut detection accuracy