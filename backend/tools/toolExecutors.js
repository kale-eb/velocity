const prompts = require('../config/prompts.json');
const toolManager = require('./toolManager');

class ToolExecutors {
  
  /**
   * Execute workspace content operations
   */
  static workspace_content_handler(toolName, toolArgs, context) {
    const { workspaceNodes = [] } = context;
    
    switch (toolName) {
      case 'get_available_references':
        const types = toolArgs.types || ['productSpec', 'ad', 'instructions'];
        const references = workspaceNodes
          .filter(node => types.includes(node.type))
          .map(node => ({
            id: node.id,
            type: node.type,
            title: node.type === 'productSpec' ? 'Product Specs' :
                   node.type === 'ad' ? 'Ad Example' :
                   node.type === 'instructions' ? 'Instructions' : node.type,
            has_content: !!(node.data?.content || node.data?.uploadedFiles?.length),
            file_count: node.data?.uploadedFiles?.length || 0
          }));
        return JSON.stringify({ references });
        
      case 'read_reference':
        const targetNode = workspaceNodes.find(node => node.id === toolArgs.reference_id);
        if (targetNode) {
          return JSON.stringify({
            id: targetNode.id,
            type: targetNode.type,
            content: targetNode.data?.content || '',
            files: targetNode.data?.uploadedFiles || [],
            extracted_texts: targetNode.data?.extractedTexts || []
          });
        } else {
          return JSON.stringify({ error: `Reference ${toolArgs.reference_id} not found` });
        }
        
      case 'get_workspace_content':
        const nodeTypes = toolArgs.node_types || [];
        const relevantNodes = workspaceNodes.filter(node => nodeTypes.includes(node.type));
        const content = relevantNodes.map(node => ({
          type: node.type,
          id: node.id,
          data: node.data
        }));
        return JSON.stringify({ nodes: content });
        
      default:
        return JSON.stringify({ error: `Unknown workspace tool: ${toolName}` });
    }
  }
  
  /**
   * Execute script operations
   */
  static script_handler(toolName, toolArgs, context) {
    const { script } = context;
    
    switch (toolName) {
      case 'get_current_script':
      case 'get_script_content':
        return JSON.stringify({
          script: script || null,
          chunks: script?.chunks || []
        });
        
      default:
        return JSON.stringify({ error: `Unknown script tool: ${toolName}` });
    }
  }
  
  /**
   * Execute script suggestion operations
   */
  static script_suggestions_handler(toolName, toolArgs, context) {
    if (toolName === 'suggest_script_changes') {
      const actions = toolArgs.actions || [];
      const explanation = toolArgs.explanation || 'Here are the suggested changes:';
      
      // This handler returns the result but also indicates suggestions should be streamed
      return {
        result: JSON.stringify({
          status: 'suggestions_prepared',
          explanation: explanation,
          actions: actions
        }),
        stream_suggestions: {
          explanation,
          actions
        }
      };
    }
    
    return JSON.stringify({ error: `Unknown script suggestion tool: ${toolName}` });
  }
  
  /**
   * Execute script context loading
   */
  static script_context_handler(toolName, toolArgs, context) {
    if (toolName === 'get_script_editing_context') {
      return JSON.stringify({
        context: prompts.script_editing_context.content,
        loaded: true
      });
    }
    
    return JSON.stringify({ error: `Unknown context tool: ${toolName}` });
  }
  
  /**
   * Execute discovery operations
   */
  static discovery_handler(toolName, toolArgs, context) {
    if (toolName === 'discover_capabilities') {
      const taskCategory = toolArgs.task_category || 'all';
      const categories = toolManager.getCategories();
      
      
      let result = {
        available_categories: {},
        available_tools: {}
      };
      
      // Filter by category if specified
      if (taskCategory === 'all') {
        result.available_categories = categories;
        
        // Get all tools by category
        Object.keys(categories).forEach(category => {
          const tools = Object.entries(toolManager.registry)
            .filter(([name, def]) => def.category === category)
            .map(([name, def]) => ({
              name,
              description: def.description,
              category: def.category
            }));
          result.available_tools[category] = tools;
        });
      } else if (categories[taskCategory]) {
        result.available_categories[taskCategory] = categories[taskCategory];
        
        const tools = Object.entries(toolManager.registry)
          .filter(([name, def]) => def.category === taskCategory)
          .map(([name, def]) => ({
            name,
            description: def.description,
            category: def.category
          }));
        result.available_tools[taskCategory] = tools;
      }
      
      return JSON.stringify(result);
    }
    
    return JSON.stringify({ error: `Unknown discovery tool: ${toolName}` });
  }
  
  /**
   * Main execution dispatcher
   */
  static execute(toolName, toolArgs, context) {
    const handler = toolManager.getExecutionHandler(toolName);
    
    if (!handler || !this[handler]) {
      return JSON.stringify({ error: `No handler found for tool: ${toolName}` });
    }
    
    return this[handler](toolName, toolArgs, context);
  }
}

module.exports = ToolExecutors;