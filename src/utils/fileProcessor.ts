// File processor using backend services for reliable processing
console.log('📄 File processor initialized - using backend services for PDF processing');

export interface FileProcessingResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: {
    filename: string;
    size: number;
    type: string;
    pageCount?: number;
  };
}

export async function extractTextFromFile(file: File): Promise<FileProcessingResult> {
  const metadata = {
    filename: file.name,
    size: file.size,
    type: file.type || 'unknown'
  };

  try {
    // Handle text files
    if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
      const content = await file.text();
      return {
        success: true,
        content: content.trim(),
        metadata
      };
    }

    // Handle PDF files using backend service
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log(`📄 Sending PDF to backend for processing: ${file.name}`);
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        console.log('📤 Sending file to backend:', {
          name: file.name,
          size: file.size,
          type: file.type,
          formData: formData,
          formDataEntries: Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `File: ${value.name}` : value])
        });
        
        console.log('📡 Making fetch request to /api/process-file (via proxy)');
        
        // Use proxy to avoid CORS issues
        const response = await fetch('/api/process-file', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header - let the browser set it with boundary
        }).catch(err => {
          console.error('❌ Fetch error:', err);
          throw err;
        });
        
        console.log('📥 Backend response received:', response.status, response.statusText);
        
        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;
          try {
            const errorText = await response.text();
            console.error('❌ Backend error text:', errorText);
            
            // Try to parse as JSON
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error?.message || errorData.message || errorData.detail || errorMessage;
            } catch {
              // If not JSON, use the text as is
              errorMessage = errorText || errorMessage;
            }
          } catch (textError) {
            console.error('❌ Failed to read error response:', textError);
          }
          
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log(`📄 Backend processing result:`, result);
        
        if (result.success) {
          return {
            success: true,
            content: result.content,
            metadata: { 
              ...metadata, 
              pageCount: result.page_count,
              processedBy: 'python-backend'
            }
          };
        } else {
          return {
            success: false,
            content: result.content || `[PDF: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - Backend processing failed]`,
            error: result.error || 'Backend processing failed',
            metadata
          };
        }
        
      } catch (backendError) {
        console.error('📄 Backend PDF processing failed:', backendError);
        return {
          success: false,
          content: `[PDF: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - Backend processing failed: ${backendError instanceof Error ? backendError.message : 'Unknown error'}]`,
          error: `Backend processing failed: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`,
          metadata
        };
      }
    }

    // Handle CSV files
    if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
      const content = await file.text();
      return {
        success: true,
        content: `CSV Data:\n${content.trim()}`,
        metadata
      };
    }

    // Handle JSON files
    if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
      const content = await file.text();
      try {
        // Validate JSON and pretty print it
        const parsed = JSON.parse(content);
        const prettyContent = JSON.stringify(parsed, null, 2);
        return {
          success: true,
          content: `JSON Data:\n${prettyContent}`,
          metadata
        };
      } catch {
        // If JSON is invalid, treat as plain text
        return {
          success: true,
          content: `JSON Data (raw):\n${content.trim()}`,
          metadata
        };
      }
    }

    // Handle markdown files
    if (file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown')) {
      const content = await file.text();
      return {
        success: true,
        content: content.trim(),
        metadata
      };
    }

    // Unsupported file type
    return {
      success: false,
      content: `[File: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - Unsupported file type: ${file.type || 'unknown'}]`,
      error: `Unsupported file type: ${file.type || 'unknown'}`,
      metadata
    };

  } catch (error) {
    console.error('Error processing file:', file.name, error);
    return {
      success: false,
      content: `[File: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - Processing failed]`,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata
    };
  }
}

export function getSupportedFileTypes(): string[] {
  return [
    '.txt', '.pdf', '.csv', '.json', '.md', '.markdown'
  ];
}

export function getFileTypeDescription(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'txt':
      return 'Text file';
    case 'pdf':
      return 'PDF document';
    case 'csv':
      return 'CSV spreadsheet';
    case 'json':
      return 'JSON data file';
    case 'md':
    case 'markdown':
      return 'Markdown document';
    default:
      return 'Unknown file type';
  }
}

// Backend analysis data loading
export interface BackendAnalysisChunk {
  id: string;
  startTime: number;
  endTime: number;
  visual: {
    subjects: string[];
    location: string;
    description: string;
    cameraAngle: string;
    movement: string;
    textOverlay: string;
  };
  audio: {
    speaker: string;
    transcript: string;
    tone: string;
  };
}

export interface BackendAnalysis {
  id: string;
  url: string;
  summary: string;
  visualStyle: string;
  audioStyle: string;
  duration: number;
  chunks: BackendAnalysisChunk[];
}

export interface ScriptChunkFromBackend {
  id: string;
  type: 'HOOK' | 'PRODUCT' | 'CTA';
  script_text: string;
  camera_instruction: string;
}

export async function loadAnalysisFromBackend(url: string): Promise<BackendAnalysis | null> {
  try {
    console.log('🔍 Loading analysis for URL:', url);
    
    // Call backend endpoint to get analysis data
    const response = await fetch('/api/getAnalysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      console.warn('⚠️ No analysis found for URL:', url);
      return null;
    }

    const analysisData = await response.json();
    console.log('✅ Loaded analysis data:', analysisData);
    
    return analysisData;
  } catch (error) {
    console.error('❌ Failed to load analysis:', error);
    return null;
  }
}

export function convertBackendChunksToScript(backendAnalysis: BackendAnalysis): ScriptChunkFromBackend[] {
  console.log('🔄 Converting backend chunks to script format');
  
  const scriptChunks: ScriptChunkFromBackend[] = backendAnalysis.chunks.map((chunk, index) => {
    // Determine chunk type based on position and content
    let chunkType: 'HOOK' | 'PRODUCT' | 'CTA' = 'PRODUCT';
    
    if (index === 0) {
      chunkType = 'HOOK'; // First chunk is typically a hook
    } else if (index === backendAnalysis.chunks.length - 1) {
      chunkType = 'CTA'; // Last chunk is typically a CTA
    } else {
      // Middle chunks are product-focused
      chunkType = 'PRODUCT';
    }

    return {
      id: chunk.id.replace('chunk_', 'script_chunk_'),
      type: chunkType,
      script_text: chunk.audio.transcript,
      camera_instruction: `${chunk.visual.cameraAngle} - ${chunk.visual.description}`
    };
  });

  console.log(`✅ Converted ${scriptChunks.length} chunks to script format`);
  return scriptChunks;
}