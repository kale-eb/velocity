# Changelog

All notable changes to the Short-Form Video Ad Creation Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for Phase 1
- Chunk-based script editing (3 versions per chunk)
- Enhanced Graph View for script generation flow
- Video Assembly Workspace implementation

## [0.5.0] - 2025-01-09 - Enhanced File Management & PDF Processing

### 🗂️ Major Improvement: Advanced File Management System

### Added
- **PDF Processing Backend Integration**
  - Python FastAPI backend with PyPDF2 for robust PDF text extraction
  - Express.js proxy server handling multipart file uploads
  - Raw PDF byte transmission to avoid CORS and boundary parsing issues
  - Support for PDF, TXT, CSV, JSON, and Markdown files

- **Enhanced File Management UI**
  - Individual file cards displaying filename, size, page count, and upload date
  - Right-click context menu for file deletion with confirmation
  - File processing status indicators (Processed/Failed with error messages)
  - Dropdown expansion to view all uploaded files in scrollable container
  - "Clear All" functionality to remove all files at once

- **Separated Data Architecture**
  - Raw extracted text stored separately in `extractedTexts` array for AI processing
  - File metadata stored in `uploadedFiles` array for UI display
  - Combined content string for seamless AI script generation
  - Unique file IDs for reliable tracking and deletion

- **Script Generation Integration**
  - Manual script generation with "Generate Script" button
  - Full PDF content integration (4,000+ characters) with OpenAI GPT-5
  - AI-powered script editing chat integration with tool access
  - Comprehensive logging for API calls and tool usage
  - Chat assistant access to product specs, ads, and instructions via tools

### Enhanced
- **Backend Services**
  - Express server with multer middleware for file upload handling
  - Python FastAPI with `/process-pdf-raw` endpoint for direct PDF processing  
  - Comprehensive error handling and debugging for file processing pipeline
  - CORS-safe file processing without browser-side PDF parsing

- **User Experience**
  - File cards show actual uploaded documents instead of raw text content
  - Visual feedback for processing status and file information
  - Intuitive right-click deletion with confirmation dialogs
  - File count display in collapsed card headers
  - Scrollable file list with proper theming (light/dark/experimental)

### Fixed
- **PDF Processing CORS Issues**
  - Eliminated client-side PDF.js worker CORS conflicts
  - Implemented reliable server-side PDF text extraction
  - Fixed multipart boundary parsing between Express and Python services
  - Resolved file upload failures with proper error handling

- **Data Management**
  - Fixed content duplication when adding multiple files
  - Proper file deletion removes both metadata and extracted text
  - Correct file indexing for text extraction synchronization
  - Enhanced error handling for failed file processing

### Technical Improvements
- **Processing Pipeline**: Frontend → Express (multipart) → Python (raw bytes) → Text extraction
- **File Structure**: Unique IDs, timestamps, success status, error messages, page counts
- **AI Integration**: Full document content available for script generation context
- **Performance**: Efficient file processing with proper cleanup and error recovery

### Dependencies Added
```json
{
  "multer": "^2.0.2",
  "form-data": "^4.0.4",
  "PyPDF2": "^3.0.1",
  "python-multipart": "^0.0.20"
}
```

**Status: ✅ ENHANCED FILE MANAGEMENT - Professional document handling with full PDF processing**

## [0.4.2] - 2025-01-08 - Token Usage Optimization

### 💰 API Token Optimization for Single-Call Processing

### Added
- **Configurable Image Compression Settings**
  - `frame_image_max_size`: Configurable max image dimension (default 512px)
  - `frame_image_quality`: JPEG compression quality (default 70)
  - `max_frames_per_batch`: Frames per API call (default 20)
- **Token Usage Estimator**: Script to calculate and compare token usage across different settings

### Changed
- **Image Compression**: Reduced from 1024px/85 quality to 512px/70 quality
- **Batch Size**: Increased from 8 to 20 frames per API call
- **Token Efficiency**: 66.7% reduction in tokens per image (765 → 255 tokens)

### Optimized
- **Single API Call**: Most videos (≤20 jump cuts) now process in one API call
- **Cost Reduction**: Similar token usage while processing 2.5x more frames
- **Processing Speed**: Eliminated multi-pass delays for typical videos

## [0.4.1] - 2025-01-08 - Enhanced Jump Cut Detection

### 🔧 Jump Cut Detection Improvements

### Added
- **Delta Intensity Veto System**
  - New `_delta_intensity()` similarity metric measuring brightness changes
  - Intelligent jump cut veto: frames with >0.9 delta intensity similarity bypass jump cut detection
  - Prevents false positives from subtle lighting/exposure changes within same scene

### Changed
- **Updated Similarity Weighting**: Perceptual hash increased to 75% (from 70%), histogram reduced to 25% (from 30%)
- **Threshold Adjustment**: Jump cut threshold raised from 0.65 to 0.73 for increased sensitivity
- **Enhanced Debug Interface**: 
  - Unified debug tool (consolidated from 3 separate tools)
  - Real-time veto status display showing initial detection vs final result
  - Updated UI to reflect new 75%/25% weighting

### Fixed
- **Debug Tool Consolidation**: Removed redundant tkinter and static HTML generators, kept web-based tool
- **JSON Serialization**: Fixed NumPy boolean serialization errors in debug interface
- **Scoring Consistency**: Debug tool now uses identical jump cut logic as production pipeline

### Technical Details
- New `_is_jump_cut()` function combines similarity threshold with delta intensity veto
- Debug tool generates `jump_cut_debug_report.html` with embedded frame analysis
- Enhanced logging shows veto statistics and detailed frame-by-frame decisions

## [0.4.0] - 2024-08-07 - Backend Processing Pipeline Complete

### 🚀 Major Addition: Advertisement Analysis Backend

### Added
- **Complete Backend Processing System**
  - Node.js Express server with comprehensive middleware stack
  - Video download support for YouTube, TikTok, Instagram, Twitter, Vimeo, Facebook, Twitch
  - Intelligent frame extraction using FFmpeg with duplicate removal
  - OpenAI Whisper integration for accurate audio transcription
  - GPT-4o powered advertisement analysis with structured output

- **Core Backend Services**
  - `VideoDownloader` - Multi-platform video downloading with yt-dlp
  - `FrameExtractor` - Smart scene-based frame extraction (max 30 frames)
  - `AudioTranscriber` - OpenAI Whisper API integration with timestamped segments
  - `AdAnalyzer` - GPT-4o analysis producing structured JSON output
  - `AdProcessor` - Pipeline orchestrator with concurrent processing

- **API Endpoints Implementation**
  - `/analyze-ad` - **Primary endpoint from description.md** - Structured JSON output for Script Generation Workspace
  - `/analyze-url` - Viral analysis with markdown output
  - `/analyze-upload` - Direct file upload processing
  - `/validate-url` - URL validation without processing
  - `/status` - Service health monitoring
  - `/supported-domains` - Platform compatibility information

- **Structured JSON Output**
  - Matches exact format from mock data files (fashion-lifestyle-ad.json, tech-product-ad.json, skincare-ugc-ad.json)
  - Automatic chunk detection and classification (hook, body, cta)
  - Detailed visual analysis (camera angles, lighting, movement, text overlays)
  - Comprehensive audio analysis (transcription, tone, background music, volume)
  - Ready for immediate frontend integration

### Technical Architecture
- **Production-Ready Infrastructure**
  - Comprehensive error handling with detailed debugging information
  - Rate limiting system (configurable: 100 requests per 15 minutes)
  - Security middleware (Helmet, CORS, input validation)
  - Structured logging with color-coded levels
  - Graceful shutdown handling and resource cleanup

- **Processing Pipeline**
  ```
  URL Input → Video Download → Frame Extraction ↘
                                              → AI Analysis → Structured JSON
  File Upload → Validation → Audio Transcription ↗
  ```

- **Performance Optimizations**
  - Concurrent frame extraction and audio transcription
  - Perceptual hash duplicate frame removal (85% similarity threshold)
  - Smart frame selection based on video duration
  - Automatic temporary file cleanup
  - Token usage and cost tracking

### Configuration & Deployment
- **Environment Configuration**
  - Complete .env.example with all required variables
  - Configurable processing limits (duration, file size, frame count)
  - OpenAI API integration with cost tracking
  - Development and production environment support

- **Documentation & Testing**
  - Comprehensive README with API documentation and examples
  - Interactive test script (`npm run backend:test`)
  - Example responses showing structured JSON format
  - Integration commands (`npm run backend:install`, `npm run backend:dev`)

### Integration Ready
- **Script Generation Workspace Integration**
  - JSON output directly consumable by React frontend
  - Chunk data ready for script generation context
  - Visual and audio metadata for creative inspiration
  - Perfect alignment with existing node-based architecture

- **Cost & Performance Metrics**
  - Typical processing time: 20-60 seconds
  - Token usage: 2000-4000 tokens per video
  - Estimated cost: $0.01-0.05 per analysis
  - Support for videos up to 5 minutes, 100MB file size

### Dependencies Added
```json
{
  "express": "^4.18.2",
  "openai": "^4.20.1", 
  "yt-dlp-wrap": "^3.0.1",
  "ffmpeg-static": "^5.2.0",
  "fluent-ffmpeg": "^2.1.2",
  "sharp": "^0.32.6"
}
```

**Status: ✅ BACKEND COMPLETE - Ready for Frontend Integration**

## [0.3.1] - 2024-08-05 - Documentation & GitHub Integration

### Added
- **Database Documentation**
  - Comprehensive database structure explanation with schema details
  - Database service layer documentation (`src/services/database/CLAUDE.md`)
  - Updated services documentation with implemented PostgreSQL features
  - Enhanced store documentation reflecting database integration

### Enhanced
- **CLAUDE.md Files Updated**
  - Services documentation now includes implemented database service layer
  - Store documentation reflects PostgreSQL integration and type safety
  - Database-specific documentation with migration strategies and performance details

### Infrastructure
- **GitHub Repository Setup**
  - Remote repository configuration for version control
  - Professional commit history with detailed technical documentation
  - Preparation for collaborative development workflow

### Documentation Improvements
- Detailed database schema architecture explanation
- Type-safe service layer documentation
- Migration path documentation (Local PostgreSQL → Supabase)
- Performance optimization strategies and indexing details

## [0.3.0] - 2024-08-04 - Phase 0 Complete: TypeScript Migration & Database Infrastructure

### 🎉 Major Milestone: Phase 0 Foundation Complete

### Added
- **PostgreSQL Database Infrastructure**
  - PostgreSQL 15 installation and configuration
  - Complete database schema with UUID support, triggers, and indexes
  - Database service layer with full CRUD operations for projects, scripts, workspace states
  - Analyzed ads caching system for performance
  - Database initialization and reset scripts (`npm run db:init`, `npm run db:reset`)
  - Migration-ready architecture for seamless Supabase deployment

- **TypeScript Migration Complete**
  - Converted all core components to TypeScript (.tsx)
  - Comprehensive type definitions in `/src/types/index.ts`
  - Legacy NodeBasedWorkspace.jsx migrated to TypeScript
  - Build system fully configured for TypeScript compilation

- **Zustand State Management System**
  - Complete migration from component state to centralized stores
  - Four comprehensive stores: `workspaceStore`, `scriptStore`, `uiStore`, `projectStore`
  - State persistence with Zustand middleware and local storage
  - Automatic workspace state synchronization

- **Development Infrastructure**
  - Git repository initialization with professional commit structure
  - Database scripts and tooling integration
  - Environment configuration with .env.example
  - PostgreSQL Node.js client (pg) with TypeScript types
  - tsx for TypeScript execution

### Enhanced
- **Workspace Functionality**
  - Fixed reorganize nodes layout with proper coordinate system
  - Instructions positioned in 2x2 grid below script generator
  - Product spec centered above script generator
  - Ads in vertical column on left, centered around y=0
  - Spline connections rendering correctly with new state management

- **Node Management**
  - Complete integration with Zustand stores
  - Auto-connection logic for new nodes
  - Node type limits enforcement (1 product spec, 6 ads, 4 instructions, 1 script)
  - Proper node initialization and default data structures

### Technical Improvements
- Database schema compatible with Supabase for production migration
- Professional development workflow with comprehensive documentation
- Type-safe React components with proper interfaces
- Centralized state management reducing component complexity
- Persistent workspace state across browser sessions

### Documentation
- Comprehensive project restructure with feature-based architecture
- Documentation system with CLAUDE.md files for each component area
- Detailed implementation plans (PLAN.md) for Script Generation and Video Assembly workspaces
- Mock data infrastructure with three sample ad analysis JSON files:
  - `skincare-ugc-ad.json` - UGC style with authentic testimonial format
  - `tech-product-ad.json` - Fast-paced product showcase with rapid cuts
  - `fashion-lifestyle-ad.json` - Cinematic luxury brand storytelling

### Infrastructure Ready
- Local development environment fully configured
- Database operations tested and functional
- State management architecture scalable for complex features
- Type system providing development confidence and error prevention
- Professional git workflow with descriptive commits

**Status: ✅ READY FOR PHASE 1 - Script Generation Workspace**

## [0.2.1] - 2024-08-04 - Workspace Stability & State Management

### Fixed
- NodeBasedWorkspaceFixed integration with Zustand stores
- Spline connections rendering with proper node data
- Reorganize nodes functionality with correct coordinate system
- Node initialization preventing duplicate creation in React StrictMode

### Enhanced
- Improved workspace state synchronization
- Better error handling for undefined node positions
- Enhanced debugging with comprehensive logging

## [0.2.0] - 2024-XX-XX - Current Implementation

### Added
- Node-based visual workspace with drag & drop functionality
- Advanced collision detection and smart node positioning
- Reorganize feature with predefined layout algorithms
- Dual interface modes (Graph View and Static View)
- Traditional sidebar-based script editing interface
- Integrated AI chat functionality with mock responses
- Comprehensive theme system (light, dark, experimental)
- Zoom and pan controls with dynamic bounds management
- Undo/redo system with 20-action history
- SVG spline connections between nodes
- Viewport state persistence across view switches

### Technical Improvements
- React 18 with modern hooks architecture
- Tailwind CSS for rapid UI development
- Sophisticated coordinate transformation system
- Performance optimizations with React.memo
- Dynamic canvas bounds with auto-expansion
- Screen-to-workspace coordinate mapping

### Components Implemented
- `WorkspaceContainer.jsx` - Main orchestrator component
- `NodeBasedWorkspaceFixed.jsx` - Advanced visual editor
- `StaticScriptView.jsx` - Traditional editing interface
- Various node types (ProductSpec, Ad, Instructions, ScriptGenerator)

## [0.1.0] - 2024-XX-XX - Initial Foundation

### Added
- Basic React application setup with Vite
- Initial workspace concept
- Basic node-based editing prototype
- Tailwind CSS integration
- Project structure and build system

### Infrastructure
- Vite build system configuration
- ESLint code quality setup
- Basic responsive design framework
- Development tooling and scripts

---

## Roadmap

### Phase 1: Foundation Enhancement
- [ ] Implement page-based routing
- [ ] Create Home Dashboard
- [ ] Build Content Database interface
- [ ] Migrate to global state management

### Phase 2: Video Assembly Workspace
- [ ] SVG timeline implementation
- [ ] Video chunk upload and management
- [ ] Real-time preview system
- [ ] Export pipeline with FFmpeg

### Phase 3: AI Integration
- [ ] Backend API integration
- [ ] Real AI script generation
- [ ] Video adherence scoring
- [ ] Advanced content analysis

### Phase 4: Production Features
- [ ] User authentication system
- [ ] Project collaboration
- [ ] Platform publishing integration
- [ ] Analytics and performance tracking

### Phase 5: Advanced Features
- [ ] A/B testing capabilities
- [ ] Template marketplace
- [ ] Advanced video effects
- [ ] Multi-language support

---

## Contributing

When making changes to this project:

1. **Update this changelog** with all notable changes
2. **Follow semantic versioning** for version numbers
3. **Document breaking changes** clearly
4. **Update component CLAUDE.md files** for affected areas
5. **Test changes** across different workspaces and themes

## Version Number Guidelines

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions  
- **PATCH** version for backwards-compatible bug fixes
- **Unreleased** section for changes not yet released