#!/usr/bin/env python3
"""
Simple jump cut debug tool that generates an HTML report
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from ad_processing import ViralFrameExtractor
from ad_processing.frame_extractor import _is_jump_cut
import tempfile
import yt_dlp
import cv2
import base64
from io import BytesIO
from PIL import Image
import json

def frame_to_base64(frame, size=(200, 200)):
    """Convert frame to base64 for HTML embedding"""
    # Convert BGR to RGB
    if len(frame.shape) == 3:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    else:
        rgb_frame = frame
    
    # Convert to PIL Image
    pil_img = Image.fromarray(rgb_frame)
    
    # Resize
    pil_img.thumbnail(size, Image.Resampling.LANCZOS)
    
    # Convert to base64
    buffer = BytesIO()
    pil_img.save(buffer, format='JPEG', quality=70)
    buffer.seek(0)
    
    img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
    return f"data:image/jpeg;base64,{img_base64}"

def analyze_jump_cuts(video_url):
    """Analyze jump cuts and generate HTML report"""
    
    print(f"📥 Downloading video: {video_url}")
    
    # Download video
    temp_video_path = tempfile.mktemp(suffix='.mp4')
    
    ydl_opts = {
        'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
        'outtmpl': temp_video_path,
        'no_warnings': True,
    }
    
    # Try to add Chrome cookies if available
    try:
        ydl_opts['cookiesfrombrowser'] = ('chrome', None, None, None)
        print("Using Chrome cookies for download")
    except Exception:
        print("Chrome cookies not available, trying without")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return
    
    print(f"✅ Video downloaded")
    
    # Initialize extractor
    extractor = ViralFrameExtractor(jump_cut_threshold=0.73)
    
    # Get video length
    video_length = extractor.get_video_length(temp_video_path)
    print(f"📹 Video duration: {video_length:.2f}s")
    
    # Extract frames at 6 FPS for analysis
    fps = 6.0
    interval = 1.0 / fps
    
    frames_data = []
    current_time = 0.0
    
    print(f"🎬 Extracting frames at 6 FPS...")
    
    while current_time < video_length:
        frame = extractor.extract_single_frame(temp_video_path, current_time)
        if frame:
            frames_data.append({
                'timestamp': current_time,
                'image': frame.image,
                'base64': frame_to_base64(frame.image)
            })
        current_time += interval
    
    print(f"✅ Extracted {len(frames_data)} frames")
    
    # Calculate similarity scores
    print(f"📊 Calculating similarity scores...")
    
    results = []
    for i in range(len(frames_data)):
        if i == 0:
            # First frame
            results.append({
                'index': 0,
                'timestamp': frames_data[0]['timestamp'],
                'image': frames_data[0]['base64'],
                'combined_similarity': 0.0,
                'delta_intensity': 0.0,
                'is_jump_cut': True,
                'vetoed': False
            })
        else:
            # Compare with previous frame
            is_jump_cut, metrics = _is_jump_cut(
                frames_data[i-1]['image'], 
                frames_data[i]['image'], 
                threshold=0.73
            )
            
            results.append({
                'index': i,
                'timestamp': frames_data[i]['timestamp'],
                'image': frames_data[i]['base64'],
                'combined_similarity': metrics['combined_similarity'],
                'delta_intensity': metrics['delta_intensity'],
                'is_jump_cut': is_jump_cut,
                'vetoed': metrics['initial_jump_cut'] and metrics['delta_intensity_veto']
            })
    
    # Count jump cuts
    jump_cut_count = sum(1 for r in results if r['is_jump_cut'])
    vetoed_count = sum(1 for r in results if r['vetoed'])
    
    print(f"✅ Found {jump_cut_count} jump cuts ({vetoed_count} were vetoed)")
    
    # Generate HTML report
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Jump Cut Debug Report</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            background: #1a1a1a;
            color: #e0e0e0;
            padding: 20px;
        }}
        h1 {{
            color: #fff;
            border-bottom: 2px solid #444;
            padding-bottom: 10px;
        }}
        .summary {{
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }}
        .frame-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}
        .frame-card {{
            background: #2a2a2a;
            border: 2px solid #444;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
        }}
        .frame-card.jump-cut {{
            border-color: #00ff00;
            background: #1a3a1a;
        }}
        .frame-card.vetoed {{
            border-color: #ff9900;
            background: #3a2a1a;
        }}
        .frame-card img {{
            width: 100%;
            border-radius: 4px;
        }}
        .metrics {{
            font-size: 12px;
            margin-top: 8px;
        }}
        .threshold-control {{
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }}
        .threshold-control input {{
            width: 200px;
        }}
        .legend {{
            display: flex;
            gap: 20px;
            margin: 10px 0;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .legend-box {{
            width: 20px;
            height: 20px;
            border: 2px solid;
            border-radius: 4px;
        }}
    </style>
</head>
<body>
    <h1>Jump Cut Debug Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Video URL:</strong> {video_url}</p>
        <p><strong>Duration:</strong> {video_length:.2f} seconds</p>
        <p><strong>Frames analyzed:</strong> {len(results)}</p>
        <p><strong>Jump cuts detected:</strong> {jump_cut_count}</p>
        <p><strong>Vetoed by delta intensity:</strong> {vetoed_count}</p>
        <p><strong>Current threshold:</strong> 0.73</p>
    </div>
    
    <div class="legend">
        <div class="legend-item">
            <div class="legend-box" style="border-color: #00ff00; background: #1a3a1a;"></div>
            <span>Jump Cut Detected</span>
        </div>
        <div class="legend-item">
            <div class="legend-box" style="border-color: #ff9900; background: #3a2a1a;"></div>
            <span>Vetoed (False Positive)</span>
        </div>
        <div class="legend-item">
            <div class="legend-box" style="border-color: #444; background: #2a2a2a;"></div>
            <span>No Jump Cut</span>
        </div>
    </div>
    
    <div class="threshold-control">
        <h3>Threshold Control</h3>
        <label>
            Similarity Threshold: 
            <input type="range" id="threshold" min="0.5" max="0.9" step="0.01" value="0.73">
            <span id="threshold-value">0.73</span>
        </label>
        <button onclick="recalculate()">Recalculate</button>
    </div>
    
    <h2>Frame Analysis</h2>
    <div class="frame-grid" id="frame-grid">
"""
    
    # Add frame cards
    for r in results:
        card_class = "frame-card"
        if r['is_jump_cut']:
            card_class += " jump-cut"
        elif r['vetoed']:
            card_class += " vetoed"
        
        html += f"""
        <div class="{card_class}" data-index="{r['index']}">
            <img src="{r['image']}" alt="Frame {r['index']}">
            <div class="metrics">
                <strong>Frame {r['index']} - {r['timestamp']:.2f}s</strong><br>
                Combined: {r['combined_similarity']:.3f}<br>
                Delta Int: {r['delta_intensity']:.3f}<br>
                {'✅ JUMP CUT' if r['is_jump_cut'] else '🟡 VETOED' if r['vetoed'] else ''}
            </div>
        </div>
"""
    
    html += f"""
    </div>
    
    <script>
        const frameData = {json.dumps(results, default=str)};
        
        document.getElementById('threshold').addEventListener('input', function(e) {{
            document.getElementById('threshold-value').textContent = e.target.value;
        }});
        
        function recalculate() {{
            const threshold = parseFloat(document.getElementById('threshold').value);
            let jumpCutCount = 0;
            let vetoedCount = 0;
            
            frameData.forEach((frame, index) => {{
                if (index === 0) return; // First frame always jump cut
                
                const card = document.querySelector(`[data-index="${{index}}"]`);
                const isInitialJumpCut = frame.combined_similarity < threshold;
                const deltaVeto = frame.delta_intensity > 0.9;
                const isJumpCut = isInitialJumpCut && !deltaVeto;
                
                card.className = 'frame-card';
                if (isJumpCut) {{
                    card.className += ' jump-cut';
                    jumpCutCount++;
                }} else if (isInitialJumpCut && deltaVeto) {{
                    card.className += ' vetoed';
                    vetoedCount++;
                }}
            }});
            
            alert(`With threshold ${{threshold}}:\\nJump cuts: ${{jumpCutCount}}\\nVetoed: ${{vetoedCount}}`);
        }}
    </script>
</body>
</html>
"""
    
    # Save report
    report_path = Path("jump_cut_debug_report_new.html")
    report_path.write_text(html)
    
    print(f"✅ Report saved to: {report_path}")
    
    # Cleanup
    try:
        Path(temp_video_path).unlink(missing_ok=True)
    except:
        pass
    
    return str(report_path)

if __name__ == "__main__":
    url = "https://www.instagram.com/reels/DNEgqLpyF1M/"
    report_path = analyze_jump_cuts(url)
    if report_path:
        print(f"\n📊 Open the report: file://{Path(report_path).absolute()}")