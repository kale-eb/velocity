const { Agent } = require('@openai/agents');
const {
  getScriptEditingContext,
  getWorkspaceHelp,
  getCurrentScript,
  suggestScriptChanges,
  listWorkspaceContents,
  readWorkspaceContent,
  discoverCapabilities
} = require('./tools');
const prompts = require('../config/prompts.json');

/**
 * Script Assistant Agent
 * Specialized agent for script editing and improvement with interleaved tool calling
 */
const scriptAgent = new Agent({
  name: 'Script Assistant',
  model: 'gpt-5', // Use GPT-5 for better performance
  // Disable model fallbacks - fail if model unavailable
  modelFallbacks: false,
  instructions: prompts.base_system.core,

  tools: [
    getScriptEditingContext,
    getWorkspaceHelp,
    getCurrentScript,
    suggestScriptChanges,
    listWorkspaceContents,
    readWorkspaceContent,
    discoverCapabilities
  ]
});

module.exports = { scriptAgent };