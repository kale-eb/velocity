# Backend Documentation

## Application Purpose
**Marketing App Backend** - Comprehensive backend service for the Short-Form Video Ad Creation Platform, providing AI-powered video analysis, intelligent script assistance through OpenAI Agents API, and content processing capabilities.

## Architecture Overview

The backend is designed as a multi-service system handling distinct but integrated functions:

### Core Services
- **Express.js API Server** - Main application server with RESTful endpoints
- **OpenAI Agents System** - Advanced AI assistant for script editing and workspace interaction
- **Video Analysis Pipeline** - Python-based video processing with AI analysis
- **File Processing Service** - PDF document processing and content extraction

### Technology Stack
- **Node.js + Express.js** - Primary API server and routing
- **OpenAI Agents API** - Advanced AI assistance with tool calling
- **Python + FastAPI** - Video processing and AI analysis
- **GPT-5/GPT-4o** - AI models for different use cases
- **OpenAI Whisper** - Audio transcription
- **FFmpeg + OpenCV** - Video and image processing

## Directory Structure

```
backend/
├── CLAUDE.md                        # This documentation file
├── README.md                        # Setup and usage guide
├── server.js                        # Express.js API server
├── package.json                     # Node.js dependencies
├── .env.example                     # Environment template
│
├── agents/                          # OpenAI Agents API System
│   ├── CLAUDE.md                   # Agents system documentation
│   ├── endpoint.js                 # Agents request handler
│   ├── scriptAgent.js              # Agent configuration
│   └── tools.js                    # Custom agent tools
│
├── config/                          # Configuration Management
│   ├── app_config.json            # Application settings
│   └── prompts.json               # AI prompts and instructions
│
├── ad_processing/                   # Video Analysis (Python)
│   ├── CLAUDE.md                  # Video processing docs
│   ├── __init__.py                # Module initialization
│   ├── frame_extractor.py         # Frame extraction logic
│   ├── audio_analyzer.py          # Audio transcription
│   ├── ad_analyzer.py             # AI video analysis
│   └── video_compressor.py        # Video downloading/compression
│
├── video_outputs/                   # Analysis Results
│   ├── analysis_*.json            # AI analysis outputs
│   └── archive/                   # Historical data
│
├── process_video.py                 # Video processing pipeline
├── main.py                         # FastAPI server
└── requirements.txt                # Python dependencies
```

## Component Overview

### 1. Express.js API Server (`server.js`)

**Purpose**: Main application server providing RESTful API endpoints for the frontend React application.

**Key Endpoints:**
- **`/api/chat/agents`** - OpenAI Agents API integration for script assistance
- **`/api/generateScript`** - Script generation with mock/AI support
- **`/api/analyzeAd`** - Video analysis pipeline integration
- **`/api/getAnalysis`** - Retrieve cached video analysis results
- **`/process-pdf`** - PDF document processing and text extraction

**Features:**
- **Extended Timeouts** - 15-minute timeouts for video processing operations
- **CORS Support** - Cross-origin requests for frontend integration
- **File Upload Handling** - Multipart form processing for PDFs
- **Error Handling** - Comprehensive error responses with debugging info
- **Request Logging** - Detailed request/response logging for debugging

**Integration Points:**
- Proxies video analysis requests to Python FastAPI server
- Handles OpenAI Agents API conversations with tool calling
- Manages file uploads and forwards to Python processing
- Serves cached analysis results from video_outputs directory

### 2. OpenAI Agents System (`agents/`)

**Purpose**: Advanced AI assistant system providing intelligent script editing, workspace guidance, and natural language interaction.

#### Agent Architecture
- **Model**: GPT-5 for high-quality, nuanced responses
- **Tools**: 7 specialized tools for script and workspace management
- **Conversation**: Maintains context across multi-turn interactions
- **Streaming**: Real-time response streaming with tool status updates

#### Tool System (`tools.js`)
**Workspace Discovery Pattern:**
- **`listWorkspaceContents`** - Discover available content (metadata only)
- **`readWorkspaceContent`** - Access specific content by ID

**Script Management:**
- **`getCurrentScript`** - Analyze current script state and structure
- **`suggestScriptChanges`** - Propose structured modifications with explanations

**Context and Help:**
- **`getScriptEditingContext`** - Load script system understanding
- **`getWorkspaceHelp`** - UI and workspace interaction guidance
- **`discoverCapabilities`** - Tool discovery and help system

#### Key Features
- **Two-Tool Content Access** - Efficient discovery + selective loading
- **Structured Proposals** - JSON-formatted script changes with user control
- **Content Prioritization** - Focus on selected sources while accessing all content
- **Tool Status Streaming** - Real-time feedback during tool execution
- **Context Awareness** - Maintains conversation history and workspace state

### 3. Video Analysis Pipeline (`ad_processing/`, `process_video.py`)

**Purpose**: AI-powered analysis of short-form video advertisements with comprehensive content understanding.

#### Processing Workflow
1. **Video Download** - Multi-platform support (Instagram, TikTok, YouTube, etc.)
2. **Frame Extraction** - Scene-based jump cut detection (~30 frames per video)
3. **Audio Processing** - OpenAI Whisper transcription with timestamps
4. **AI Analysis** - GPT-4o structured analysis with scene understanding
5. **JSON Output** - Structured data ready for frontend consumption

#### Analysis Components
- **`frame_extractor.py`** - Intelligent scene detection and frame selection
- **`audio_analyzer.py`** - Audio transcription and processing
- **`ad_analyzer.py`** - AI-powered content analysis and categorization
- **`video_compressor.py`** - Video downloading and compression

#### Output Format
Structured JSON with detailed analysis:
```json
{
  "summary": "Overall video description and style",
  "visualStyle": "Visual characteristics and aesthetics",
  "audioStyle": "Audio elements and tone",
  "duration": 62.3,
  "chunks": [
    {
      "id": "chunk_1",
      "type": "hook|body|cta",
      "startTime": 0.0,
      "endTime": 5.2,
      "visual": {
        "description": "Detailed scene description",
        "cameraAngle": "Camera positioning analysis",
        "lighting": "Lighting conditions and mood",
        "movement": "Motion and dynamic elements",
        "textOverlay": "On-screen text content",
        "background": "Background elements and setting"
      },
      "audio": {
        "transcript": "Exact spoken content",
        "tone": "Voice tone and emotion",
        "backgroundMusic": "Musical elements",
        "volume": "Audio level analysis"
      }
    }
  ]
}
```

### 4. Configuration Management (`config/`)

#### Prompts Configuration (`prompts.json`)
**Script Generation Instructions:**
- **Video Type Guidelines** - JUMP_CUTS, B_ROLL, A_ROLL_WITH_OVERLAY, SPLIT_SCREEN
- **Section Structure** - HOOK, BODY, CTA organization
- **Camera Instructions** - Natural language direction formatting
- **Shot Guidelines** - Variety and professional direction standards

**Workspace Help Content:**
- **UI Interaction Patterns** - How users interact with workspace elements
- **Content Source Management** - File handling and organization
- **Selection System** - How highlighting and focus work
- **Assistant Workflow** - Best practices for AI interaction

**Agent Instructions:**
- **Response Style** - Concise, helpful communication patterns
- **Tool Usage** - When and how to use different tools
- **Context Handling** - Managing conversation flow and workspace state

#### Application Settings (`app_config.json`)
- **Video Processing Limits** - Duration, file size, frame count restrictions
- **API Configuration** - Model selection, timeout settings, rate limits
- **Analysis Parameters** - Jump cut thresholds, quality settings
- **Processing Optimization** - Performance and resource management

## Data Flow Architecture

### Frontend ↔ Backend Integration
```
React Frontend
    ↓ HTTP Requests
Express.js Server
    ↓ Tool Calls
OpenAI Agents API
    ↓ Video Processing
Python FastAPI
    ↓ AI Analysis
GPT-4o + Whisper
    ↓ Results
JSON Storage → Frontend
```

### Agent Conversation Flow
```
User Message
    ↓
Agent Processing
    ↓
Tool Discovery (listWorkspaceContents)
    ↓
Content Access (readWorkspaceContent)
    ↓
Script Analysis (getCurrentScript)
    ↓
Change Proposals (suggestScriptChanges)
    ↓
Structured Response → Frontend
```

### Video Analysis Pipeline
```
Video URL Input
    ↓
Multi-platform Download
    ↓
Scene Detection & Frame Extraction
    ↓
Audio Transcription (Whisper)
    ↓
AI Analysis (GPT-4o)
    ↓
Structured JSON Output
    ↓
Cache & Serve to Frontend
```

## Development Workflow

### Local Development Setup
1. **Environment Configuration** - API keys and service endpoints
2. **Dependency Installation** - Node.js and Python packages
3. **Service Startup** - Express server + Python video processing
4. **Testing** - Endpoint testing and video analysis validation

### API Testing
- **Agent Conversations** - Test tool calling and response streaming
- **Video Analysis** - Validate processing pipeline with real videos
- **File Processing** - Test PDF upload and text extraction
- **Error Handling** - Verify graceful failure and recovery

### Integration Points
- **Frontend Communication** - RESTful API and real-time streaming
- **OpenAI API Integration** - Agents API and direct model calls
- **Python Service Communication** - Express ↔ FastAPI coordination
- **File System Management** - Upload handling and result caching

## Security & Performance

### Security Measures
- **API Key Management** - Environment variable configuration
- **Input Validation** - Request sanitization and parameter checking
- **CORS Configuration** - Controlled cross-origin access
- **File Upload Limits** - Size and type restrictions
- **Error Information** - Controlled error disclosure

### Performance Optimizations
- **Timeout Management** - Appropriate timeouts for different operations
- **Content Caching** - Video analysis result caching
- **Selective Loading** - Two-tool content access pattern
- **Stream Processing** - Real-time response streaming
- **Resource Management** - Python process lifecycle management

## Monitoring & Debugging

### Logging Systems
- **Request Logging** - Comprehensive request/response tracking
- **Agent Tool Execution** - Real-time tool status and results
- **Video Processing** - Frame-by-frame analysis logging
- **Error Tracking** - Detailed error context and stack traces

### Debug Tools
- **Agent Conversation Logs** - Tool calling and response analysis
- **Video Processing Debug** - Frame extraction and analysis validation
- **Performance Metrics** - Processing times and resource usage
- **Integration Testing** - End-to-end workflow validation

## Future Architecture Enhancements

### Scalability Improvements
- **Database Integration** - Move from file storage to PostgreSQL/Supabase
- **Microservice Architecture** - Separate video processing and agent services
- **Load Balancing** - Multiple instance support for high traffic
- **Background Processing** - Queue system for video analysis
- **Caching Layer** - Redis for frequently accessed data

### Feature Extensions
- **Advanced Video Types** - Support for complex video structures
- **Collaboration Features** - Multi-user editing and workspace sharing
- **Analytics Integration** - Usage tracking and performance monitoring
- **API Versioning** - Backward compatibility and feature evolution
- **Webhook System** - External integration and event notifications

This backend architecture provides a solid foundation for the marketing app while maintaining flexibility for future growth and feature additions.