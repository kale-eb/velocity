import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, MessageSquare, Sparkles, Plus, MessageCircle, Trash2 } from 'lucide-react';
import { ChatStorage } from '../../../utils/localStorage';

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
  const [actionStates, setActionStates] = useState({});
  
  // Conversation history state
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showConversationList, setShowConversationList] = useState(false);
  
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputContainerRef = useRef(null);
  const currentMessageRef = useRef(null);

  const isDisabled = disabled || loading;
  const isDarkMode = colorScheme === 'dark';
  const isExperimental = colorScheme === 'experimental';

  // Initialize conversations on component mount
  useEffect(() => {
    const loadedConversations = ChatStorage.loadConversations();
    setConversations(loadedConversations);
    
    // Load the most recent conversation if it exists
    if (loadedConversations.length > 0) {
      const mostRecent = loadedConversations[0];
      setCurrentConversationId(mostRecent.id);
      setMessages(mostRecent.messages || []);
      
      // Restore action states from messages
      const restoredActionStates = {};
      mostRecent.messages?.forEach((msg, index) => {
        if (msg.actions && msg.actionState) {
          restoredActionStates[index] = msg.actionState;
        }
      });
      setActionStates(restoredActionStates);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-save conversation when messages change
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      ChatStorage.updateConversationMessages(currentConversationId, messages);
      // Update local conversations state
      setConversations(prev => prev.map(conv => 
        conv.id === currentConversationId 
          ? { ...conv, messages, updatedAt: new Date().toISOString() }
          : conv
      ));
    }
  }, [messages, currentConversationId]);

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
    if (!prompt.trim() || isDisabled) return;

    // Auto-reject any previous unanswered proposals
    const updatedActionStates = { ...actionStates };
    const updatedMessages = [...messages];
    messages.forEach((msg, index) => {
      if (msg.actions && !actionStates[index]) {
        updatedActionStates[index] = 'rejected';
        updatedMessages[index] = { ...msg, actionState: 'rejected' };
      }
    });
    setActionStates(updatedActionStates);
    setMessages(updatedMessages);
    
    // Clear any pending proposals in the parent
    onPropose([]);

    // Ensure we have a current conversation
    if (!currentConversationId) {
      const newConversation = ChatStorage.createNewConversation();
      setCurrentConversationId(newConversation.id);
      const updatedConversations = ChatStorage.loadConversations();
      setConversations(updatedConversations);
    }

    const userMessage = { role: 'user', content: prompt, timestamp: Date.now() };
    const assistantMessage = { 
      role: 'assistant', 
      content: '', 
      streaming: true, 
      toolStatuses: [],
      timestamp: Date.now(),
      id: Date.now() // Add unique ID
    };
    
    // Store the assistant message in ref for direct manipulation
    currentMessageRef.current = assistantMessage;
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    
    const controller = new AbortController();
    setAborter(controller);
    setLoading(true);
    setPrompt('');
    autoResize();

    try {
      const response = await fetch('/api/chat/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          selectedReferences: [],
          workspaceNodes: context.selectedNodes || [],
          script: script,
          chatHistory: toChatHistory(),
          videoAnalyses: context.selectedAdAnalyses || {}
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
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'content') {
              // Update the ref directly
              if (currentMessageRef.current && currentMessageRef.current.streaming) {
                currentMessageRef.current.content += data.content;
                // Trigger re-render by updating messages with the same reference
                setMessages(prev => [...prev]);
              }
              
            } else if (data.type === 'tool_status') {
              if (currentMessageRef.current && currentMessageRef.current.streaming) {
                if (!currentMessageRef.current.toolStatuses) {
                  currentMessageRef.current.toolStatuses = [];
                }
                currentMessageRef.current.toolStatuses.push(data.content);
                setMessages(prev => [...prev]);
              }
              
            } else if (data.type === 'suggestions') {
              finalActions = data.content.actions || [];
              const explanation = data.content.explanation || 'Here are the suggested changes:';
              
              if (currentMessageRef.current && currentMessageRef.current.streaming) {
                currentMessageRef.current.content = explanation;
                currentMessageRef.current.actions = finalActions;
                setMessages(prev => [...prev]);
              }
              
            } else if (data.type === 'error') {
              if (currentMessageRef.current && currentMessageRef.current.streaming) {
                currentMessageRef.current.content = data.content;
                currentMessageRef.current.error = true;
                setMessages(prev => [...prev]);
              }
              
            } else if (data.type === 'done') {
              if (currentMessageRef.current && currentMessageRef.current.streaming) {
                currentMessageRef.current.streaming = false;
                if (!currentMessageRef.current.content.trim()) {
                  currentMessageRef.current.content = 'I\'ve analyzed your request and prepared some suggestions.';
                }
                setMessages(prev => [...prev]);
                currentMessageRef.current = null; // Clear the ref
              }
              
              if (finalActions.length > 0) {
                onPropose(finalActions);
              }
              break;
            }
          } catch (parseError) {
            console.warn('Failed to parse response data:', line, parseError);
          }
        }
      }
      
      reader.releaseLock();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error);
        // Replace the streaming message with an error message
        if (currentMessageRef.current) {
          currentMessageRef.current.content = 'Sorry, I encountered an error. Please try again.';
          currentMessageRef.current.error = true;
          currentMessageRef.current.streaming = false;
          setMessages(prev => [...prev]);
        }
      } else {
        // Remove the streaming message on abort
        setMessages(prev => prev.slice(0, -1));
      }
      currentMessageRef.current = null;
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
    
    // Update the message with the action state
    setMessages(prev => prev.map((msg, idx) => 
      idx === messageIndex 
        ? { ...msg, actionState: 'accepted' }
        : msg
    ));
    
    onPropose(actions);
    onApply();
  }

  function rejectActions(messageIndex) {
    setActionStates(prev => ({ ...prev, [messageIndex]: 'rejected' }));
    
    // Update the message with the action state
    setMessages(prev => prev.map((msg, idx) => 
      idx === messageIndex 
        ? { ...msg, actionState: 'rejected' }
        : msg
    ));
    
    onPropose([]);
  }

  function startNewChat() {
    // Create a new conversation
    const newConversation = ChatStorage.createNewConversation();
    setCurrentConversationId(newConversation.id);
    setMessages([]);
    setActionStates({});
    setPrompt('');
    onPropose([]);
    currentMessageRef.current = null;
    
    // Update conversations list
    const updatedConversations = ChatStorage.loadConversations();
    setConversations(updatedConversations);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function switchToConversation(conversationId) {
    const conversation = ChatStorage.getConversation(conversationId);
    if (conversation) {
      setCurrentConversationId(conversationId);
      setMessages(conversation.messages || []);
      
      // Restore action states from messages
      const restoredActionStates = {};
      conversation.messages?.forEach((msg, index) => {
        if (msg.actions && msg.actionState) {
          restoredActionStates[index] = msg.actionState;
        }
      });
      setActionStates(restoredActionStates);
      
      setPrompt('');
      onPropose([]);
      currentMessageRef.current = null;
      setShowConversationList(false);
    }
  }

  function deleteConversation(conversationId) {
    ChatStorage.deleteConversation(conversationId);
    const updatedConversations = ChatStorage.loadConversations();
    setConversations(updatedConversations);
    
    // If we deleted the current conversation, switch to most recent or create new
    if (conversationId === currentConversationId) {
      if (updatedConversations.length > 0) {
        switchToConversation(updatedConversations[0].id);
      } else {
        startNewChat();
      }
    }
  }

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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setShowConversationList(!showConversationList)}
              style={{
                padding: '6px 8px',
                backgroundColor: showConversationList ? 'var(--color-accent-primary)' : 'transparent',
                color: showConversationList ? 'white' : 'var(--color-text-secondary)',
                border: `1px solid ${showConversationList ? 'var(--color-accent-primary)' : 'var(--color-border-secondary)'}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              title="View conversation history"
            >
              <MessageCircle size={12} />
              {conversations.length}
            </button>
            
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
        </div>
      </div>

      {/* Conversation History List */}
      {showConversationList && (
        <div style={{
          borderBottom: '1px solid var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-secondary)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {conversations.length === 0 ? (
            <div style={{
              padding: '12px 16px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 12
            }}>
              No previous conversations
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                style={{
                  padding: '8px 16px',
                  borderBottom: '1px solid var(--color-border-secondary)',
                  cursor: 'pointer',
                  backgroundColor: conversation.id === currentConversationId ? 'var(--color-bg-tertiary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
                onClick={() => switchToConversation(conversation.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: conversation.id === currentConversationId ? 600 : 400,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {conversation.title}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--color-text-secondary)',
                    marginTop: 2
                  }}>
                    {conversation.messages?.length || 0} messages • {new Date(conversation.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                  style={{
                    padding: '2px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Delete conversation"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

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
                ? (isDarkMode ? '#8b5cf6' : isExperimental ? '#eab308' : '#3b82f6')
                : message.error
                ? (isDarkMode || isExperimental ? '#7f1d1d' : '#fee2e2')
                : (isDarkMode || isExperimental ? '#1f2937' : '#f9fafb'),
              color: message.role === 'user' 
                ? 'white'
                : message.error
                ? (isDarkMode || isExperimental ? '#fca5a5' : '#dc2626')
                : (isDarkMode || isExperimental ? '#e5e7eb' : '#111827'),
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap'
            }}>
              {message.streaming ? (
                <div>
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
                  
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </div>
                  
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
                  ? 'rgba(34, 197, 94, 0.1)'
                  : actionStates[index] === 'rejected'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'var(--color-bg-tertiary)',
                border: actionStates[index] === 'accepted'
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : actionStates[index] === 'rejected'
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid var(--color-border-secondary)',
                borderRadius: 12,
                padding: 16,
                marginTop: 4
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
                   '2px solid #93c5fd',
            borderRadius: 16,
            padding: '12px 16px'
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