// Utility functions to convert between old chunk format and new section format
import { Script, LegacyScript, ScriptSection, ScriptChunk, VideoType } from '../types';

/**
 * Convert legacy chunk-based script to new section-based format
 * Groups consecutive chunks into logical sections
 */
export function convertChunksToSections(legacyScript: LegacyScript): Script {
  if (!legacyScript.chunks || legacyScript.chunks.length === 0) {
    return {
      id: legacyScript.id,
      title: legacyScript.title || 'Untitled Script',
      sections: []
    };
  }

  // Group chunks into sections (simple heuristic: group by type changes or every 3-4 chunks)
  const sections: ScriptSection[] = [];
  let currentSection: ScriptChunk[] = [];
  let currentType = legacyScript.chunks[0].type;
  
  legacyScript.chunks.forEach((chunk, index) => {
    const normalizedType = chunk.type.toUpperCase() as 'HOOK' | 'BODY' | 'CTA';
    
    // Start new section if type changes or we have 4 chunks in current section
    if (normalizedType !== currentType || currentSection.length >= 4) {
      if (currentSection.length > 0) {
        sections.push(createSectionFromChunks(currentSection, currentType as any));
      }
      currentSection = [chunk];
      currentType = normalizedType;
    } else {
      currentSection.push(chunk);
    }
    
    // Handle last section
    if (index === legacyScript.chunks.length - 1 && currentSection.length > 0) {
      sections.push(createSectionFromChunks(currentSection, currentType as any));
    }
  });

  return {
    id: legacyScript.id,
    title: legacyScript.title || 'Untitled Script',
    sections,
    projectId: legacyScript.projectId,
    status: legacyScript.status,
    createdAt: legacyScript.createdAt,
    updatedAt: legacyScript.updatedAt
  };
}

/**
 * Create a section from a group of chunks
 */
function createSectionFromChunks(chunks: ScriptChunk[], type: 'HOOK' | 'BODY' | 'CTA'): ScriptSection {
  // Combine script texts
  const script_text = chunks
    .map(c => c.script_text || '')
    .filter(text => text.length > 0)
    .join(' ');
  
  // Determine video type based on chunks
  const video_type = determineVideoType(chunks);
  
  // Create shots from chunks
  const shots = chunks.map(chunk => ({
    camera: chunk.camera_instruction || chunk.metadata?.cameraDirection || '',
    portion: chunk.script_text || ''
  }));

  return {
    id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    script_text,
    video_type,
    shots,
    source: video_type === 'JUMP_CUTS' ? 'single_video' : 'multiple_videos'
  };
}

/**
 * Determine the most appropriate video type for a group of chunks
 */
function determineVideoType(chunks: ScriptChunk[]): VideoType {
  // Simple heuristic - can be improved with more sophisticated analysis
  const cameraInstructions = chunks.map(c => 
    (c.camera_instruction || c.metadata?.cameraDirection || '').toLowerCase()
  );
  
  // Check for overlay indicators
  if (cameraInstructions.some(inst => 
    inst.includes('overlay') || 
    inst.includes('b-roll') || 
    inst.includes('cutaway')
  )) {
    return 'A_ROLL_WITH_OVERLAY';
  }
  
  // Check for split screen indicators
  if (cameraInstructions.some(inst => 
    inst.includes('split') || 
    inst.includes('side by side') || 
    inst.includes('comparison')
  )) {
    return 'SPLIT_SCREEN';
  }
  
  // Check if all shots seem to be from same angle/setup (jump cuts)
  const hasConsistentSetup = cameraInstructions.every(inst => 
    inst.includes('same') || 
    inst.includes('continue') || 
    inst.includes('cut to')
  );
  
  if (hasConsistentSetup) {
    return 'JUMP_CUTS';
  }
  
  // Default to B_ROLL for varied shots
  return 'B_ROLL';
}

/**
 * Convert new section-based script back to chunk format (for backward compatibility)
 */
export function convertSectionsToChunks(script: Script): LegacyScript {
  const chunks: ScriptChunk[] = [];
  
  script.sections.forEach(section => {
    // Extract shots based on video type
    const shots = extractShotsFromSection(section);
    
    shots.forEach((shot, index) => {
      chunks.push({
        id: `${section.id}_chunk_${index}`,
        type: section.type.toLowerCase() as 'hook' | 'body' | 'cta',
        script_text: shot.portion || section.script_text,
        camera_instruction: shot.camera
      });
    });
  });

  return {
    id: script.id,
    title: script.title,
    chunks,
    projectId: script.projectId,
    status: script.status,
    createdAt: script.createdAt,
    updatedAt: script.updatedAt
  };
}

/**
 * Extract shots from a section based on its video type
 */
function extractShotsFromSection(section: ScriptSection): Array<{camera: string, portion: string}> {
  switch (section.video_type) {
    case 'JUMP_CUTS':
    case 'B_ROLL':
      return section.shots || [];
      
    case 'A_ROLL_WITH_OVERLAY':
      const baseShot = section.base_layer ? 
        [{camera: section.base_layer.camera, portion: section.script_text}] : [];
      const overlayShots = section.overlay_shots || [];
      return [...baseShot, ...overlayShots];
      
    case 'SPLIT_SCREEN':
      return [
        {camera: section.main_video?.camera || '', portion: section.script_text},
        {camera: section.secondary_video?.camera || '', portion: ''}
      ];
      
    default:
      return [{camera: '', portion: section.script_text}];
  }
}

/**
 * Check if a script is using the new section format
 */
export function isNewFormat(script: any): boolean {
  return 'sections' in script && Array.isArray(script.sections);
}

/**
 * Ensure script is in new format (convert if needed)
 */
export function ensureNewFormat(script: any): Script {
  if (isNewFormat(script)) {
    return script as Script;
  }
  return convertChunksToSections(script as LegacyScript);
}

/**
 * Ensure script is in old format (convert if needed) 
 */
export function ensureOldFormat(script: any): LegacyScript {
  if (!isNewFormat(script)) {
    return script as LegacyScript;
  }
  return convertSectionsToChunks(script as Script);
}