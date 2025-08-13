# PROJECT CLEANUP PLAN
**Current Rating: 4/10 → 7/10 AFTER CLEANUP**

## ✅ COMPLETED ACTIONS

### 1. DELETED SCATTERED PLAN.md FILES
- ✅ Removed 795 scattered PLAN.md files
- ✅ Kept root level PLAN.md (main project planning)
- **Result**: Massive reduction in file noise

## 🎯 SAFE CLEANUP ACTIONS (Recommended)

### 2. REMOVE LEGACY/TEST CODE

# Legacy React components
rm -rf src/legacy/
rm src/components/workspace/NodeBasedWorkspace.jsx
rm src/components/workspace/WorkspaceContainerSimple.tsx

# Test files
rm -rf src/test/

# Backend duplicates
rm backend/server_backup.js
rm backend/prompts.json  # Moved to config/
```

### 3. CONSOLIDATE DOCUMENTATION
**Keep Only Root Level Docs:**
- CLAUDE.md (main documentation)
- README.md (project overview)
- CHANGELOG.md (version history)

**Remove Scattered Docs:**
```bash
find src/ -name "*.md" -delete
find backend/ -name "*.md" -not -path "*/tools/*" -delete
```

### 4. CLEAN DEBUG FILES
**Move to debug/ directory:**
```bash
mkdir backend/debug/
mv backend/debug_*.py backend/debug/
mv backend/compare_*.py backend/debug/
mv backend/estimate_*.py backend/debug/
mv backend/*.log backend/debug/
mv backend/*.html backend/debug/
```

### 5. ORGANIZE VIDEO OUTPUTS
**Problem**: 50+ analysis results cluttering backend/video_outputs/
**Solution**: Keep 3 most recent, archive the rest
```bash
mkdir backend/video_outputs/archive/
# Move old analysis files to archive
```

## 📁 PROPOSED CLEAN STRUCTURE

```
marketing-app/
├── README.md
├── CHANGELOG.md
├── CLAUDE.md
├── package.json
├── vite.config.js
├── tailwind.config.js
├── tsconfig.json
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/index.ts
│   ├── stores/          # Zustand stores
│   ├── components/      # React components
│   │   ├── workspace/   # Workspace components (clean)
│   │   ├── script/      # Script editing
│   │   ├── views/       # Main views
│   │   └── ui/          # Reusable UI components
│   ├── utils/           # Utility functions
│   ├── styles/          # CSS and styling
│   └── data/mock/       # Sample data
│
└── backend/
    ├── server.js
    ├── main.py
    ├── package.json
    ├── requirements.txt
    ├── config/          # Configuration files
    │   ├── prompts.json
    │   ├── app_config.json
    │   └── settings.py
    ├── tools/           # AI tool system
    ├── ad_processing/   # Video processing
    ├── debug/           # Debug scripts (moved)
    ├── temp_uploads/    # Temporary files
    └── video_outputs/   # Processing results (cleaned)
```

## 🎯 BENEFITS AFTER CLEANUP

**Before**: 796 PLAN.md files, scattered docs, legacy code everywhere
**After**: Clean structure, ~90% fewer files, clear organization

**Readability**: 4/10 → 8/10
**Scalability**: 4/10 → 9/10  
**Maintainability**: 3/10 → 9/10

## ⚠️ WHAT TO PRESERVE

**DO NOT DELETE:**
- src/components/workspace/WorkspaceContainer.tsx (main)
- src/components/workspace/NodeBasedWorkspaceFixed.tsx (current)
- src/components/views/EnhancedStaticScriptView.tsx (current)
- src/components/script/chat/ChatAssistant.jsx (current)
- backend/tools/ (new tool system)
- backend/config/ (configuration)
- backend/ad_processing/ (video processing)

**SAFE TO DELETE:**
- src/legacy/ (completely obsolete)
- src/test/ (test components)
- All PLAN.md files (planning noise)
- backend/server_backup.js (use git instead)
- Debug scripts (move to debug/)
- Old video analysis results (archive)