import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, MessageSquare, Sparkles, Plus } from 'lucide-react';

export default function ChatAssistant({ 
  disabled, 
  script, 
  onPropose, 
  onApply, 
  proposed, 
  context = {} 
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [aborter, setAborter] = useState(null);
  const [autoContinue, setAutoContinue] = useState(false);
  const [actionStates, setActionStates] = useState({}); // Track accept/reject state for each message
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isDisabled = disabled || loading;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  function summarizeAction(action) {
    if (!action) return 'No change';
    
    switch (action.type) {
      case 'rewrite':
        return `Rewrite ${action.targetId}${action.camera_instruction ? ' + camera' : ''}`;
      case 'add':
        return `Add ${action.chunk?.type || 'PRODUCT'} ${action.position} ${action.targetId}`;
      case 'remove':
        return `Remove ${action.targetId}`;
      case 'move':
        return `Move ${action.targetId} ${action.position} ${action.refId}`;
      case 'rewrite_batch':
        return `Batch rewrite (${action.edits?.length || 0} chunks)`;
      case 'add_batch':
        return `Batch add (${action.items?.length || 0} chunks)`;
      case 'remove_batch':
        return `Batch remove (${action.targetIds?.length || 0} chunks)`;
      default:
        return action.type || 'Unknown action';
    }
  }

  function summarizeActions(actions) {
    if (!actions || actions.length === 0) return 'No changes proposed.';
    if (actions.length === 1) return summarizeAction(actions[0]);
    return `${actions.length} changes: ${actions.map(summarizeAction).join(', ')}`;
  }

  function toChatHistory() {
    return messages
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-8);
  }

  function autoResize() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    const maxHeight = 140;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  }

  async function sendMessage() {
    if (!prompt.trim() || disabled) return;

    // Auto-reject any pending actions from previous messages
    const updatedStates = {};
    messages.forEach((msg, index) => {
      if (msg.actions && msg.actions.length > 0 && !actionStates[index]) {
        updatedStates[index] = 'rejected';
      }
    });
    if (Object.keys(updatedStates).length > 0) {
      setActionStates(prev => ({ ...prev, ...updatedStates }));
      onPropose([]); // Clear any pending proposals
    }

    // Show user message immediately
    const userMessage = { role: 'user', content: prompt, timestamp: Date.now() };
    const thinkingMessage = { role: 'assistant', content: '', thinking: true, timestamp: Date.now() };
    
    setMessages(prev => [...prev, userMessage, thinkingMessage]);
    
    const controller = new AbortController();
    setAborter(controller);
    setLoading(true);
    setPrompt(''); // Clear input immediately
    autoResize();

    try {
      
      // Prepare inputs for tools
      const inputs = {
        product_specs: context.productSpecs || '',
        extra_instructions: context.extraInstructions || '',
        ad_refs: context.selectedAds || []
      };

      // Enhanced prompt with explicit context when nodes are selected
      let enhancedPrompt = prompt;
      if (context.selectedNodes && context.selectedNodes.length > 0) {
        const contextInfo = [];
        if (context.productSpecs) {
          contextInfo.push(`PRODUCT SPECS (user selected): ${context.productSpecs}`);
        }
        if (context.extraInstructions) {
          contextInfo.push(`INSTRUCTIONS (user selected): ${context.extraInstructions}`);
        }
        if (context.selectedAds && context.selectedAds.length > 0) {
          contextInfo.push(`REFERENCE ADS (user selected): ${context.selectedAds.join(', ')}`);
        }
        
        if (contextInfo.length > 0) {
          enhancedPrompt = `${prompt}\n\n--- USER EXPLICITLY SELECTED CONTEXT ---\n${contextInfo.join('\n\n')}`;
        }
      }

      // Call our Express API
      const response = await fetch('/api/chatActions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          script: script,
          context: context,
          inputs: inputs,
          adAnalyses: context.selectedAdAnalyses || {},
          chat_history: toChatHistory(),
          agent: autoContinue,
          max_steps: 3
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const actions = result.actions || [];
      const explanation = result.explanation || 'Here are the changes I propose:';

      const assistantMessage = {
        role: 'assistant',
        content: explanation,
        actions: actions,
        reasoning: summarizeActions(actions),
        timestamp: Date.now()
      };

      // Replace the thinking message with the actual response
      setMessages(prev => {
        const withoutThinking = prev.slice(0, -1); // Remove thinking message
        return [...withoutThinking, assistantMessage];
      });
      onPropose(actions);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error);
        const errorMessage = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          error: true,
          timestamp: Date.now()
        };
        // Replace the thinking message with error message
        setMessages(prev => {
          const withoutThinking = prev.slice(0, -1); // Remove thinking message
          return [...withoutThinking, errorMessage];
        });
      } else {
        // If aborted, remove the thinking message
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
      setAborter(null);
    }
  }

  function stopGeneration() {
    if (aborter) {
      aborter.abort();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) {
        stopGeneration();
      } else {
        sendMessage();
      }
    }
  }

  function applyActions(actions, messageIndex) {
    setActionStates(prev => ({ ...prev, [messageIndex]: 'accepted' }));
    onPropose(actions);
    onApply();
  }

  function rejectActions(messageIndex) {
    setActionStates(prev => ({ ...prev, [messageIndex]: 'rejected' }));
    onPropose([]);
  }

  function startNewChat() {
    setMessages([]);
    setActionStates({});
    setPrompt('');
    onPropose([]); // Clear any pending proposals
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  // Add CSS animation to document if not already present
  React.useEffect(() => {
    if (!document.querySelector('#chat-spinner-animation')) {
      const style = document.createElement('style');
      style.id = 'chat-spinner-animation';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      backgroundColor: 'var(--color-bg-primary)',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border-secondary)',
        backgroundColor: 'var(--color-bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24,
              height: 24,
              backgroundColor: 'var(--color-accent-primary)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={12} color="white" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>AI Assistant</span>
          </div>
          
          <button
            onClick={startNewChat}
            style={{
              padding: '6px 8px',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            title="Start a new chat"
          >
            <Plus size={12} />
            New Chat
          </button>
        </div>
        
        {/* Context Indicator */}
        {context.selectedNodes && context.selectedNodes.length > 0 && (
          <div style={{
            marginTop: 8,
            padding: '4px 8px',
            backgroundColor: 'var(--color-accent-bg)',
            color: 'var(--color-accent-text)',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 500
          }}>
            Context: {[
              context.productSpecs && 'Product specs',
              context.extraInstructions && 'Instructions', 
              context.selectedAds?.length > 0 && `${context.selectedAds.length} ad${context.selectedAds.length > 1 ? 's' : ''}`
            ].filter(Boolean).join(' + ')}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            fontStyle: 'italic',
            padding: '20px 0'
          }}>
            Ask for script edits. I'll propose changes one at a time.
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: 16,
              backgroundColor: message.role === 'user' 
                ? 'var(--color-accent-primary)' 
                : message.error
                ? 'var(--color-error-bg)'
                : 'var(--color-bg-secondary)',
              color: message.role === 'user' 
                ? 'white' 
                : message.error
                ? 'var(--color-error-text)'
                : 'var(--color-text-primary)',
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap'
            }}>
              {message.thinking ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  color: 'var(--color-text-secondary)'
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 13, fontStyle: 'italic' }}>Thinking...</span>
                </div>
              ) : (
                message.content
              )}
            </div>

            {/* Action Proposals */}
            {message.actions && message.actions.length > 0 && (
              <div style={{
                maxWidth: '80%',
                backgroundColor: actionStates[index] === 'accepted' 
                  ? 'rgba(34, 197, 94, 0.1)' // Green tint for accepted
                  : actionStates[index] === 'rejected'
                  ? 'rgba(239, 68, 68, 0.1)' // Red tint for rejected
                  : 'var(--color-bg-tertiary)',
                border: actionStates[index] === 'accepted'
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : actionStates[index] === 'rejected'
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid var(--color-border-secondary)',
                borderRadius: 12,
                padding: 16,
                marginTop: 4,
                opacity: actionStates[index] ? 0.8 : 1,
                transition: 'all 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <MessageSquare size={14} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {actionStates[index] === 'accepted' 
                      ? '✓ Applied' 
                      : actionStates[index] === 'rejected'
                      ? '✗ Rejected'
                      : 'Proposed Changes'}
                  </span>
                </div>
                
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: 16, 
                  fontSize: 13,
                  color: actionStates[index] 
                    ? 'var(--color-text-tertiary)'
                    : 'var(--color-text-secondary)',
                  lineHeight: 1.4
                }}>
                  {message.actions.map((action, actionIndex) => (
                    <li key={actionIndex} style={{ marginBottom: 4 }}>
                      {summarizeAction(action)}
                    </li>
                  ))}
                </ul>

                {!actionStates[index] && (
                  <div style={{ 
                    display: 'flex', 
                    gap: 8, 
                    marginTop: 12,
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => applyActions(message.actions, index)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-success-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => rejectActions(index)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border-secondary)',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Actions Preview */}
      {proposed && proposed.length > 0 && (
        <div style={{
          margin: '0 20px 16px',
          padding: 12,
          backgroundColor: 'var(--color-warning-bg)',
          border: '1px solid var(--color-warning-border)',
          borderRadius: 8,
          fontSize: 12
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Pending: {summarizeActions(proposed)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onApply()}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--color-success-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Apply Now
            </button>
            <button
              onClick={() => onPropose([])}
              style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--color-border-secondary)',
        backgroundColor: 'var(--color-bg-secondary)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-end', 
          gap: 8,
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 8,
          padding: '8px 12px'
        }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Generate a script first to enable the assistant.' : loading ? 'AI is thinking...' : 'Type a command (Shift+Enter for newline)'}
            disabled={disabled || loading}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 14,
              lineHeight: 1.4,
              backgroundColor: 'transparent',
              fontFamily: 'inherit'
            }}
          />
          
          {loading ? (
            <button
              onClick={stopGeneration}
              style={{
                padding: 8,
                backgroundColor: 'var(--color-error-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Stop generation"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={disabled || !prompt.trim()}
              style={{
                padding: 8,
                backgroundColor: (disabled || !prompt.trim()) 
                  ? 'var(--color-border-secondary)' 
                  : 'var(--color-accent-primary)',
                color: (disabled || !prompt.trim()) 
                  ? 'var(--color-text-secondary)' 
                  : 'white',
                border: 'none',
                borderRadius: 6,
                cursor: (disabled || !prompt.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Send message"
            >
              <Send size={14} />
            </button>
          )}
        </div>

        {/* Options */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginTop: 8 
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={autoContinue}
              onChange={(e) => setAutoContinue(e.target.checked)}
              style={{ margin: 0 }}
            />
            Auto-continue (agent mode)
          </label>
        </div>
      </div>
    </div>
  );
}