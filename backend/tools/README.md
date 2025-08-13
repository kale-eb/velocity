# Tools Directory

Centralized tool management system for AI chat assistant.

## Structure

```
tools/
├── index.js          # Main module exports
├── toolManager.js    # Smart tool loading and management
├── toolExecutors.js  # Tool execution handlers
├── tools.json        # Tool registry and definitions
└── README.md         # This documentation
```

## Quick Start

```javascript
const tools = require('./tools');

// Smart tool loading based on conversation
const { tools: loadedTools, reasoning } = tools.getSmartTools(
  "Help me improve this script",
  "responses",
  { script, selectedReferences }
);

// Execute any tool
const result = tools.execute('get_current_script', {}, { script });

// Get display name for UI
const displayName = tools.getDisplayName('get_current_script');
```

## Tool Categories

- **core**: Always available (discover_capabilities)
- **workspace**: Content access (get_available_references, read_reference) 
- **script**: Script operations (get_current_script, suggest_script_changes)
- **instructions**: Dynamic instruction loading (get_instructions)

## Smart Loading

Tools are loaded intelligently based on conversation context:

- Mentions "script" → loads script tools
- Mentions "workspace" → loads workspace tools  
- Complex requests → loads instruction tools
- Casual chat → only core tools

## Adding New Tools

1. Add tool definition to `tools.json`
2. Add execution handler to `toolExecutors.js`
3. Tools automatically available via smart loading

## Benefits

- 🎯 **Context-aware**: Only loads relevant tools
- 🚀 **Efficient**: Minimal token overhead
- 🛠️ **Maintainable**: Centralized configuration
- 📊 **Observable**: Clear loading reasoning
- 🔄 **DRY**: No duplicate definitions