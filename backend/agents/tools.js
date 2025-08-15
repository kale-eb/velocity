const { tool } = require('@openai/agents');
const { z } = require('zod');
const prompts = require('../config/prompts.json');

/**
 * Script Editing Context Tool
 * Loads contextual information about how the script system works
 */
const getScriptEditingContext = tool({
  name: 'get_script_editing_context',
  description: 'Load contextual information about how the script system works',
  parameters: z.object({}),
  async execute(_, runContext) {
    const { sendToolStatus } = runContext?.context || {};
    sendToolStatus?.('Loading script system context');
    
    return {
      context: prompts.script_editing_context.content,
      loaded: true
    };
  },
});

/**
 * Current Script Tool
 * Gets the current script sections and metadata
 */
const getCurrentScript = tool({
  name: 'get_current_script',
  description: 'Get the current script sections and metadata',
  parameters: z.object({}),
  async execute(_, runContext) {
    const { script, sendToolStatus } = runContext?.context || {};
    sendToolStatus?.('Analyzing current script');
    
    if (!script) {
      return { error: 'No script available in context' };
    }
    
    return {
      script: {
        id: script.id,
        title: script.title,
        sections: script.sections
      },
      metadata: {
        sectionCount: script.sections?.length || 0,
        types: script.sections?.map(s => s.type) || [],
        videoTypes: script.sections?.map(s => s.video_type) || [],
        estimatedDuration: (script.sections?.length || 0) * 6 // ~6 seconds per section
      }
    };
  },
});

/**
 * Script Changes Suggestion Tool
 * Creates interactive suggestions for script modifications
 */
const suggestScriptChanges = tool({
  name: 'suggest_script_changes',
  description: 'ONLY suggest changes to the script sections - creates interactive UI for user approval. Call this tool with exact parameters: explanation (string) and actions (array of action objects).',
  parameters: z.object({
    explanation: z.string().describe('Clear explanation of why these proposed changes would improve the script'),
    actions: z.array(z.object({
      type: z.enum(['rewrite_section', 'add_section', 'remove_section', 'move_section']).describe('Type of modification to make'),
      targetId: z.string().describe('ID of the section to modify or reference point'),
      script_text: z.string().nullable().optional().describe('New script text (for rewrite_section actions)'),
      shots: z.array(z.object({
        camera: z.string().describe('Camera instruction for this shot'),
        portion: z.string().describe('Script portion for this shot')
      })).nullable().optional().describe('Updated shots array (for rewrite_section actions)'),
      position: z.enum(['before', 'after']).nullable().optional().describe('Position for add_section/move_section actions'),
      section: z.object({
        id: z.string(),
        type: z.enum(['HOOK', 'BODY', 'CTA']),
        script_text: z.string(),
        video_type: z.enum(['JUMP_CUTS', 'B_ROLL', 'A_ROLL_WITH_OVERLAY', 'SPLIT_SCREEN']),
        shots: z.array(z.object({
          camera: z.string(),
          portion: z.string()
        }))
      }).nullable().optional().describe('Complete new section data for add_section actions')
    }))
  }),
  async execute({ explanation, actions }, runContext) {
    try {
      console.log('🎯 TOOL EXECUTION STARTED: suggest_script_changes');
      console.log('🎯 Raw parameters received:', { explanation: !!explanation, actions: !!actions, actionsLength: actions?.length });
      
      const { sendSuggestions, sendToolStatus } = runContext?.context || {};
      
      sendToolStatus?.('Preparing script suggestions');
      
      console.log('🎯 SUGGESTION DETAILS:');
      console.log('  Explanation:', explanation?.substring(0, 100) + '...');
      console.log('  Action count:', actions?.length || 0);
    actions?.forEach((action, i) => {
      console.log(`  Action ${i+1}:`, {
        type: action.type,
        targetId: action.targetId,
        script_text_length: action.script_text?.length || 0,
        shots_count: action.shots?.length || 0,
        script_preview: action.script_text?.substring(0, 50) || 'EMPTY',
        section_data: action.section ? {
          type: action.section.type,
          video_type: action.section.video_type,
          shots_count: action.section.shots?.length || 0
        } : 'NONE'
      });
    });
    
    if (sendSuggestions) {
      sendSuggestions({ explanation, actions });
    }
    
      console.log('🎯 TOOL EXECUTION COMPLETED: suggest_script_changes');
      return { 
        status: 'suggestions_sent',
        explanation,
        actionCount: actions.length,
        message: 'Interactive suggestions have been prepared for your review.'
      };
    } catch (error) {
      console.error('🎯 TOOL EXECUTION ERROR:', error);
      console.error('🎯 Error details:', error.message);
      throw error;
    }
  },
});

/**
 * Workspace Content Tool
 * Access workspace nodes and content references
 */
const getWorkspaceContent = tool({
  name: 'get_workspace_content',
  description: 'Access content from workspace nodes that the user has selected as context for their request',
  parameters: z.object({
    types: z.array(z.enum(['productSpec', 'ad', 'instructions'])).nullable().optional().describe('Filter by node types')
  }),
  async execute({ types }, runContext) {
    const { workspaceNodes, sendToolStatus, chatHistory } = runContext?.context || {};
    sendToolStatus?.('Reading workspace content');
    
    // Debug logging
    console.log('🔍 WORKSPACE DEBUG:');
    console.log('  runContext exists:', !!runContext);
    console.log('  context exists:', !!runContext?.context);
    console.log('  workspaceNodes exists:', !!workspaceNodes);
    console.log('  workspaceNodes length:', workspaceNodes?.length || 0);
    console.log('  workspaceNodes data:', JSON.stringify(workspaceNodes, null, 2));
    
    if (!workspaceNodes || workspaceNodes.length === 0) {
      return { 
        content: [],
        message: 'No workspace content selected by user as context'
      };
    }
    
    let filteredNodes = workspaceNodes;
    if (types && types.length > 0) {
      filteredNodes = workspaceNodes.filter(node => types.includes(node.type));
    }
    
    const content = filteredNodes.map(node => {
      console.log('🔍 Workspace node:', {
        id: node.id,
        type: node.type,
        hasData: !!node.data,
        contentLength: node.data?.content?.length || 0,
        fileCount: node.data?.uploadedFiles?.length || 0,
        extractedTexts: node.data?.extractedTexts?.length || 0,
        hasAnalysisRef: !!node.data?.analysisRef
      });
      
      let resolvedContent = node.data?.content || '';
      
      // For video nodes, try to resolve the analysis reference
      if (node.type === 'ad') {
        const { videoAnalyses } = runContext?.context || {};
        const analysis = videoAnalyses?.[node.id];
        
        // Check both the reference and direct videoAnalyses cache
        if (analysis || (node.data?.analysisRef && videoAnalyses)) {
          // Always return the complete analysis JSON
          resolvedContent = `COMPLETE VIDEO ANALYSIS JSON:
${JSON.stringify(analysis, null, 2)}

URL: ${node.data?.url || 'N/A'}`;
        }
      }
      
      const nodeResult = {
        id: node.id,
        type: node.type,
        content: resolvedContent,
        fileCount: node.data?.uploadedFiles?.length || 0,
        extractedTexts: node.data?.extractedTexts || [],
        analysisRef: node.data?.analysisRef || null
      };
      
      // Always include full analysis object for video nodes
      if (node.type === 'ad') {
        const { videoAnalyses } = runContext?.context || {};
        const analysis = videoAnalyses?.[node.id];
        if (analysis) {
          nodeResult.fullAnalysis = analysis;
        }
      }
      
      return nodeResult;
    });
    
    const result = {
      content,
      totalNodes: filteredNodes.length,
      availableTypes: [...new Set(workspaceNodes.map(n => n.type))],
      message: `Found ${filteredNodes.length} workspace items that the user selected as context for this request`
    };
    
    // Always include chat history for conversation continuity
    if (chatHistory && chatHistory.length > 0) {
      result.recentChatHistory = chatHistory.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      result.message += `. Conversation context included (${chatHistory.length} messages).`;
    }
    
    return result;
  },
});

/**
 * Discovery Tool
 * Discover available capabilities and tools
 */
const discoverCapabilities = tool({
  name: 'discover_capabilities',
  description: 'Discover what tools and instruction modules are available for different tasks',
  parameters: z.object({
    category: z.enum(['script', 'workspace', 'all']).nullable().optional().describe('Filter capabilities by category')
  }),
  async execute({ category }, runContext) {
    const capabilities = {
      script: [
        'get_script_editing_context - Load script system information',
        'get_current_script - Analyze current script',
        'suggest_script_changes - Create interactive suggestions'
      ],
      workspace: [
        'get_workspace_content - Access workspace nodes and content'
      ],
      core: [
        'discover_capabilities - This tool for discovering available features'
      ]
    };
    
    if (category && category !== 'all') {
      return {
        category,
        capabilities: capabilities[category] || [],
        description: `Available ${category} tools and features`
      };
    }
    
    return {
      allCapabilities: capabilities,
      categories: Object.keys(capabilities),
      description: 'Complete list of available tools and capabilities'
    };
  },
});

module.exports = {
  getScriptEditingContext,
  getCurrentScript,
  suggestScriptChanges,
  getWorkspaceContent,
  discoverCapabilities
};