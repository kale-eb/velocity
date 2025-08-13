const fs = require('fs');
const path = require('path');

// Load tool registry from JSON
const toolRegistry = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf8')
);

class ToolManager {
  constructor() {
    this.registry = toolRegistry.tool_registry;
    this.categories = toolRegistry.tool_categories;
    this.handlers = toolRegistry.execution_handlers;
  }
  
  /**
   * Get tools for a specific API (responses or streaming)
   * @param {string} api - 'responses' or 'streaming'
   * @param {string[]} categories - Categories to include (default: ['core'])
   * @returns {object[]} OpenAI function tool definitions
   */
  getToolsForAPI(api, categories = ['core']) {
    const tools = [];
    
    Object.entries(this.registry).forEach(([toolName, toolDef]) => {
      // Check if tool supports this API and is in requested categories
      if (toolDef.apis.includes(api) && categories.includes(toolDef.category)) {
        if (api === 'responses') {
          // Responses API format - needs type but flat function structure
          tools.push({
            type: 'function',
            name: toolName,
            description: toolDef.description,
            parameters: toolDef.schema
          });
        } else {
          // Chat Completions format - nested under function
          tools.push({
            type: 'function',
            function: {
              name: toolName,
              description: toolDef.description,
              parameters: toolDef.schema
            }
          });
        }
      }
    });
    
    return tools;
  }
  
  /**
   * Get display name for a tool
   * @param {string} toolName 
   * @returns {string}
   */
  getDisplayName(toolName) {
    return this.registry[toolName]?.display_name || toolName;
  }
  
  /**
   * Get execution handler for a tool
   * @param {string} toolName 
   * @returns {string}
   */
  getExecutionHandler(toolName) {
    return this.registry[toolName]?.execution;
  }
  
  /**
   * Get tools by category
   * @param {string} category 
   * @param {string} api 
   * @returns {object[]}
   */
  getToolsByCategory(category, api) {
    return this.getToolsForAPI(api, [category]);
  }
  
  /**
   * Get all available categories
   * @returns {object}
   */
  getCategories() {
    return this.categories;
  }
  
  /**
   * Get category info by name
   * @param {string} categoryName 
   * @returns {object}
   */
  getCategoryInfo(categoryName) {
    return this.categories[categoryName];
  }
  
  /**
   * Get auto-load triggers for categories
   * @returns {object}
   */
  getAutoLoadTriggers() {
    const triggers = {};
    Object.entries(this.categories).forEach(([category, info]) => {
      if (info.auto_load_triggers) {
        triggers[category] = info.auto_load_triggers;
      }
    });
    return triggers;
  }
  
  /**
   * Smart tool loading - determines which categories to load based on context
   * @param {string} userMessage 
   * @param {object} context 
   * @returns {string[]} Categories to load
   */
  determineCategoriesToLoad(userMessage, context = {}) {
    const categories = ['core']; // Always include core
    const message = userMessage.toLowerCase();
    
    // Check for workspace-related keywords
    if (message.includes('workspace') || 
        message.includes('content') || 
        message.includes('reference') ||
        context.selectedReferences?.length > 0) {
      categories.push('workspace');
    }
    
    // Check for script-related keywords  
    if (message.includes('script') ||
        message.includes('chunk') ||
        message.includes('edit') ||
        message.includes('improve') ||
        message.includes('suggest') ||
        context.script) {
      categories.push('script');
    }
    
    // Check for instruction-related keywords
    if (message.includes('help') ||
        message.includes('how to') ||
        message.includes('detailed') ||
        message.includes('analysis') ||
        message.includes('optimize')) {
      categories.push('instructions');
    }
    
    return [...new Set(categories)]; // Remove duplicates
  }
  
  /**
   * Get tools for smart loading
   * @param {string} userMessage 
   * @param {string} api 
   * @param {object} context 
   * @returns {object}
   */
  getSmartLoadedTools(userMessage, api, context = {}) {
    const categories = this.determineCategoriesToLoad(userMessage, context);
    const tools = this.getToolsForAPI(api, categories);
    
    return {
      tools,
      categories,
      reasoning: `Loaded categories: ${categories.join(', ')} based on message context`
    };
  }
}

module.exports = new ToolManager();