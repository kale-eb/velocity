# Video Assembly Workspace Documentation

## Application Purpose
**Short-form video ad creation platform** - Video components implement the timeline-based video assembly workspace where users create final videos from script chunks.

## Planned Component Structure

### timeline/
**SVG-based timeline interface** for chunk-based video assembly:
- `TimelineCanvas.jsx` - Main SVG container with zoom/pan controls
- `ChunkColumn.jsx` - Fixed columns for each chunk type (Hook, Product, CTA)
- `ChunkNode.jsx` - Individual video chunk with thumbnail and controls
- `ConnectionLine.jsx` - Bézier curve connections showing selected path
- `AddVariantButton.jsx` - Interface for adding chunk variations

### preview/
**Real-time video preview system**:
- `VideoPreview.jsx` - Main preview player with assembled video
- `AdherenceScore.jsx` - AI scoring display for script-to-video matching

### editing/
**Modal-based video editing interface**:
- `ChunkEditModal.jsx` - Full-screen editing modal for individual chunks
- `TrimControls.jsx` - Video trimming interface with timeline scrubber
- `CropControls.jsx` - Video cropping within fixed 9:16 aspect ratio

### upload/
**Video upload and processing**:
- `ChunkUploader.jsx` - Drag-and-drop file upload with progress tracking

## Key Features
- **Chunk-based Assembly**: Build videos by selecting and connecting chunk variants
- **Multiple Variations**: Support for A/B testing with different chunk combinations
- **AI Scoring**: Automated adherence rating comparing video to script chunks
- **Real-time Preview**: Instant preview updates as users select different paths
- **Export Pipeline**: FFmpeg integration for final video compilation

## Technical Implementation
- SVG-based timeline for scalable, interactive interface
- Blob URL handling for client-side video preview
- WebGL/Canvas integration for advanced video effects
- Server-side FFmpeg processing for final export