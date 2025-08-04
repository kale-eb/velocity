#!/usr/bin/env node

/**
 * Documentation Update Script
 * Run: node update-docs.js [target]
 * 
 * Targets:
 * - all: Update all CLAUDE.md files
 * - main: Update main CLAUDE.md
 * - components: Update component CLAUDE.md files
 * - [specific]: Update specific directory (e.g., workspace, views)
 */

const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'help';

const claudeFiles = {
  main: './CLAUDE.md',
  workspace: './src/components/workspace/CLAUDE.md',
  views: './src/components/views/CLAUDE.md',
  pages: './src/pages/CLAUDE.md',
  layout: './src/components/layout/CLAUDE.md',
  video: './src/components/video/CLAUDE.md',
  content: './src/components/content/CLAUDE.md',
  home: './src/components/home/CLAUDE.md',
  services: './src/services/CLAUDE.md',
  hooks: './src/hooks/CLAUDE.md',
  store: './src/store/CLAUDE.md',
  types: './src/types/CLAUDE.md'
};

function showHelp() {
  console.log(`
📝 Documentation Update Script

Usage: node update-docs.js [target]

Targets:
  all        - List all CLAUDE.md files that need updating
  main       - Focus on main CLAUDE.md file
  components - Focus on component documentation
  workspace  - Focus on workspace components
  views      - Focus on view components
  [etc...]   - Any specific directory name

Available files:
${Object.keys(claudeFiles).map(key => `  ${key.padEnd(12)} - ${claudeFiles[key]}`).join('\n')}

Note: This script helps you identify which files to update.
You'll still need to use Claude to actually update the content.
`);
}

function checkFile(name, filepath) {
  const exists = fs.existsSync(filepath);
  const stats = exists ? fs.statSync(filepath) : null;
  const size = stats ? `${Math.round(stats.size / 1024)}KB` : 'Missing';
  const modified = stats ? stats.mtime.toLocaleDateString() : 'N/A';
  
  return {
    name,
    filepath,
    exists,
    size,
    modified,
    status: exists ? '✅' : '❌'
  };
}

function listFiles(filter = null) {
  console.log('\n📋 CLAUDE.md File Status:\n');
  
  const files = Object.entries(claudeFiles)
    .filter(([name]) => !filter || name.includes(filter) || filter === 'all')
    .map(([name, filepath]) => checkFile(name, filepath));
  
  files.forEach(file => {
    console.log(`${file.status} ${file.name.padEnd(12)} | ${file.size.padEnd(8)} | ${file.modified.padEnd(12)} | ${file.filepath}`);
  });
  
  const missing = files.filter(f => !f.exists);
  if (missing.length > 0) {
    console.log(`\n❌ Missing files: ${missing.map(f => f.name).join(', ')}`);
  }
  
  console.log(`\n💡 To update a specific file, tell Claude: "Update the ${filter || 'main'} CLAUDE.md file"`);
}

switch (target) {
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  case 'all':
    listFiles();
    break;
  case 'components':
    listFiles('component');
    break;
  default:
    if (claudeFiles[target]) {
      console.log(`\n🎯 Focusing on: ${target}`);
      listFiles(target);
    } else {
      console.log(`\n❌ Unknown target: ${target}`);
      showHelp();
    }
}