/**
 * Tools Module - Centralized tool management system
 * 
 * This module provides a unified interface for managing AI tools including:
 * - Dynamic tool loading based on conversation context
 * - Centralized tool execution and error handling
 * - Smart categorization and discovery
 */

const toolManager = require('./toolManager');
const toolExecutors = require('./toolExecutors');

module.exports = {
  // Main tool manager instance
  manager: toolManager,
  
  // Tool execution engine
  executors: toolExecutors,
  
  // Convenience methods
  getTools: (api, categories) => toolManager.getToolsForAPI(api, categories),
  getSmartTools: (message, api, context) => toolManager.getSmartLoadedTools(message, api, context),
  execute: (toolName, args, context) => toolExecutors.execute(toolName, args, context),
  getDisplayName: (toolName) => toolManager.getDisplayName(toolName),
  
  // Tool discovery
  discover: (category) => toolExecutors.execute('discover_capabilities', { task_category: category }, {}),
  getCategories: () => toolManager.getCategories(),
  
  // Debugging and monitoring
  debug: {
    listAllTools: () => Object.keys(toolManager.registry),
    getToolInfo: (toolName) => toolManager.registry[toolName],
    getLoadTriggers: () => toolManager.getAutoLoadTriggers()
  }
};