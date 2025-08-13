#!/usr/bin/env python3
"""
Estimate token usage for OpenAI API calls with compressed images
"""

import base64
from PIL import Image
import io
import math

def estimate_image_tokens(width: int, height: int, quality: int = 70) -> int:
    """
    Estimate tokens for a base64 encoded JPEG image.
    Based on OpenAI's documentation for vision models.
    """
    # OpenAI uses a tile-based approach for images
    # Base cost is 85 tokens, then 170 tokens per 512x512 tile
    
    # Calculate number of tiles (512x512 each)
    tiles_x = math.ceil(width / 512)
    tiles_y = math.ceil(height / 512)
    total_tiles = tiles_x * tiles_y
    
    # Base cost + tile costs
    # For images ≤512px: just base cost + 1 tile
    if width <= 512 and height <= 512:
        estimated_tokens = 85 + 170  # 255 tokens for small images
    else:
        estimated_tokens = 85 + (170 * total_tiles)
    
    return int(estimated_tokens)

def estimate_total_tokens(num_frames: int, image_size: int = 512, quality: int = 70, text_tokens: int = 2000) -> dict:
    """
    Estimate total token usage for an API call with multiple frames.
    
    Args:
        num_frames: Number of frames to send
        image_size: Max dimension of images (512 default)
        quality: JPEG quality (70 default)
        text_tokens: Estimated text/prompt tokens
    """
    # Estimate tokens per image (assuming square aspect ratio)
    tokens_per_image = estimate_image_tokens(image_size, image_size, quality)
    
    # Total image tokens
    total_image_tokens = tokens_per_image * num_frames
    
    # Total with text
    total_tokens = total_image_tokens + text_tokens
    
    return {
        'tokens_per_image': tokens_per_image,
        'total_image_tokens': total_image_tokens,
        'text_tokens': text_tokens,
        'total_tokens': total_tokens,
        'estimated_cost_gpt4': total_tokens * 0.00001,  # $0.01 per 1K tokens
        'fits_in_context': total_tokens < 128000  # GPT-4 Vision context limit
    }

if __name__ == "__main__":
    print("Token Usage Estimates for Ad Analysis")
    print("=" * 50)
    
    # Old settings (1024px, quality 85, 8 frames max)
    old = estimate_total_tokens(8, 1024, 85)
    print("\nOLD SETTINGS (1024px, quality 85, 8 frames):")
    print(f"  Per image: {old['tokens_per_image']:,} tokens")
    print(f"  Total: {old['total_tokens']:,} tokens")
    print(f"  Cost: ${old['estimated_cost_gpt4']:.3f}")
    
    # New settings (512px, quality 70, 20 frames)
    new = estimate_total_tokens(20, 512, 70)
    print("\nNEW SETTINGS (512px, quality 70, 20 frames):")
    print(f"  Per image: {new['tokens_per_image']:,} tokens")
    print(f"  Total: {new['total_tokens']:,} tokens")
    print(f"  Cost: ${new['estimated_cost_gpt4']:.3f}")
    print(f"  Fits in context: {new['fits_in_context']}")
    
    # Maximum safe frames
    print("\nMAXIMUM FRAMES AT NEW SETTINGS:")
    for frames in [20, 25, 30, 35, 40]:
        est = estimate_total_tokens(frames, 512, 70)
        status = "✅" if est['fits_in_context'] else "❌"
        print(f"  {frames} frames: {est['total_tokens']:,} tokens {status}")
    
    # Token reduction
    reduction = (1 - new['tokens_per_image']/old['tokens_per_image']) * 100
    print(f"\nToken reduction per image: {reduction:.1f}%")
    print(f"Can now send {20/8:.1f}x more frames in similar token budget")