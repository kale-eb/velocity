# Script Generation Workspace - Implementation Plan

## Overview
Complete implementation of the AI-powered script generation workspace with Graph View (node-based) and Static View (traditional editor) that integrates seamlessly for professional script creation.

## Core Requirements

### Script Generation Flow
1. **Prerequisite**: Nodes must be connected to Script Generator in Graph View
2. **Manual Trigger**: "Generate Script" button initiates process  
3. **Single Script**: Maximum 1 script per Script Generator node
4. **Chunk Variations**: Each script chunk can have up to 3 different versions
5. **Locked Interaction**: No typing or chat until script is generated

### AI Integration Requirements
- AI chat must directly edit script content in Static View
- Context-aware editing based on selected content sources
- Seamless integration with chunk-based editing system

## Technical Implementation

### Phase 1: Foundation & TypeScript Migration
**Priority: P0 - Prerequisites**

#### TypeScript Conversion
- [ ] Convert existing components to TypeScript
- [ ] Create comprehensive type definitions
- [ ] Update build configuration

#### State Management Migration
- [ ] Install Zustand: `npm install zustand`
- [ ] Create script store with persistence
- [ ] Migrate from React state to global store

### Phase 2: Mock Data & API Layer
**Priority: P1 - Core functionality**

#### Mock Ad Analysis Data
Create 3 sample JSON files in `/src/data/mock/`:
- `skincare-ugc-ad.json` (UGC Style)
- `tech-product-ad.json` (Fast-paced Product Shots)  
- `fashion-lifestyle-ad.json` (Cinematic Lifestyle)

#### API Service Layer
- Mock analyze-ad endpoint
- Mock script generation endpoint
- Mock AI chat editing endpoint

### Phase 3: Graph View Enhancements
**Priority: P1 - Core functionality**

#### Script Generation Integration
- [ ] Add "Generate Script" button to Script Generator node
- [ ] Validate node connections before allowing generation
- [ ] Show loading state during generation
- [ ] Display script status in node

#### Enhanced Node Features
- [ ] Ad Node URL input for analysis
- [ ] Analysis status indicators
- [ ] Browser caching for analyzed ads

### Phase 4: Static View Complete Overhaul
**Priority: P1 - Core functionality**

#### Chunk-Based Script Editor
Replace current textarea with sophisticated chunk system supporting:
- 3 versions per chunk
- Camera direction metadata
- Visual notes and annotations
- Chunk reordering capabilities

#### UI Components Needed
- [ ] `ChunkEditor.tsx` - Main chunk editing interface
- [ ] `ChunkVersionSelector.tsx` - Toggle between 3 versions
- [ ] `ChunkMetadataEditor.tsx` - Camera directions, notes
- [ ] `ScriptPreview.tsx` - Read-only preview of full script

### Phase 5: AI Chat Integration
**Priority: P1 - Core functionality**

#### AI SDK Options
**Recommended: Vercel AI SDK**
- Seamless React integration
- Multiple provider support
- Built-in streaming and UI helpers

#### Chat Features Implementation
- [ ] Context integration with selected content sources
- [ ] Direct script editing from AI responses
- [ ] Chunk-specific operations (rewrite, add, generate alternatives)

### Phase 6: Data Persistence & Caching
**Priority: P1 - Core functionality**

#### Local Storage Strategy
- Browser storage for session data
- Cache API for analyzed ads
- Local project persistence

#### Database Service Layer (Placeholder)
- Empty functions for future Supabase integration
- Project save/load operations

## API Endpoints Specification

### Mock Endpoints
- `/api/analyze-ad` - Analyze ad URL and return detailed breakdown
- `/api/generate-script` - Generate script from connected nodes
- `/api/edit-chunk` - AI-powered chunk editing (returns up to 3 versions)

## Success Criteria

### Functional Requirements
- [ ] Users can analyze ad URLs and see detailed breakdowns
- [ ] Scripts generate only after manual button click
- [ ] Each script chunk supports 3 versions with easy switching
- [ ] AI chat directly modifies script content
- [ ] All data persists across browser sessions

### Technical Requirements  
- [ ] Full TypeScript implementation
- [ ] Zustand state management with persistence
- [ ] Mock API endpoints with realistic delays
- [ ] Browser caching for analyzed ads

## Development Timeline

**Week 1**: TypeScript migration + Zustand setup
**Week 2**: Mock data creation + API layer  
**Week 3**: Graph View enhancements + script generation
**Week 4**: Static View overhaul + chunk editor
**Week 5**: AI integration + chat implementation
**Week 6**: Data persistence + testing + polish
EOF < /dev/null