# Short-Form Video Ad Creation Platform

A visual, node-based workflow tool for creating short-form video advertisements for Instagram, Facebook, and TikTok. This platform streamlines the entire process from script generation to final video production.

## Overview

This application provides a complete end-to-end solution for creating short-form video ads:
1. **Script Generation** - AI-powered script creation based on product information and examples
2. **Script Editing** - Professional editing interface for refining generated scripts
3. **Video Production** - Timeline-based video assembly with chunk-based recording
4. **Variation Testing** - Multiple versions for A/B testing and optimization

## Key Features

### 🎭 Dual-Mode Workspace

#### Graph View (Scripting Workspace)
- **Visual node-based workflow** for organizing content sources
- **Product Spec Nodes** - Input product documentation and specifications
- **Ad Reference Nodes** - Upload existing ads as examples/inspiration
- **Instruction Nodes** - Add specific requirements or brand guidelines
- **Script Generator Node** - Central AI node that processes all inputs to create 1-3 script variations
- **Visual connections (splines)** show data flow between nodes

#### Static View (Script Editor)
- **Professional text editor** for refining generated scripts
- **Cursor-like editing experience** for familiar workflow
- **Direct access** by clicking scripts within the Script Generator node
- **Content source sidebar** showing all connected nodes for reference

### 🎬 Video Production Workspace

#### Chunk-Based System
Scripts are broken into visual "chunks" - discrete video segments such as:
- **Hook chunks** - Opening attention-grabbers
- **Product shot chunks** - Feature demonstrations
- **CTA chunks** - Call-to-action segments

#### Timeline Assembly
- **Node-based timeline** where each chunk is a node
- **Record and upload** video directly to each chunk node
- **Multiple variations** per chunk type (e.g., 3 different hooks)
- **Vertical stacking** of variations for easy comparison

#### Smart Features
- **Real-time preview** updates as you select different chunk variations
- **Path visualization** shows which chunks combine for final video
- **AI script adherence rating** analyzes how well recordings follow the script
- **Automated suggestions** for improving recordings

### 🔧 Technical Features

- **Shared state management** - Content syncs between all views
- **Smart collision detection** - Intelligent node placement
- **Undo/redo system** - Full history tracking
- **Pan & zoom navigation** - Smooth workspace exploration
- **Theme support** - Light, dark, and experimental color schemes
- **Auto-save** - Persistent project state

## Workflow

### 1. Content Input Phase
```
Product Specs ─┐
               ├─→ Script Generator
Ad Examples ───┤
               │
Instructions ──┘
```

### 2. Script Generation
- Script Generator processes all connected inputs
- Generates 1-3 script variations optimized for short-form video
- Each script is pre-chunked for video production

### 3. Script Refinement
- Click any script to open in Static View
- Edit with full text editor capabilities
- Scripts maintain chunk structure for video phase

### 4. Video Production
```
Hook 1 ─────┐
Hook 2      ├─→ Product 1 ─→ CTA 1 ─┐
Hook 3 ─────┘    Product 2    CTA 2  ├─→ Final Video
                 Product 3 ─→ CTA 3 ─┘
```

### 5. Optimization
- Test different chunk combinations
- AI rates script adherence
- Export multiple variations for A/B testing

## Use Cases

- **E-commerce brands** creating product showcase videos
- **Marketing agencies** producing client ad campaigns
- **Content creators** streamlining video ad production
- **Social media managers** generating platform-specific content

## Technology Stack

- **Frontend**: React with Tailwind CSS
- **State Management**: React hooks with shared state architecture
- **Visualization**: SVG for node connections
- **Build**: Vite

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Future Enhancements

- Direct platform publishing (Instagram, TikTok, Facebook)
- Analytics integration for performance tracking
- Team collaboration features
- Template marketplace
- AI voice-over generation
- Automated video editing suggestions

---

Built for modern marketers who need to create compelling short-form video content at scale.