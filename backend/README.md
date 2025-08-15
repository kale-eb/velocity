# Marketing App Backend

Comprehensive backend service for the Short-Form Video Ad Creation Platform, featuring AI-powered video analysis, OpenAI Agents API integration, and intelligent script assistance.

## Architecture Overview

The backend serves multiple core functions:
- **Video Analysis Pipeline**: AI-powered analysis of short-form video ads with frame extraction and content understanding
- **OpenAI Agents System**: Advanced script editing assistance with tool calling and interleaved conversation
- **Express.js API Server**: RESTful endpoints for frontend integration
- **File Processing**: PDF document processing and content extraction

## Project Structure

```
backend/
├── server.js                        # Express.js API server with endpoints
├── package.json                     # Node.js dependencies and scripts
├── .env.example                     # Environment variables template
│
├── agents/                          # OpenAI Agents API System
│   ├── endpoint.js                  # Agents API request handler
│   ├── scriptAgent.js               # Script assistant agent configuration
│   └── tools.js                     # Agent tools (workspace access, script editing)
│
├── config/                          # Configuration Management
│   ├── app_config.json             # Application settings
│   └── prompts.json                # AI prompts and script generation instructions
│
├── ad_processing/                   # Video Analysis Pipeline (Python)
│   ├── __init__.py                 # Module exports
│   ├── frame_extractor.py          # Scene-based frame extraction
│   ├── audio_analyzer.py           # Audio transcription with OpenAI Whisper
│   ├── ad_analyzer.py              # Advertisement analysis with GPT-4o
│   ├── video_compressor.py         # Video download & compression
│   └── CLAUDE.md                   # Video processing documentation
│
├── video_outputs/                   # Processed video analysis results
│   ├── analysis_*.json             # AI analysis outputs
│   └── archive/                    # Historical analysis data
│
├── process_video.py                 # Complete video processing pipeline
├── main.py                         # FastAPI video processing server
└── requirements.txt                # Python dependencies
```

## Core Systems

### 1. OpenAI Agents API Integration

**Location**: `agents/`

Advanced AI assistant system for script editing and workspace interaction:

#### Agent Configuration (`scriptAgent.js`)
- **Model**: GPT-5 for high-quality responses
- **Specialized Tools**: 7 custom tools for script and workspace management
- **Instructions**: Concise, focused assistance for video script creation

#### Tools System (`tools.js`)
- **`getScriptEditingContext`**: Load script system understanding
- **`getWorkspaceHelp`**: UI and workspace guidance
- **`getCurrentScript`**: Analyze current script state
- **`suggestScriptChanges`**: Propose structured script modifications
- **`listWorkspaceContents`**: Discover available content (metadata only)
- **`readWorkspaceContent`**: Access specific content by ID
- **`discoverCapabilities`**: Tool discovery and help system

#### Key Features
- **Two-Tool Workspace Access**: Discovery + selective content loading
- **Structured Script Changes**: JSON-formatted proposals with accept/reject workflow
- **Interleaved Tool Calling**: Natural conversation with tool execution
- **Content Prioritization**: Focus on user-selected sources while accessing all content

### 2. Express.js API Server

**Location**: `server.js`

Main application server handling:

#### Core Endpoints
- **`/api/chat/agents`**: OpenAI Agents API integration for script assistance
- **`/api/generateScript`**: Mock script generation (development fallback)
- **`/api/analyzeAd`**: Video analysis pipeline integration
- **`/api/getAnalysis`**: Retrieve cached video analysis results
- **`/process-pdf`**: PDF document processing and text extraction

#### Features
- **Timeout Management**: Extended timeouts (15 minutes) for video processing
- **Error Handling**: Comprehensive error responses with debugging information
- **CORS Support**: Cross-origin requests for frontend integration
- **File Upload**: Multipart form handling for PDF processing

### 3. Video Analysis Pipeline

**Location**: `ad_processing/`, `process_video.py`

AI-powered video content analysis:

#### Processing Flow
1. **Video Download**: Multi-platform support (Instagram, TikTok, YouTube)
2. **Frame Extraction**: Scene-based jump cut detection (~30 frames per video)
3. **Audio Transcription**: OpenAI Whisper API integration
4. **AI Analysis**: GPT-4o structured analysis with scene understanding
5. **JSON Output**: Structured data for frontend consumption

#### Analysis Output
```json
{
  "summary": "Video description and style analysis",
  "chunks": [
    {
      "type": "hook|body|cta",
      "startTime": 0.0,
      "endTime": 5.2,
      "visual": {
        "description": "Scene description",
        "cameraAngle": "Camera positioning",
        "lighting": "Lighting analysis",
        "movement": "Motion description"
      },
      "audio": {
        "transcript": "Spoken content",
        "tone": "Voice analysis",
        "backgroundMusic": "Audio elements"
      }
    }
  ]
}
```

### 4. Configuration Management

**Location**: `config/`

#### Prompts Configuration (`prompts.json`)
- **Script Generation**: Instructions for AI script creation
- **Video Type Guidelines**: JUMP_CUTS, B_ROLL, A_ROLL_WITH_OVERLAY, SPLIT_SCREEN
- **Camera Instructions**: Natural language direction formatting
- **Workspace Help**: UI guidance and interaction patterns

#### Application Settings (`app_config.json`)
- **Video Processing**: Duration limits, frame targets, quality settings
- **API Configuration**: Model selection, timeout settings
- **Analysis Parameters**: Jump cut thresholds, processing limits

## Environment Setup

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.8+)
- **OpenAI API Key**

### Installation

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Set up Python environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL_CHAT=gpt-5
OPENAI_MODEL_CHAT_ACTIONS=gpt-5-mini

# Server Configuration
EXPRESS_PORT=5174
BACKEND_URL=http://localhost:8000

# Video Processing
USE_CHROME_COOKIES=false
```

## Usage

### Development

1. **Start Express server:**
   ```bash
   npm run dev
   # or
   node server.js
   ```

2. **Start Python video processing server:**
   ```bash
   python main.py
   ```

3. **Test video analysis:**
   ```bash
   python process_video.py "https://instagram.com/reel/example"
   ```

### API Examples

#### Script Assistance (Agents API)
```javascript
const response = await fetch('/api/chat/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Help me improve this script",
    script: { sections: [...] },
    workspaceNodes: [...],
    chatHistory: [...]
  })
});
```

#### Video Analysis
```javascript
const response = await fetch('/api/analyzeAd', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: "https://instagram.com/reel/example"
  })
});
```

## Agent Tools Deep Dive

### Discovery Pattern
The two-tool workspace system provides efficient content access:

1. **`listWorkspaceContents`**: Browse available content
   ```json
   {
     "contents": [
       {
         "id": "node_123",
         "type": "productSpec",
         "fileCount": 3,
         "hasContent": true
       }
     ]
   }
   ```

2. **`readWorkspaceContent`**: Load specific content
   ```json
   {
     "nodeIds": ["node_123", "node_456"]
   }
   ```

### Script Change Proposals
Structured modifications with user control:
```json
{
  "explanation": "Suggested improvements to hook",
  "actions": [
    {
      "type": "rewrite",
      "targetId": "section_1",
      "script_text": "New engaging opening",
      "shots": [...]
    }
  ]
}
```

## Video Processing Configuration

### Jump Cut Detection
- **Threshold**: 0.73 similarity score
- **Metrics**: 75% perceptual hash + 25% histogram comparison
- **Target**: ~30 significant frames per video
- **Scene-based**: Intelligent gap filling with positioning strategy

### Analysis Quality
- **Model**: GPT-4o for structured outputs
- **Frame Encoding**: Direct in-memory base64 conversion
- **Audio**: OpenAI Whisper for transcription
- **Duration**: Support for 60-90 second videos

## Development & Testing

### Scripts
```bash
npm run dev              # Start Express server in development
npm run backend:install  # Install Python dependencies
npm run backend:test     # Test video processing pipeline
```

### Debugging
- **Agent Conversations**: Detailed logging in `/api/chat/agents`
- **Video Processing**: Frame-by-frame analysis with debug outputs
- **Tool Execution**: Real-time tool status and result logging

## Architecture Benefits

- **Modular Design**: Separate concerns for video, script, and API handling
- **Scalable Tools**: Easy addition of new agent capabilities
- **Efficient Content Access**: Discovery + selective loading pattern
- **Structured AI Responses**: JSON-formatted proposals with user control
- **Production Ready**: Comprehensive error handling and logging

## Future Enhancements

- **Database Integration**: Replace localStorage with PostgreSQL/Supabase
- **Advanced Video Types**: Support for more complex video structures
- **Collaboration Features**: Multi-user script editing and sharing
- **Performance Optimization**: Caching and background processing
- **Analytics Integration**: Usage tracking and performance metrics