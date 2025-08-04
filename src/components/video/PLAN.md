# Video Assembly Workspace - Implementation Plan

## Overview
Timeline-based video assembly workspace for creating final videos from script chunks with multiple variations, real-time preview, and AI adherence scoring.

## Core Requirements

### Video Assembly Flow
1. **Script Integration**: Import chunks from Script Generation Workspace
2. **Upload System**: File explorer upload for video/image files
3. **Timeline Assembly**: SVG-based timeline with chunk columns
4. **Variant Management**: Multiple versions per chunk type
5. **Export Pipeline**: Client-side preview + server-side final render

### Key Features
- Real-time preview of assembled video paths
- AI scoring for script adherence
- Advanced editing modal (double-click chunks)
- MP4 export format

## Technical Implementation

### Phase 1: Foundation & Core Timeline
**Priority: P1 - Core functionality**

#### SVG Timeline System
- [ ] Create `TimelineCanvas.tsx` - Main SVG container
- [ ] Implement `ChunkColumn.tsx` - Fixed columns for chunk types (Hook, Product, CTA)
- [ ] Build `ChunkNode.tsx` - Individual video chunk with thumbnail
- [ ] Design `ConnectionLine.tsx` - Bézier curves showing selected path
- [ ] Add `AddVariantButton.tsx` - Interface for adding chunk variations

#### Timeline Layout Structure
```typescript
interface TimelineLayout {
  columns: ChunkColumn[];
  selectedPath: string[];
  zoomLevel: number;
  viewportOffset: { x: number; y: number };
}

interface ChunkColumn {
  id: string;
  type: 'hook' | 'product' | 'cta';
  position: { x: number; y: number };
  chunks: VideoChunk[];
}

interface VideoChunk {
  id: string;
  type: ChunkType;
  file?: File;
  thumbnail?: string;
  duration?: number;
  selected: boolean;
  metadata: {
    trimStart?: number;
    trimEnd?: number;
    cropArea?: CropArea;
  };
}
```

#### SVG Rendering Logic
- [ ] Implement cubic Bézier connections: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`
- [ ] Highlight selected path with thick glow effects
- [ ] Dim unused variants with opacity
- [ ] Hover previews and click-to-select interactions

### Phase 2: Video Upload & Management
**Priority: P1 - Core functionality**

#### File Upload System
- [ ] Create `ChunkUploader.tsx` with HTML5 File API
- [ ] Support drag & drop functionality
- [ ] File validation (video/image formats, size limits)
- [ ] Progress tracking for uploads
- [ ] Thumbnail generation from video files

#### File Storage
- [ ] Save uploaded files to `/src/data/mock/videos/` directory
- [ ] Generate unique filenames to prevent conflicts
- [ ] Store file metadata in local storage
- [ ] Create file cleanup utilities

#### Future Enhancement Notes
```typescript
// Future: Video Library Integration
interface VideoLibraryFeature {
  // In-browser library window
  // Search existing videos
  // Upload to library before importing to project
  // Asset organization and tagging
}
```

### Phase 3: Video Preview System
**Priority: P1 - Core functionality**

#### Real-time Preview Engine
**Recommended Approach: Client-side stitching for better UX**

- [ ] Create `VideoPreview.tsx` - Main preview player
- [ ] Implement video concatenation using Web APIs
- [ ] Use `createObjectURL()` for blob handling
- [ ] Canvas API for video frame manipulation
- [ ] Web Audio API for audio synchronization

#### Preview Implementation
```typescript
const useVideoPreview = (selectedChunks: VideoChunk[]) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const generatePreview = useCallback(async () => {
    // Client-side video stitching
    const mediaRecorder = new MediaRecorder(/* combined stream */);
    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    };
  }, [selectedChunks]);
  
  return { previewUrl, generatePreview };
};
```

#### Alternative: Cached Preview Generation
- Server-side lightweight preview generation
- Store preview files temporarily
- Faster for complex timelines

### Phase 4: Advanced Editing Features
**Priority: P2 - Enhancement**

#### Chunk Edit Modal (Double-click Feature)
- [ ] Create `ChunkEditModal.tsx` - Full-screen editing interface
- [ ] Implement `TrimControls.tsx` - Timeline scrubber for start/end points
- [ ] Build `CropControls.tsx` - Video cropping within 9:16 aspect ratio
- [ ] Add metadata editing (labels, version notes)

#### Trim Controls Implementation
```typescript
interface TrimControls {
  startTime: number;      // seconds
  endTime: number;        // seconds
  duration: number;       // total video duration
  onTrimChange: (start: number, end: number) => void;
}

// FFmpeg command for final processing:
// ffmpeg -i input.mp4 -ss ${start} -to ${end} -filter:v "crop=w:h:x:y" output.mp4
```

#### Crop Controls Implementation
```typescript
interface CropArea {
  x: number;         // crop starting x position
  y: number;         // crop starting y position  
  width: number;     // crop width
  height: number;    // crop height (maintains 9:16 ratio)
}
```

### Phase 5: AI Adherence Scoring
**Priority: P1 - Core functionality (Mocked)**

#### Mock Scoring System
- [ ] Create `AdherenceScore.tsx` - Display component for scores
- [ ] Mock scoring endpoint that analyzes script vs video
- [ ] Return numerical rating (0-100) with explanation
- [ ] Provide improvement suggestions

#### API Specification
```typescript
// Mock endpoint: /api/rate-clip
POST {
  chunkId: string;
  videoFile: File;
  scriptText: string;
  context: {
    chunkType: 'hook' | 'product' | 'cta';
    brandGuidelines?: string;
  };
}

RESPONSE {
  score: number;                    // 0-100
  explanation: string;              // "The video matches the script's energetic tone..."
  suggestions: string[];            // ["Consider closer product shots", "Add more enthusiasm"]
  breakdown: {
    contentMatch: number;           // How well content matches script
    toneMatch: number;             // Tone and energy alignment  
    visualMatch: number;           // Visual style consistency
  };
}
```

#### Mock Implementation
```typescript
const mockAdherenceScoring = {
  rateClip: async (chunk: VideoChunk, script: string): Promise<AdherenceScore> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return randomized but realistic scores
    return {
      score: Math.floor(Math.random() * 30) + 70, // 70-100 range
      explanation: generateMockExplanation(chunk.type),
      suggestions: generateMockSuggestions(chunk.type),
      breakdown: {
        contentMatch: Math.floor(Math.random() * 20) + 80,
        toneMatch: Math.floor(Math.random() * 25) + 75,
        visualMatch: Math.floor(Math.random() * 30) + 70
      }
    };
  }
};
```

### Phase 6: Export Pipeline
**Priority: P1 - Core functionality**

#### Export System Architecture
- **Client-side**: Real-time preview generation
- **Server-side**: Final high-quality render with FFmpeg

#### Export Implementation
- [ ] Create export queue system
- [ ] Generate final MP4 with all trim/crop instructions
- [ ] Show export progress with status updates
- [ ] Download functionality for completed videos

#### Export API Specification
```typescript
// Mock endpoint: /api/compile-video
POST {
  projectId: string;
  selectedPath: {
    chunks: VideoChunk[];
    timeline: TimelineConfig;
  };
  exportSettings: {
    resolution: '1080x1920';
    format: 'mp4';
    quality: 'high';
  };
}

RESPONSE {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress?: number;      // 0-100
  downloadUrl?: string;   // Available when completed
}
```

### Phase 7: Timeline Interactions & UX
**Priority: P1 - Core functionality**

#### Interaction Features
- [ ] Drag & drop chunks between columns
- [ ] Click-to-select path highlighting
- [ ] Zoom and pan controls for timeline
- [ ] Keyboard shortcuts for common operations
- [ ] Undo/redo for timeline changes

#### Visual Feedback System
- [ ] Selected path highlighted with colored connections
- [ ] Enlarged nodes on selected path (scale 1.1x)
- [ ] Grayed out unused variants
- [ ] Loading states for all async operations
- [ ] Error states with clear recovery options

### Phase 8: Performance & Optimization
**Priority: P2 - Enhancement**

#### Performance Considerations
- [ ] Lazy loading for video thumbnails
- [ ] Virtual scrolling for large timelines
- [ ] Debounced preview generation
- [ ] Memory management for video objects
- [ ] Cleanup of object URLs

#### Browser Compatibility
- [ ] Modern browser focus (Chrome, Firefox, Safari, Edge)
- [ ] Graceful degradation for unsupported features
- [ ] File format compatibility checks

## Data Models

### Core Interfaces
```typescript
interface VideoProject {
  id: string;
  name: string;
  timeline: Timeline;
  exportSettings: ExportSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface Timeline {
  columns: ChunkColumn[];
  selectedPath: string[];      // Array of chunk IDs
  zoomLevel: number;
  viewportOffset: Point;
}

interface VideoChunk {
  id: string;
  type: 'hook' | 'product' | 'cta';
  file?: File;
  thumbnail?: string;
  duration?: number;
  adherenceScore?: AdherenceScore;
  metadata: ChunkMetadata;
}

interface ChunkMetadata {
  trimStart?: number;
  trimEnd?: number;
  cropArea?: CropArea;
  version?: string;
  notes?: string;
}
```

## Success Criteria

### Functional Requirements
- [ ] Users can upload videos and arrange them on timeline
- [ ] Real-time preview shows selected video path
- [ ] Double-click opens advanced editing modal
- [ ] AI adherence scoring provides useful feedback
- [ ] Export generates MP4 files ready for publishing
- [ ] All timeline interactions are smooth and responsive

### Technical Requirements
- [ ] SVG timeline scales smoothly with zoom
- [ ] Video processing doesn't block UI interactions
- [ ] Client-side preview generation works reliably
- [ ] Mock API endpoints provide realistic responses
- [ ] Export system handles various video formats

### User Experience Requirements
- [ ] Intuitive drag & drop interactions
- [ ] Clear visual feedback for all operations
- [ ] Fast preview generation (< 3 seconds)
- [ ] Helpful error messages and recovery options
- [ ] Responsive design works on different screen sizes

## Development Timeline

**Week 1**: SVG timeline foundation + basic interactions
**Week 2**: Video upload system + file management
**Week 3**: Real-time preview implementation
**Week 4**: Advanced editing modal + trim/crop controls
**Week 5**: AI adherence scoring + mock endpoints
**Week 6**: Export pipeline + performance optimization

## Future Enhancements (Phase 3+)

### Advanced Video Features
- [ ] Video effects and transitions
- [ ] Audio level adjustments
- [ ] Color correction and filters
- [ ] Text overlay and graphics

### Collaboration Features
- [ ] Real-time collaborative editing
- [ ] Version control for video projects
- [ ] Comments and review system
- [ ] Team sharing and permissions

### Integration Features
- [ ] Direct platform publishing (TikTok, Instagram)
- [ ] A/B testing with multiple exports
- [ ] Analytics integration for performance tracking
- [ ] Template system for common video structures

This comprehensive plan provides a roadmap for building a professional-grade video assembly workspace with modern web technologies and scalable architecture.
EOF < /dev/null