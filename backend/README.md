# Marketing App Backend

Backend service for processing and analyzing video advertisements using AI-powered scene detection, audio transcription, and structured analysis.

## Features

- **Scene-based frame extraction** with jump cut detection at 6 FPS
- **Audio transcription** using OpenAI Whisper
- **Advertisement analysis** with structured JSON output (hook/body/cta)
- **Video compression** to base64 format (≤5MB)
- **90-second video limit** for performance optimization

## Project Structure

```
backend/
├── .env                          # Environment variables (sensitive)
├── .env.example                  # Environment variables template
├── requirements.txt              # Python dependencies
├── config/
│   ├── settings.py              # Configuration management
│   ├── app_config.json          # Application settings
│   └── prompts.json            # AI analysis prompts
└── ad_processing/
    ├── __init__.py             # Module exports
    ├── frame_extractor.py      # Scene-based frame extraction
    ├── audio_analyzer.py       # Audio transcription
    ├── ad_analyzer.py          # Advertisement analysis
    └── video_compressor.py     # Video download & compression
```

## Configuration

### Environment Variables (.env)
Only sensitive information and environment-specific settings:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Environment
ENVIRONMENT=development

# Server Configuration  
HOST=localhost
PORT=8000
DEBUG=true

# Logging
LOG_LEVEL=INFO

# File Storage (environment-specific paths)
TEMP_DIR=/tmp/marketing_app
OUTPUT_DIR=./outputs
```

### Application Configuration (config/app_config.json)
Application settings that can be version controlled:

```json
{
  "video_processing": {
    "max_video_duration": 90,
    "max_video_size_mb": 5,
    "target_frames_per_video": 20,
    "jump_cut_threshold": 0.60
  },
  "api": {
    "timeout": 300,
    "openai_model": "gpt-4o",
    "max_tokens": 4000
  }
}
```

## Setup

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

5. **Test the setup:**
   ```bash
   python test_scene_extraction.py
   ```

## Usage

### Frame Extraction
```python
from ad_processing import ViralFrameExtractor

extractor = ViralFrameExtractor()
frames = extractor.extract_frames("video.mp4")

# Group by scenes
scenes = extractor.group_frames_by_scenes(frames)
```

### Advertisement Analysis
```python
from ad_processing import AdAnalyzer, AudioExtractor

# Extract audio
audio_extractor = AudioExtractor()
audio_data = audio_extractor.extract_audio("video.mp4")

# Analyze advertisement
analyzer = AdAnalyzer()
analysis = await analyzer.analyze_advertisement(
    frames=frames,
    audio_extraction=audio_data,
    original_url="https://example.com/video"
)
```

### Video Compression
```python
from ad_processing import VideoCompressor

compressor = VideoCompressor()
base64_video = compressor.download_and_compress_video("https://example.com/video")
```

## Configuration Management

The system uses a two-tier configuration approach:

- **Environment Variables (.env)**: Sensitive data (API keys) and environment-specific settings
- **Application Config (app_config.json)**: Business logic settings that can be version controlled

This separation ensures:
- Secrets aren't committed to version control
- Application settings can be easily modified and tracked
- Different environments can have different configurations

## API Key Management

All modules consistently handle the OpenAI API key:
1. Check for explicitly passed key
2. Fall back to `OPENAI_API_KEY` environment variable
3. Raise error if neither is provided

## Dependencies

- **FastAPI**: Web framework
- **OpenAI**: AI processing
- **OpenCV**: Image processing
- **yt-dlp**: Video downloading
- **python-dotenv**: Environment variable loading

## Development

- Run tests: `python test_scene_extraction.py`
- Check configuration: Validate all settings load correctly
- Add new configs: Update `app_config.json` and `settings.py`