# Views Components Documentation

## Application Purpose
**Marketing content creation platform** for short-form video ads. Views provide alternative interfaces to interact with the same workspace data - currently includes a traditional sidebar-based editor with enhanced file management system as an alternative to the visual node system.

## Components

### EnhancedStaticScriptView.tsx - Advanced Script Editor with File Management

**Purpose**: Sidebar-based interface for script editing and content management with professional file handling system, alternative to the visual node-based workspace.

**Props**: `nodes[]`, `colorScheme`, `onAddNode/Update/Delete`, `chatExpanded`, `onToggleChat`

**Enhanced State Management:**
- File upload handling with backend integration
- Individual file metadata tracking and deletion
- Script generation with OpenAI GPT-5 integration
- AI chat with tool access to all content sources
- Ad analysis with video embedding capabilities

**Advanced File Management:**
- **PDF Processing Pipeline**: Express → Python FastAPI → PyPDF2 text extraction
- **File Cards UI**: Individual cards showing filename, size, page count, upload date
- **Right-Click Deletion**: Context menu for intuitive file removal with confirmation
- **Processing Status**: Visual indicators for successful/failed file processing
- **Separated Data Storage**: UI metadata separate from AI-processed content

**Core Functions:**
- `handleFileUpload()`: Multi-file processing with backend integration
- `handleDeleteFile()`: Remove files from both UI and backend data
- `handleGenerate()`: AI script generation using all selected content
- `handleAnalyzeAd()`: Video URL analysis with caching
- AI chat with tool calling for dynamic content access

**UI Layout:**
- **Left Sidebar**: Enhanced content sources with file management
  - File cards with processing status and metadata
  - Dropdown expansion to view all uploaded files
  - Upload buttons and clear functionality
- **Main Area**: Script editor with generation controls and delete functionality
- **Right Chat Panel**: AI assistant with full context access

**File Processing Features:**
- **Supported Formats**: PDF, TXT, CSV, JSON, Markdown files
- **CORS-Safe Processing**: Backend PDF extraction avoiding browser limitations  
- **Error Handling**: Comprehensive error display and recovery
- **File Organization**: Scrollable file lists with proper theming

**Data Architecture:**
```typescript
{
  uploadedFiles: [     // UI display metadata
    {
      id: string,
      name: string, 
      size: number,
      type: string,
      uploadedAt: string,
      success: boolean,
      error?: string,
      pageCount?: number
    }
  ],
  extractedTexts: string[],  // Raw extracted content
  content: string            // Combined text for AI processing
}
```

**Node Organization:**
- Filters nodes by type: `productSpecs`, `ads`, `instructions`
- **Business Rules**: Product specs (unlimited files), ads (max 6), instructions (max 4)
- **Display**: Shows file count and processing status instead of character count

**Theme System:**
Three modes with dynamic gradients and dot patterns - light (gray/blue), dark (black/purple), experimental (black/yellow)

## Integration & Data Flow

**Architecture:** `WorkspaceContainer` (master state) → `StaticScriptView` (filtered interface) → callbacks → updates

**Key Integration:**
- Receives filtered nodes (excludes script generator type)
- All operations via parent callbacks (`onAddNode`, `onUpdateNode`, `onDeleteNode`)
- Chat state managed locally, theme/visibility shared with container
- Seamless switching with Graph View using same underlying data

**Performance & UX:**
- Proper event listener cleanup, responsive design with collapsible/resizable panels
- Visual feedback (disabled states at limits, hover effects, delayed AI responses)
- Keyboard shortcuts and accessibility support

This component provides an effective traditional alternative to the node-based interface while maintaining full feature parity and data consistency.