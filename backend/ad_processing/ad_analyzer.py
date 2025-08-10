#!/usr/bin/env python3
"""
Advertisement Analyzer for Marketing App
Based on viral-content-analyzer but modified for structured JSON output
"""

import os
import sys
import json
import asyncio
import base64
import io
import logging
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from PIL import Image

# Import settings
sys.path.append(str(Path(__file__).parent.parent))
from config.settings import settings

# Configure logging
logger = logging.getLogger(__name__)

# Import from viral-content-analyzer (assuming it's in Python path or copied)
# We'll copy the essential classes here for now

# Import classes from other modules instead of redefining
from .frame_extractor import FrameData
from .audio_analyzer import AudioExtraction, TranscriptSegment


class AdAnalyzer:
    """
    Advertisement analyzer that produces structured JSON output
    matching the mock data format for the marketing app
    """
    
    def __init__(self, openai_api_key: str = None, config_path: str = None):
        import openai
        
        # Use settings for API key with fallback
        self.openai_api_key = openai_api_key or settings.OPENAI_API_KEY
        if not self.openai_api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY env var or pass openai_api_key parameter.")
        
        self.openai_client = openai.AsyncOpenAI(
            api_key=self.openai_api_key,
            timeout=1200.0  # 20 minute timeout for comprehensive analysis
        )
        self.model = settings.OPENAI_MODEL
        
        # Load prompts from config file
        self.config = self._load_config(config_path)
    
    def _load_config(self, config_path: str = None) -> dict:
        """Load prompts configuration from JSON file."""
        if not config_path:
            # Use settings for config path
            config_path = settings.PROMPTS_FILE
        
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Config file not found: {config_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in config file: {e}")
            raise

    async def analyze_advertisement(
        self, 
        frames: List[FrameData], 
        audio_extraction: AudioExtraction, 
        original_url: str,
        content_description: Optional[str] = None,
        max_frames_per_batch: int = None
    ) -> Dict:
        """
        Analyze advertisement using single API call approach (like viral analyzer).
        Sends ALL frames to OpenAI in one request for better reliability.
        """
        print(f"🤖 Analyzing advertisement with {len(frames)} frames and {len(audio_extraction.transcript_segments)} audio segments...")
        
        # Get jump cut frames only
        jump_cut_frames = [f for f in frames if f.frame_type == 'jump_cut']
        jump_cut_frames.sort(key=lambda f: f.timestamp)
        
        print(f"📹 Found {len(jump_cut_frames)} jump cut frames")
        print(f"✅ Single API call with ALL {len(jump_cut_frames)} frames (viral analyzer approach)")
        
        return await self._analyze_single_call_all_frames(jump_cut_frames, audio_extraction, original_url, content_description)
    
    async def _analyze_single_call_all_frames(
        self, 
        jump_cut_frames: List[FrameData], 
        audio_extraction: AudioExtraction, 
        original_url: str,
        content_description: Optional[str] = None
    ) -> Dict:
        """
        Single API call with ALL frames (viral analyzer approach).
        Uses system + user message structure with better frame preprocessing.
        """
        
        # Build content array with all frames
        content = self._build_single_call_content(
            jump_cut_frames=jump_cut_frames,
            audio_extraction=audio_extraction,
            original_url=original_url,
            content_description=content_description
        )
        
        # Make single API call with all frames
        try:
            # Use structured outputs to force valid JSON response
            response = await self.openai_client.chat.completions.create(
                model="gpt-5",  # Use GPT-5 for better analysis
                messages=[
                    {
                        "role": "system",
                        "content": self.config['video_analysis']['system_prompt']
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "video_analysis",
                        "strict": False,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "url": {"type": "string"},
                                "summary": {"type": "string"},
                                "visualStyle": {"type": "string"},
                                "audioStyle": {"type": "string"},
                                "duration": {"type": "number"},
                                "entities": {
                                    "type": "object"
                                },
                                "chunks": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "startTime": {"type": "number"},
                                            "endTime": {"type": "number"},
                                            "visual": {
                                                "type": "object",
                                                "properties": {
                                                    "subjects": {
                                                        "type": "array",
                                                        "items": {"type": "string"}
                                                    },
                                                    "location": {"type": "string"},
                                                    "description": {"type": "string"},
                                                    "cameraAngle": {"type": "string"},
                                                    "movement": {"type": "string"},
                                                    "textOverlay": {"type": "string"}
                                                },
                                                "required": ["subjects", "location", "description", "cameraAngle", "movement", "textOverlay"],
                                                "additionalProperties": False
                                            },
                                            "audio": {
                                                "type": "object",
                                                "properties": {
                                                    "speaker": {"type": "string"},
                                                    "transcript": {"type": "string"},
                                                    "tone": {"type": "string"}
                                                },
                                                "required": ["transcript", "tone"],
                                                "additionalProperties": False
                                            }
                                        },
                                        "required": ["id", "startTime", "endTime", "visual", "audio"],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": ["id", "url", "summary", "visualStyle", "audioStyle", "duration", "entities", "chunks"],
                            "additionalProperties": False
                        }
                    }
                }
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Debug: Show first 500 chars of response
            print(f"📝 OpenAI Response Preview: {response_text[:500]}...")
            
            # With structured outputs, JSON is guaranteed to be valid
            analysis_json = json.loads(response_text)
            
            # Set URL and validate structure
            analysis_json['url'] = original_url
            if not analysis_json.get('duration') or analysis_json['duration'] <= 0:
                analysis_json['duration'] = audio_extraction.duration
            
            print(f"✅ Single call analysis complete: {len(analysis_json.get('chunks', []))} chunks")
            return analysis_json
            
        except Exception as e:
            print(f"❌ Single call analysis failed: {e}")
            return self._create_fallback_analysis(original_url, audio_extraction.duration)
    
    def _build_single_call_content(
        self, 
        jump_cut_frames: List[FrameData], 
        audio_extraction: AudioExtraction, 
        original_url: str,
        content_description: Optional[str] = None
    ) -> List[Dict]:
        """Build content array for single API call with all frames (viral analyzer style)"""
        content = []
        
        # Add our entity-based prompt 
        content.append({
            "type": "text",
            "text": self.config['video_analysis']['user_prompt']
        })
        
        # Add video information
        content.append({
            "type": "text",
            "text": f"\n\nVIDEO TO ANALYZE:\n- URL: {original_url}\n- Duration: {audio_extraction.duration:.1f} seconds\n- Jump cut frames: {len(jump_cut_frames)}\n"
        })
        
        if content_description:
            content.append({
                "type": "text",
                "text": f"- Content description: {content_description}\n"
            })
        
        # Add frames section (viral analyzer style)
        content.append({
            "type": "text",
            "text": f"\nVIDEO FRAMES (in chronological order):"
        })
        
        for i, frame in enumerate(jump_cut_frames):
            # Add frame description with timestamp
            content.append({
                "type": "text",
                "text": f"\nFrame {i+1} - Timestamp: {frame.timestamp:.2f}s (Duration: {frame.duration:.2f}s, Type: {frame.frame_type})"
            })
            
            try:
                # Use better frame preprocessing (viral analyzer settings)
                base64_image = self._prepare_frame_for_api_viral_style(frame)
                print(f"🔍 Frame {i+1} encoded successfully ({len(base64_image)} chars)")
                
                content.append({
                    "type": "image_url",
                    "image_url": {"url": base64_image}
                })
            except Exception as e:
                error_msg = f"❌ Failed to encode frame {i+1} at {frame.timestamp:.2f}s: {e}"
                print(error_msg)
                logger.error(error_msg)
                raise Exception(f"Frame encoding failed: {error_msg}")
        
        # Add full transcript (viral analyzer style)
        content.append({
            "type": "text",
            "text": f"\n\nAUDIO TRANSCRIPT:\nFull transcript: {audio_extraction.full_transcript}\n\nSegmented transcript:"
        })
        
        for segment in audio_extraction.transcript_segments:
            content.append({
                "type": "text",
                "text": f"\n[{segment.start:.1f}s - {segment.end:.1f}s]: {segment.text}"
            })
        
        # Add final instruction for our entity-based JSON format
        content.append({
            "type": "text",
            "text": f"\n\nAnalyze and return structured JSON with entities and {len(jump_cut_frames)} chunks - one per jump cut frame."
        })
        
        return content
    
    def _prepare_frame_for_api_viral_style(self, frame: FrameData) -> str:
        """Convert frame to base64 using viral analyzer settings (1024px, 85% quality)"""
        try:
            pil_img = frame.to_pil()
            
            # Always convert to RGB mode for JPEG compatibility
            if pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')
            
            # Use 512px max, 70% quality (our working settings)
            max_size = 512
            quality = 70
            
            # Resize if needed
            width, height = pil_img.size
            if max(width, height) > max_size:
                scale = max_size / max(width, height)
                new_width = max(1, int(width * scale))
                new_height = max(1, int(height * scale))
                pil_img = pil_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save to temporary JPEG file first (our proven approach)
            timestamp_str = f"{frame.timestamp:.2f}".replace('.', '_')
            temp_filename = f"temp_frame_{timestamp_str}_{int(time.time())}.jpg"
            temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
            
            try:
                # Step 1: Save to temporary JPEG file
                pil_img.save(temp_path, format='JPEG', quality=quality, optimize=True)
                
                # Step 2: Load the JPEG file back
                saved_img = Image.open(temp_path)
                saved_img.load()
                
                # Step 3: Convert to base64
                buffer = io.BytesIO()
                saved_img.save(buffer, format='JPEG', quality=quality, optimize=True)
                buffer.seek(0)
                
                image_data = buffer.read()
                if len(image_data) == 0:
                    raise ValueError("Generated empty image data")
                
                # Step 4: Validate the JPEG data
                test_buffer = io.BytesIO(image_data)
                test_img = Image.open(test_buffer)
                test_img.verify()
                
                base64_str = base64.b64encode(image_data).decode('utf-8')
                return f"data:image/jpeg;base64,{base64_str}"
            
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception as cleanup_error:
                        logger.warning(f"Failed to cleanup temp file {temp_path}: {cleanup_error}")
            
        except Exception as e:
            logger.error(f"Error converting frame to base64: {e}")
            logger.error(f"Frame timestamp: {frame.timestamp}, type: {frame.frame_type}")
            raise
    
    async def _analyze_single_pass(
        self, 
        jump_cut_frames: List[FrameData], 
        audio_extraction: AudioExtraction, 
        original_url: str, 
        content_description: Optional[str] = None
    ) -> Dict:
        """Single pass analysis for videos with few jump cuts"""
        
        # Build content for single pass
        content = self._build_analysis_content(
            jump_cut_frames=jump_cut_frames,
            audio_extraction=audio_extraction,
            original_url=original_url,
            content_description=content_description,
            is_final=True,
            previous_context=None,
            accumulated_entities=None
        )
        
        # Make API call
        try:
            # Combine system prompt with content (no separate system message for vision API)
            combined_content = [
                {
                    "type": "text",
                    "text": self.config['video_analysis']['system_prompt']
                }
            ] + content
            
            response = await self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": combined_content
                    }
                ],
                max_tokens=settings.MAX_TOKENS,
                temperature=0.2
            )
            
            response_text = response.choices[0].message.content.strip()
            analysis_json = self._parse_json_response(response_text, original_url, audio_extraction.duration)
            
            print(f"✅ Single pass analysis complete: {len(analysis_json.get('chunks', []))} chunks")
            return analysis_json
            
        except Exception as e:
            print(f"❌ Single pass analysis failed: {e}")
            return self._create_fallback_analysis(original_url, audio_extraction.duration)
    
    async def _analyze_multi_pass(
        self, 
        jump_cut_frames: List[FrameData], 
        audio_extraction: AudioExtraction, 
        original_url: str, 
        content_description: Optional[str] = None,
        max_frames_per_batch: int = None,
        max_passes: int = 3
    ) -> Dict:
        """Multi-pass analysis for videos with many jump cuts"""
        
        # Use settings default if not specified
        if max_frames_per_batch is None:
            max_frames_per_batch = getattr(settings, 'MAX_FRAMES_PER_BATCH', 20)
        
        # Split frames into batches
        batches = [jump_cut_frames[i:i + max_frames_per_batch] 
                  for i in range(0, len(jump_cut_frames), max_frames_per_batch)]
        
        # Ensure we don't exceed max_passes
        if len(batches) > max_passes:
            print(f"⚠️ Too many batches ({len(batches)}), limiting to {max_passes}")
            # Redistribute frames more evenly
            new_batch_size = len(jump_cut_frames) // max_passes + 1
            batches = [jump_cut_frames[i:i + new_batch_size] 
                      for i in range(0, len(jump_cut_frames), new_batch_size)]
            batches = batches[:max_passes]  # Ensure exactly max_passes or fewer
        
        print(f"📦 Split into {len(batches)} batches (max {max_passes}): {[len(batch) for batch in batches]} frames each")
        
        all_chunks = []
        previous_context = None
        accumulated_entities = {}
        
        for batch_num, batch_frames in enumerate(batches):
            is_final = (batch_num == len(batches) - 1)
            
            # Show detailed frame information for this batch
            frame_times = [f"{frame.timestamp:.2f}s" for frame in batch_frames]
            print(f"🔄 Processing batch {batch_num + 1}/{len(batches)} ({len(batch_frames)} frames)")
            print(f"   Frame times: {', '.join(frame_times)}")
            
            # Build content for this batch
            content = self._build_analysis_content(
                jump_cut_frames=batch_frames,
                audio_extraction=audio_extraction,
                original_url=original_url,
                content_description=content_description,
                is_final=is_final,
                previous_context=previous_context,
                accumulated_entities=accumulated_entities,
                batch_info=f"Batch {batch_num + 1} of {len(batches)}"
            )
            
            try:
                # Combine system prompt with content (no separate system message for vision API)
                combined_content = [
                    {
                        "type": "text",
                        "text": self._get_batch_system_prompt(is_final)
                    }
                ] + content
                
                response = await self.openai_client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "user",
                            "content": combined_content
                        }
                    ],
                    max_tokens=settings.MAX_TOKENS,
                    temperature=0.2
                )
                
                response_text = response.choices[0].message.content.strip()
                batch_result = self._parse_batch_response(response_text, is_final)
                
                # Extract chunks and context
                if is_final:
                    # Final batch - return complete analysis
                    all_chunks.extend(batch_result.get('chunks', []))
                    
                    final_analysis = {
                        "id": batch_result.get('id', f"ad_multipass_{int(time.time())}"),
                        "url": original_url,
                        "summary": batch_result.get('summary', 'Multi-pass analysis completed'),
                        "visualStyle": batch_result.get('visualStyle', 'Multiple visual styles across shots'),
                        "audioStyle": batch_result.get('audioStyle', 'Varied audio elements throughout'),
                        "duration": audio_extraction.duration,
                        "entities": accumulated_entities,
                        "chunks": all_chunks
                    }
                    
                    print(f"✅ Multi-pass analysis complete: {len(all_chunks)} total chunks")
                    return self._validate_analysis_structure(final_analysis, original_url, audio_extraction.duration)
                else:
                    # Intermediate batch - extract chunks, context, and entities
                    all_chunks.extend(batch_result.get('chunks', []))
                    previous_context = batch_result.get('context', f"Analyzed shots showing various content elements")
                    
                    # Accumulate entities from this batch
                    batch_entities = batch_result.get('entities', {})
                    print(f"🏷️ Batch {batch_num + 1} entities: {len(batch_entities)} types")
                    
                    for entity_type, entities in batch_entities.items():
                        if entity_type not in accumulated_entities:
                            accumulated_entities[entity_type] = []
                        # Add new entities, avoiding duplicates by ID
                        existing_ids = {e.get('id') for e in accumulated_entities[entity_type]}
                        new_entities_added = 0
                        for entity in entities:
                            if entity.get('id') not in existing_ids:
                                accumulated_entities[entity_type].append(entity)
                                new_entities_added += 1
                        print(f"  {entity_type}: {new_entities_added} new (total: {len(accumulated_entities[entity_type])})")
                    
                    entities_summary = f", {sum(len(v) for v in accumulated_entities.values())} entities" if accumulated_entities else ""
                    print(f"📝 Batch {batch_num + 1} complete: {len(batch_result.get('chunks', []))} chunks{entities_summary}, context: {previous_context[:100]}...")
                    
            except Exception as e:
                print(f"❌ Batch {batch_num + 1} failed: {e}")
                # Continue with next batch or return fallback if final
                if is_final:
                    return self._create_fallback_analysis(original_url, audio_extraction.duration)
                else:
                    previous_context = f"Previous batch analysis failed at {batch_frames[0].timestamp:.1f}s"
        
        # Should not reach here
        return self._create_fallback_analysis(original_url, audio_extraction.duration)
    
    def _build_analysis_content(
        self, 
        jump_cut_frames: List[FrameData], 
        audio_extraction: AudioExtraction, 
        original_url: str,
        content_description: Optional[str] = None,
        is_final: bool = True,
        previous_context: Optional[str] = None,
        accumulated_entities: Optional[Dict] = None,
        batch_info: Optional[str] = None
    ) -> List[Dict]:
        """Build content array for API request"""
        content = []
        
        # Add appropriate prompt based on whether it's final or batch
        if is_final:
            content.append({
                "type": "text",
                "text": self.config['video_analysis']['user_prompt']
            })
        else:
            content.append({
                "type": "text", 
                "text": self._get_batch_user_prompt()
            })
        
        # Add video information
        content.append({
            "type": "text",
            "text": f"\n\nVIDEO TO ANALYZE:\n- URL: {original_url}\n- Duration: {audio_extraction.duration:.1f} seconds\n- Jump cut frames in this batch: {len(jump_cut_frames)}\n"
        })
        
        if batch_info:
            content.append({
                "type": "text",
                "text": f"- {batch_info}\n"
            })
        
        if content_description:
            content.append({
                "type": "text",
                "text": f"- Content description: {content_description}\n"
            })
        
        if previous_context and not is_final:
            content.append({
                "type": "text",
                "text": f"- Previous video context: {previous_context}\n"
            })
        
        # Add accumulated entities for non-final batches
        if accumulated_entities and not is_final:
            import json
            entities_text = json.dumps(accumulated_entities, indent=2)
            content.append({
                "type": "text",
                "text": f"- Previously identified entities (reference these by ID, don't redefine):\n{entities_text}\n"
            })
        
        # Add frames
        content.append({
            "type": "text",
            "text": f"\nJUMP CUT FRAMES ({len(jump_cut_frames)} frames):"
        })
        
        for i, frame in enumerate(jump_cut_frames):
            content.append({
                "type": "text",
                "text": f"\n=== JUMP CUT {i+1} at {frame.timestamp:.2f}s ==="
            })
            
            try:
                print(f"🔍 Processing frame {i+1}/{len(jump_cut_frames)} at {frame.timestamp:.2f}s...")
                base64_image = frame.to_base64()
                
                # Validate base64 string
                if not base64_image.startswith("data:image/jpeg;base64,"):
                    error_msg = f"Invalid base64 format for frame at {frame.timestamp:.2f}s"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                
                print(f"✅ Frame {i+1} encoded successfully ({len(base64_image)} chars)")
                content.append({
                    "type": "image_url",
                    "image_url": {"url": base64_image}
                })
            except Exception as e:
                error_msg = f"❌ Failed to encode frame {i+1} at {frame.timestamp:.2f}s: {e}"
                print(error_msg)
                logger.error(error_msg)
                # Don't add placeholder text - let the batch fail completely
                raise Exception(f"Frame encoding failed: {error_msg}")
        
        # Add relevant audio segments
        if is_final:
            # Full transcript for final analysis
            content.append({
                "type": "text",
                "text": f"\n\nFULL AUDIO TRANSCRIPT:\n\"{audio_extraction.full_transcript}\""
            })
        else:
            # Just segments for this time range
            start_time = jump_cut_frames[0].timestamp - 2.0  # Buffer
            end_time = jump_cut_frames[-1].timestamp + 2.0   # Buffer
            
            relevant_segments = [
                seg for seg in audio_extraction.transcript_segments
                if seg.start >= start_time and seg.end <= end_time
            ]
            
            if relevant_segments:
                content.append({
                    "type": "text",
                    "text": f"\n\nRELEVANT AUDIO SEGMENTS ({start_time:.1f}s - {end_time:.1f}s):"
                })
                
                for segment in relevant_segments:
                    content.append({
                        "type": "text",
                        "text": f"[{segment.start:.1f}s - {segment.end:.1f}s]: \"{segment.text}\""
                    })
        
        # Add final instruction
        if is_final:
            content.append({
                "type": "text",
                "text": f"\n\nAnalyze and return structured JSON with {len(jump_cut_frames)} chunks - one per jump cut frame."
            })
        else:
            content.append({
                "type": "text",
                "text": f"\n\nAnalyze these {len(jump_cut_frames)} shots and return JSON with chunks plus context for remaining video."
            })
        
        return content
    
    def _get_batch_system_prompt(self, is_final: bool) -> str:
        """Get system prompt for batch processing"""
        if is_final:
            return self.config['video_analysis']['system_prompt']
        else:
            return "You are an expert video analyzer processing video content in batches. Return JSON with chunks and context for remaining content."
    
    def _get_batch_user_prompt(self) -> str:
        """Get user prompt for batch processing (non-final)"""
        return """Analyze this batch of jump cut frames from a short-form video. This is part of a larger video being processed in segments.

If this is the FIRST batch: Identify recurring entities (people, products, locations) and define them in the entities section.
If NOT the first batch: Use the previously identified entities by referencing their IDs. Only add NEW entities if they appear for the first time.

REQUIRED JSON STRUCTURE:
{
  "entities": {
    "people": [
      {
        "id": "person_1",
        "role": "presenter|customer|model|etc",
        "appearance": "detailed physical description, base outfit, distinguishing features",
        "demographics": "approximate age, gender, ethnicity if relevant"
      }
    ],
    "products": [
      {
        "id": "product_1",
        "name": "product name or type",
        "description": "detailed product description, brand, color, size, packaging",
        "category": "electronics|beauty|food|etc"
      }
    ],
    "locations": [
      {
        "id": "location_1",
        "type": "kitchen|studio|outdoor|store|etc",
        "description": "detailed setting description, furniture, decor, ambiance",
        "lighting": "natural|studio|mixed"
      }
    ]
  },
  "chunks": [
    {
      "id": "chunk_001", 
      "type": "shot",
      "startTime": 0.0,
      "endTime": 11.5,
      "visual": {
        "subjects": ["person_1", "product_1"],
        "location": "location_1",
        "action": "what the subjects are doing in this shot",
        "subjectChanges": {
          "person_1": "any changes from base description (gesture, expression, position)",
          "product_1": "how product is shown (held, displayed, used)"
        },
        "cameraAngle": "camera angle and framing for this shot",
        "movement": "camera or subject movement in this shot",
        "textOverlay": "any text overlays or graphics in this shot",
        "newElements": "any elements not in entities list"
      },
      "audio": {
        "speaker": "person_1|narrator|none",
        "transcript": "spoken words during this time segment",
        "tone": "vocal delivery style during this segment",
        "backgroundMusic": "music during this segment",
        "volume": "volume level during this segment"
      }
    }
  ],
  "context": "Brief description of what this batch covered for context in analyzing the rest of the video"
}

Create one chunk per jump cut frame, reference entities by ID, and include context for the remaining video analysis."""
    
    def _parse_batch_response(self, response_text: str, is_final: bool) -> Dict:
        """Parse response from batch processing"""
        try:
            # Clean up response
            cleaned_response = response_text.strip()
            
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            # Parse JSON
            result = json.loads(cleaned_response)
            
            if is_final:
                return result  # Should be complete analysis
            else:
                return {
                    'chunks': result.get('chunks', []),
                    'context': result.get('context', 'No context provided'),
                    'entities': result.get('entities', {})
                }
                
        except Exception as e:
            print(f"⚠️ Batch JSON parsing failed: {e}")
            return {'chunks': [], 'context': 'Parsing failed', 'entities': {}}
    
    def _parse_json_response(self, response_text: str, original_url: str, duration: float) -> Dict:
        """Parse and validate JSON response"""
        try:
            # Clean up response
            cleaned_response = response_text.strip()
            
            # Remove markdown code blocks if present
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            # Additional cleanup for common JSON issues
            # Remove any text before the first { or after the last }
            start_idx = cleaned_response.find('{')
            end_idx = cleaned_response.rfind('}')
            
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                cleaned_response = cleaned_response[start_idx:end_idx + 1]
            else:
                raise ValueError("No valid JSON object found in response")
            
            # Fix common JSON formatting issues
            cleaned_response = self._fix_json_formatting(cleaned_response)
            
            # Parse JSON
            analysis = json.loads(cleaned_response)
            
            # Validate and enhance structure
            return self._validate_analysis_structure(analysis, original_url, duration)
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parsing failed at line {e.lineno}, column {e.colno}: {e.msg}")
            print(f"📝 Response preview (first 500 chars): {response_text[:500]}")
            print(f"📝 Cleaned response preview (chars around error): {cleaned_response[max(0, e.pos-100):e.pos+100]}")
            return self._create_fallback_analysis(original_url, duration)
        except Exception as e:
            print(f"⚠️ JSON parsing failed: {e}")
            print(f"📝 Response preview: {response_text[:500]}")
            return self._create_fallback_analysis(original_url, duration)
    
    def _fix_json_formatting(self, json_str: str) -> str:
        """Fix common JSON formatting issues that cause parsing errors"""
        try:
            # Remove any trailing commas before closing braces/brackets
            import re
            
            # Fix trailing comma before closing brace
            json_str = re.sub(r',(\s*})', r'\1', json_str)
            # Fix trailing comma before closing bracket 
            json_str = re.sub(r',(\s*])', r'\1', json_str)
            
            # Fix unescaped quotes in strings (basic attempt)
            # This is a simple fix - more complex scenarios might need better handling
            json_str = re.sub(r'(?<!\\)"(?=[^,}\]]*[,}\]])', r'\\"', json_str)
            
            # Remove any non-printable characters that might cause issues
            json_str = ''.join(char for char in json_str if char.isprintable() or char in '\n\t\r')
            
            return json_str
            
        except Exception as e:
            print(f"⚠️ JSON formatting fix failed: {e}")
            return json_str
    
    def _validate_analysis_structure(self, analysis: Dict, original_url: str, duration: float) -> Dict:
        """Validate and enhance the analysis structure"""
        # Generate ID if not provided
        if not analysis.get('id'):
            analysis['id'] = f"ad_{int(time.time())}_{hash(original_url) % 10000}"
        
        # Set URL
        analysis['url'] = original_url
        
        # Validate duration
        if not analysis.get('duration') or analysis['duration'] <= 0:
            analysis['duration'] = duration
        
        # Ensure required fields
        if not analysis.get('summary'):
            analysis['summary'] = 'Advertisement analysis completed'
        if not analysis.get('visualStyle'):
            analysis['visualStyle'] = 'Standard video production style'
        if not analysis.get('audioStyle'):
            analysis['audioStyle'] = 'Standard audio with speech and background elements'
        
        # Validate chunks
        if not isinstance(analysis.get('chunks'), list):
            analysis['chunks'] = []
        
        # Enhance chunks
        for i, chunk in enumerate(analysis['chunks']):
            if not chunk.get('id'):
                chunk['id'] = f"chunk_{str(i + 1).zfill(3)}"
            
            # Validate chunk type
            if chunk.get('type') not in ['hook', 'body', 'cta']:
                if i == 0:
                    chunk['type'] = 'hook'
                elif i == len(analysis['chunks']) - 1:
                    chunk['type'] = 'cta'
                else:
                    chunk['type'] = 'body'
            
            # Ensure visual and audio objects exist with all required fields
            if not chunk.get('visual'):
                chunk['visual'] = {}
            if not chunk.get('audio'):
                chunk['audio'] = {}
            
            # Fill missing visual fields
            visual_defaults = {
                'description': 'Visual content analysis',
                'cameraAngle': 'standard framing',
                'lighting': 'standard lighting',
                'movement': 'minimal camera movement',
                'textOverlay': '',
                'background': 'not specified'
            }
            for key, default in visual_defaults.items():
                if not chunk['visual'].get(key):
                    chunk['visual'][key] = default
            
            # Fill missing audio fields
            audio_defaults = {
                'transcript': '',
                'tone': 'conversational',
                'backgroundMusic': 'not specified',
                'volume': 'medium'
            }
            for key, default in audio_defaults.items():
                if not chunk['audio'].get(key):
                    chunk['audio'][key] = default
        
        return analysis
    
    def _group_frames_by_scenes(self, frames: List[FrameData]) -> Dict[int, List[FrameData]]:
        """
        Group frames by their scene_id for scene-based analysis.
        
        Returns:
            Dict mapping scene_id to list of frames in that scene
        """
        scenes = {}
        for frame in frames:
            scene_id = frame.scene_id or 1  # Default to scene 1 if no scene_id
            if scene_id not in scenes:
                scenes[scene_id] = []
            scenes[scene_id].append(frame)
        
        # Sort frames within each scene by timestamp
        for scene_id in scenes:
            scenes[scene_id].sort(key=lambda f: f.timestamp)
        
        return scenes
    
    def _create_fallback_analysis(self, original_url: str, duration: float) -> Dict:
        """Create fallback analysis structure"""
        return {
            "id": f"ad_fallback_{int(time.time())}",
            "url": original_url,
            "summary": "Analysis parsing failed - manual review required",
            "visualStyle": "Unable to determine visual style",
            "audioStyle": "Unable to determine audio style",
            "duration": duration,
            "chunks": [
                {
                    "id": "chunk_001",
                    "type": "hook",
                    "startTime": 0,
                    "endTime": min(5, duration),
                    "visual": {
                        "description": "Analysis failed - manual review needed",
                        "cameraAngle": "unknown",
                        "lighting": "unknown",
                        "movement": "unknown",
                        "textOverlay": "",
                        "background": "unknown"
                    },
                    "audio": {
                        "transcript": "Analysis failed",
                        "tone": "unknown",
                        "backgroundMusic": "unknown",
                        "volume": "unknown"
                    }
                }
            ]
        }