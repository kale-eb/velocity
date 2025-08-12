import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, MessageSquare, Sparkles, Plus } from 'lucide-react';

export default function ChatAssistant({ 
  disabled, 
  script, 
  onPropose, 
  onApply, 
  proposed, 
  context = {},
  colorScheme = 'light'
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [aborter, setAborter] = useState(null);
  const [actionStates, setActionStates] = useState({}); // Track accept/reject state for each message
  const [currentStream, setCurrentStream] = useState(null);
  // Removed thinking dropdown - just show spinner while processing
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputContainerRef = useRef(null);

  const isDisabled = disabled || loading;
  const isDarkMode = colorScheme === 'dark';
  const isExperimental = colorScheme === 'experimental';

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
    const streamingMessage = { 
      role: 'assistant', 
      content: '', 
      streaming: true, 
      toolStatuses: [],
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMessage, streamingMessage]);
    
    const controller = new AbortController();
    setAborter(controller);
    setLoading(true);
    setPrompt(''); // Clear input immediately
    autoResize();

    try {
      // Prepare workspace nodes data
      const workspaceNodes = context.selectedNodes || [];
      
      // Call streaming endpoint
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          workspaceNodes: workspaceNodes,
          script: script,
          chatHistory: toChatHistory()
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalActions = [];
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              // Remove thinking processing - not using fake simulation
              
              if (data.type === 'content') {
                // Append content to streaming message
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.streaming) {
                    lastMessage.content += data.content;
                  }
                  return updated;
                });
                
              } else if (data.type === 'tool_status') {
                // Add permanent tool status line
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.streaming) {
                    if (!lastMessage.toolStatuses) {
                      lastMessage.toolStatuses = [];
                    }
                    lastMessage.toolStatuses.push(data.content);
                  }
                  return updated;
                });
                
              } else if (data.type === 'suggestions') {
                // Handle suggestions with proper action format
                finalActions = data.content.actions || [];
                const explanation = data.content.explanation || 'Here are the suggested changes:';
                
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.streaming) {
                    lastMessage.content = explanation; // Replace content with explanation
                    lastMessage.actions = finalActions;
                  }
                  return updated;
                });
                
              } else if (data.type === 'error') {
                console.error('Stream error:', data.content);
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.streaming) {
                    lastMessage.content = data.content;
                    lastMessage.error = true;
                  }
                  return updated;
                });
                
              } else if (data.type === 'done') {
                console.log('Stream done');
                // Finalize the streaming message
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.streaming) {
                    lastMessage.streaming = false;
                    if (!lastMessage.content.trim()) {
                      lastMessage.content = 'I\'ve analyzed your request and prepared some suggestions.';
                    }
                  }
                  return updated;
                });
                
                if (finalActions.length > 0) {
                  onPropose(finalActions);
                }
                break;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Chat streaming error:', error);
        const errorMessage = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          error: true,
          timestamp: Date.now()
        };
        // Replace the streaming message with error message
        setMessages(prev => {
          const withoutStreaming = prev.slice(0, -1);
          return [...withoutStreaming, errorMessage];
        });
      } else {
        // If aborted, remove the streaming message
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
      setAborter(null);
      setCurrentStream(null);
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
              {message.streaming ? (
                <div>
                  {/* Tool statuses */}
                  {message.toolStatuses && message.toolStatuses.map((status, idx) => (
                    <div key={idx} style={{
                      fontSize: 12,
                      color: 'var(--color-success-primary)',
                      marginBottom: 4,
                      fontWeight: 500
                    }}>
                      {status}
                    </div>
                  ))}
                  
                  {/* Content */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </div>
                  
                  {/* Simple thinking spinner */}
                  {!message.content && (!message.toolStatuses || message.toolStatuses.length === 0) && (
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
                  )}
                </div>
              ) : (
                <div>
                  {/* Show final tool statuses */}
                  {message.toolStatuses && message.toolStatuses.map((status, idx) => (
                    <div key={idx} style={{
                      fontSize: 12,
                      color: 'var(--color-success-primary)',
                      marginBottom: 4,
                      fontWeight: 500
                    }}>
                      {status}
                    </div>
                  ))}
                  
                  {/* Final content */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </div>
                </div>
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
        <div 
          ref={inputContainerRef}
          style={{ 
            display: 'flex', 
            alignItems: 'flex-end', 
            gap: 8,
            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 
                           isExperimental ? 'rgba(0, 0, 0, 0.9)' : 
                           'rgba(255, 255, 255, 0.95)',
            border: isDarkMode ? '2px solid #8b5cf6' :
                   isExperimental ? '2px solid #eab308' :
                   '2px solid #3b82f6',
            borderRadius: 16,
            padding: '12px 16px',
            boxShadow: isDarkMode ? '0 0 20px rgba(139, 92, 246, 0.6), inset 0 0 10px rgba(139, 92, 246, 0.1)' :
                      isExperimental ? '0 0 20px rgba(234, 179, 8, 0.6), inset 0 0 10px rgba(234, 179, 8, 0.1)' :
                      '0 0 15px rgba(59, 130, 246, 0.3)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isDisabled) {
              if (isDarkMode) {
                e.currentTarget.style.borderColor = '#7c3aed';
                e.currentTarget.style.boxShadow = '0 0 25px rgba(124, 58, 237, 0.8), inset 0 0 15px rgba(124, 58, 237, 0.2)';
              } else if (isExperimental) {
                e.currentTarget.style.borderColor = '#d97706';
                e.currentTarget.style.boxShadow = '0 0 25px rgba(217, 119, 6, 0.8), inset 0 0 15px rgba(217, 119, 6, 0.2)';
              } else {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(37, 99, 235, 0.5)';
              }
            }
          }}
          onMouseLeave={(e) => {
            if (!isDisabled && document.activeElement !== textareaRef.current) {
              if (isDarkMode) {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.6), inset 0 0 10px rgba(139, 92, 246, 0.1)';
              } else if (isExperimental) {
                e.currentTarget.style.borderColor = '#eab308';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(234, 179, 8, 0.6), inset 0 0 10px rgba(234, 179, 8, 0.1)';
              } else {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.3)';
              }
            }
          }}
        >
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputContainerRef.current) {
                if (isDarkMode) {
                  inputContainerRef.current.style.borderColor = '#7c3aed';
                  inputContainerRef.current.style.boxShadow = '0 0 30px rgba(124, 58, 237, 1), inset 0 0 20px rgba(124, 58, 237, 0.3)';
                } else if (isExperimental) {
                  inputContainerRef.current.style.borderColor = '#d97706';
                  inputContainerRef.current.style.boxShadow = '0 0 30px rgba(217, 119, 6, 1), inset 0 0 20px rgba(217, 119, 6, 0.3)';
                } else {
                  inputContainerRef.current.style.borderColor = '#1d4ed8';
                  inputContainerRef.current.style.boxShadow = '0 0 25px rgba(29, 78, 216, 0.6)';
                }
              }
            }}
            onBlur={() => {
              if (inputContainerRef.current) {
                if (isDarkMode) {
                  inputContainerRef.current.style.borderColor = '#8b5cf6';
                  inputContainerRef.current.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.6), inset 0 0 10px rgba(139, 92, 246, 0.1)';
                } else if (isExperimental) {
                  inputContainerRef.current.style.borderColor = '#eab308';
                  inputContainerRef.current.style.boxShadow = '0 0 20px rgba(234, 179, 8, 0.6), inset 0 0 10px rgba(234, 179, 8, 0.1)';
                } else {
                  inputContainerRef.current.style.borderColor = '#3b82f6';
                  inputContainerRef.current.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.3)';
                }
              }
            }}
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
              fontFamily: 'inherit',
              color: (isDarkMode || isExperimental) ? 'white' : '#1f2937'
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

      </div>
    </div>
  );
}