import React, { useState, useMemo } from 'react';
import { FileText, Plus, Settings, Sparkles, Upload } from 'lucide-react';

export default function ScriptGenerationNode({ node, onUpdate, onConnect }) {
  const [isExpanded, setIsExpanded] = useState(node.expanded || false);
  const [inputs, setInputs] = useState(node.data?.inputs || {
    product_specs: '',
    ad_refs: [],
    extra_instructions: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field, value) => {
    const newInputs = { ...inputs, [field]: value };
    setInputs(newInputs);
    
    // Update node data
    onUpdate({
      ...node,
      data: { ...node.data, inputs: newInputs }
    });
  };

  const handleAddAdRef = () => {
    const url = prompt('Enter ad reference URL:');
    if (url && inputs.ad_refs.length < 4) {
      const newRefs = [...inputs.ad_refs, url];
      handleInputChange('ad_refs', newRefs);
    }
  };

  const handleRemoveAdRef = (index) => {
    const newRefs = inputs.ad_refs.filter((_, i) => i !== index);
    handleInputChange('ad_refs', newRefs);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // This would call our Express API
      const response = await fetch('/api/generateScript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputs: inputs,
          adAnalyses: node.data?.adAnalyses || {}
        })
      });
      
      const result = await response.json();
      
      if (result.script) {
        // Update node with generated script
        onUpdate({
          ...node,
          data: { 
            ...node.data, 
            script: result.script,
            lastGenerated: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Script generation failed:', error);
      alert('Failed to generate script. Please check your connection.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasValidInputs = inputs.product_specs.trim().length > 0;
  const script = node.data?.script;
  const chunkCount = script?.chunks?.length || 0;

  return (
    <div 
      className={`node script-generator ${node.selected ? 'selected' : ''}`}
      style={{
        width: 384,
        minHeight: isExpanded ? 'auto' : 320,
        backgroundColor: 'var(--color-bg-primary)',
        border: '2px solid var(--color-border-secondary)',
        borderRadius: 12,
        padding: 16,
        boxShadow: node.selected ? '0 0 0 2px var(--color-accent-primary)' : 'var(--shadow-md)',
        cursor: 'move'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            backgroundColor: 'var(--color-accent-primary)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={16} color="white" />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Script Generator</span>
        </div>
        
        <button
          onClick={() => {
            const newExpanded = !isExpanded;
            setIsExpanded(newExpanded);
            onUpdate({ ...node, expanded: newExpanded });
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            color: 'var(--color-text-secondary)'
          }}
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Status Badge */}
      <div style={{ marginBottom: 16 }}>
        {script ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success-text)',
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 500
          }}>
            <FileText size={12} />
            {chunkCount} chunks generated
          </div>
        ) : (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            backgroundColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-secondary)',
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 500
          }}>
            Ready to generate
          </div>
        )}
      </div>

      {/* Collapsed View */}
      {!isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Product specs: {inputs.product_specs ? `${inputs.product_specs.length} chars` : 'None'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Ad references: {inputs.ad_refs.length}/4
          </div>
          <button
            onClick={handleGenerate}
            disabled={!hasValidInputs || isGenerating}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: hasValidInputs ? 'var(--color-accent-primary)' : 'var(--color-border-secondary)',
              color: hasValidInputs ? 'white' : 'var(--color-text-secondary)',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: hasValidInputs ? 'pointer' : 'not-allowed',
              opacity: isGenerating ? 0.7 : 1
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Script'}
          </button>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Product Specs */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
              Product Specifications
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={inputs.product_specs}
                onChange={(e) => handleInputChange('product_specs', e.target.value)}
                placeholder="Enter product details, features, benefits..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: '12px 40px 12px 12px',
                  border: '1px solid var(--color-border-secondary)',
                  borderRadius: 8,
                  fontSize: 13,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <button
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  color: 'var(--color-text-secondary)'
                }}
                title="Upload document"
              >
                <Upload size={16} />
              </button>
            </div>
          </div>

          {/* Ad References */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
              Ad References ({inputs.ad_refs.length}/4)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inputs.ad_refs.map((url, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 6,
                    fontSize: 12
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {url}
                  </span>
                  <button
                    onClick={() => handleRemoveAdRef(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                      fontSize: 12
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              {inputs.ad_refs.length < 4 && (
                <button
                  onClick={handleAddAdRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: '1px dashed var(--color-border-secondary)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  <Plus size={14} />
                  Add reference URL
                </button>
              )}
            </div>
          </div>

          {/* Extra Instructions */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
              Extra Instructions
            </label>
            <textarea
              value={inputs.extra_instructions}
              onChange={(e) => handleInputChange('extra_instructions', e.target.value)}
              placeholder="Tone, target audience, specific requirements..."
              style={{
                width: '100%',
                minHeight: 60,
                padding: 12,
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 8,
                fontSize: 13,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!hasValidInputs || isGenerating}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: hasValidInputs ? 'var(--color-accent-primary)' : 'var(--color-border-secondary)',
              color: hasValidInputs ? 'white' : 'var(--color-text-secondary)',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: hasValidInputs ? 'pointer' : 'not-allowed',
              opacity: isGenerating ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Sparkles size={16} />
            {isGenerating ? 'Generating...' : 'Generate Script'}
          </button>

          {/* Generated Script Preview */}
          {script && (
            <div style={{
              marginTop: 8,
              padding: 12,
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 8,
              border: '1px solid var(--color-border-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileText size={14} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{script.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {chunkCount} chunks • Generated {node.data?.lastGenerated ? new Date(node.data.lastGenerated).toLocaleTimeString() : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection Points */}
      <div
        className="connection-point output"
        style={{
          position: 'absolute',
          right: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: 'var(--color-accent-primary)',
          border: '2px solid white',
          cursor: 'pointer'
        }}
        title="Connect to video workspace"
      />
      
      <div
        className="connection-point input"
        style={{
          position: 'absolute',
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: 'var(--color-border-primary)',
          border: '2px solid white',
          cursor: 'pointer'
        }}
        title="Connect from product specs or ads"
      />
    </div>
  );
}