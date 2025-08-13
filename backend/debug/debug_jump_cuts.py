#!/usr/bin/env python3
"""
Debug tool for jump cut detection - visualize frame comparisons and similarity scores
Usage: 
  python debug_jump_cuts.py                    # Load existing jump_cut_debug_report.html
  python debug_jump_cuts.py <video_url_or_path>  # Process new video and generate report
"""

import asyncio
import sys
import tempfile
import base64
import io
import re
import json
import subprocess
import signal
import os
from pathlib import Path
from flask import Flask, render_template_string, request, jsonify
import cv2
import numpy as np
from PIL import Image

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ad_processing import ViralFrameExtractor
from ad_processing.frame_extractor import _combined_similarity, _histogram_comparison, _perceptual_hash, _difference_hash, _delta_intensity, _is_jump_cut

app = Flask(__name__)

# Global data
frame_pairs = []
video_info = {}

def kill_port(port):
    """Kill any process running on the specified port"""
    try:
        # Find process using the port
        result = subprocess.run(['lsof', '-ti', f':{port}'], 
                              capture_output=True, text=True, check=False)
        
        if result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                try:
                    os.kill(int(pid), signal.SIGTERM)
                    print(f"🔄 Killed process {pid} on port {port}")
                except (ProcessLookupError, ValueError):
                    pass
    except FileNotFoundError:
        # lsof not available, try alternative method
        try:
            result = subprocess.run(['netstat', '-tulpn'], 
                                  capture_output=True, text=True, check=False)
            # This is more complex parsing, but lsof should be available on macOS
            pass
        except FileNotFoundError:
            pass  # Skip port killing if tools not available

def frame_to_base64(frame_image):
    """Convert frame image to base64 for web display"""
    # Convert BGR to RGB
    rgb_image = cv2.cvtColor(frame_image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb_image)
    
    # Resize for web display
    pil_image.thumbnail((400, 300), Image.Resampling.LANCZOS)
    
    # Convert to base64
    buffer = io.BytesIO()
    pil_image.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    
    base64_str = base64.b64encode(buffer.read()).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_str}"

@app.route('/')
def index():
    """Main debug interface"""
    # If no frame data loaded, show file selection
    if not frame_pairs:
        return render_template_string(get_file_selection_html())
    
    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Jump Cut Detection Debugger</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .controls { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .frames-container { display: flex; gap: 20px; margin-bottom: 20px; }
            .frame-box { flex: 1; background: white; padding: 15px; border-radius: 8px; text-align: center; }
            .frame-img { max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 4px; }
            .similarity-info { background: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
            .jump-cut-yes { color: red; font-weight: bold; }
            .jump-cut-no { color: green; font-weight: bold; }
            .stats { background: white; padding: 15px; border-radius: 8px; }
            .navigation { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
            .threshold-control { display: flex; align-items: center; gap: 10px; }
            button { padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            button:hover:not(:disabled) { background: #0056b3; }
            input[type="range"] { width: 200px; }
            .loading { text-align: center; padding: 50px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Jump Cut Detection Debugger</h1>
                <p>Video: <strong id="video-info">Loading...</strong></p>
            </div>
            
            <div class="controls">
                <div class="navigation">
                    <button id="prev-btn" onclick="prevPair()" disabled>← Previous</button>
                    <button id="next-btn" onclick="nextPair()" disabled>Next →</button>
                    <span id="pair-info" style="margin-left: 20px;">Pair 0 of 0</span>
                </div>
                
                <div class="threshold-control">
                    <label>Threshold:</label>
                    <input type="range" id="threshold" min="0" max="1" step="0.01" value="0.73" onchange="updateThreshold()">
                    <span id="threshold-value">0.73</span>
                </div>
            </div>
            
            <div class="frames-container">
                <div class="frame-box">
                    <h3>Previous Frame</h3>
                    <img id="prev-frame" class="frame-img" src="" alt="Previous frame">
                    <p id="prev-frame-info">Time: --</p>
                </div>
                
                <div class="frame-box">
                    <h3>Current Frame</h3>
                    <img id="curr-frame" class="frame-img" src="" alt="Current frame">
                    <p id="curr-frame-info">Time: --</p>
                </div>
            </div>
            
            <div class="similarity-info">
                <h3 id="similarity-score">Similarity Score: --</h3>
                <div style="font-size: 14px; margin: 10px 0;">
                    <span style="color: #666;">Components:</span>
                    <span id="histogram-score" style="margin: 0 10px;">Histogram: --</span>
                    <span id="phash-score" style="margin: 0 10px;">Perceptual Hash: --</span>
                    <span id="dhash-score" style="margin: 0 10px;">Difference Hash: --</span>
                    <span id="delta-intensity-score" style="margin: 0 10px;">Delta Intensity: --</span>
                </div>
                <p id="jump-cut-status">--</p>
                <div id="jump-cut-details" style="font-size: 12px; color: #666; margin-top: 10px; display: none;">
                    <div>Initial Detection: <span id="initial-jump-cut">--</span></div>
                    <div>Delta Intensity Veto: <span id="delta-veto">--</span></div>
                    <div>Final Result: <span id="final-jump-cut">--</span></div>
                </div>
            </div>
            
            <div class="stats">
                <h3>Statistics</h3>
                <p id="stats-info">Jump Cuts: -- | Similarity Range: -- | Average: --</p>
            </div>
            
            <div id="loading" class="loading">
                <p>Loading frame data...</p>
            </div>
        </div>

        <script>
            let currentPair = 0;
            let frameData = [];
            let threshold = 0.73;

            // Load frame data on page load
            fetch('/api/frame_data')
                .then(response => response.json())
                .then(data => {
                    frameData = data.pairs;
                    document.getElementById('video-info').textContent = data.video_info;
                    document.getElementById('loading').style.display = 'none';
                    updateDisplay();
                })
                .catch(error => {
                    console.error('Error loading frame data:', error);
                    document.getElementById('loading').innerHTML = '<p>Error loading frame data</p>';
                });

            function updateDisplay() {
                if (frameData.length === 0) return;

                const pair = frameData[currentPair];
                
                // Update pair info
                document.getElementById('pair-info').textContent = `Pair ${currentPair + 1} of ${frameData.length}`;
                
                // Update images
                document.getElementById('prev-frame').src = pair.prev_image;
                document.getElementById('curr-frame').src = pair.curr_image;
                
                // Update frame info
                document.getElementById('prev-frame-info').textContent = `Time: ${pair.prev_time.toFixed(2)}s`;
                document.getElementById('curr-frame-info').textContent = `Time: ${pair.curr_time.toFixed(2)}s`;
                
                // Update similarity
                const similarity = pair.similarity;
                document.getElementById('similarity-score').textContent = 'Combined Score: ' + similarity.toFixed(4) + ' = (Hist×0.25 + PHash×0.75)';
                
                // Update component scores
                document.getElementById('histogram-score').textContent = 'Histogram: ' + pair.histogram_sim.toFixed(4) + ' (25%)';
                document.getElementById('phash-score').textContent = 'Perceptual Hash: ' + pair.phash_sim.toFixed(4) + ' (75%)';
                document.getElementById('dhash-score').textContent = 'Difference Hash: ' + pair.dhash_sim.toFixed(4) + ' (info only)';
                document.getElementById('delta-intensity-score').textContent = 'Delta Intensity: ' + pair.delta_intensity.toFixed(4) + ' (info only)';
                
                // Update jump cut status using actual detection logic
                const isJumpCut = pair.is_jump_cut || false;
                const jumpCutMetrics = pair.jump_cut_metrics || {};
                
                const jumpCutElement = document.getElementById('jump-cut-status');
                if (isJumpCut) {
                    jumpCutElement.textContent = '🎬 JUMP CUT DETECTED';
                    jumpCutElement.className = 'jump-cut-yes';
                } else {
                    jumpCutElement.textContent = '➡️ Continuous Shot';
                    jumpCutElement.className = 'jump-cut-no';
                }
                
                // Update detailed jump cut analysis
                const detailsElement = document.getElementById('jump-cut-details');
                if (jumpCutMetrics.initial_jump_cut !== undefined) {
                    document.getElementById('initial-jump-cut').textContent = jumpCutMetrics.initial_jump_cut ? 'YES' : 'NO';
                    document.getElementById('delta-veto').textContent = jumpCutMetrics.delta_intensity_veto ? 'VETOED' : 'NO';
                    document.getElementById('final-jump-cut').textContent = jumpCutMetrics.final_jump_cut ? 'YES' : 'NO';
                    detailsElement.style.display = 'block';
                } else {
                    detailsElement.style.display = 'none';
                }
                
                // Update navigation buttons
                document.getElementById('prev-btn').disabled = currentPair === 0;
                document.getElementById('next-btn').disabled = currentPair === frameData.length - 1;
                
                // Update statistics
                updateStatistics();
            }

            function updateStatistics() {
                if (frameData.length === 0) return;

                const similarities = frameData.map(pair => pair.similarity);
                const jumpCuts = frameData.filter(pair => pair.similarity < threshold);
                
                const minSim = Math.min(...similarities);
                const maxSim = Math.max(...similarities);
                const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
                
                const statsText = `Jump Cuts: ${jumpCuts.length} / ${frameData.length} | ` +
                                `Similarity Range: ${minSim.toFixed(3)} - ${maxSim.toFixed(3)} | ` +
                                `Average: ${avgSim.toFixed(3)}`;
                
                document.getElementById('stats-info').textContent = statsText;
            }

            function prevPair() {
                if (currentPair > 0) {
                    currentPair--;
                    updateDisplay();
                }
            }

            function nextPair() {
                if (currentPair < frameData.length - 1) {
                    currentPair++;
                    updateDisplay();
                }
            }

            function updateThreshold() {
                threshold = parseFloat(document.getElementById('threshold').value);
                document.getElementById('threshold-value').textContent = threshold.toFixed(2);
                updateDisplay();
            }

            // Keyboard navigation
            document.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowLeft') {
                    prevPair();
                } else if (event.key === 'ArrowRight') {
                    nextPair();
                }
            });
        </script>
    </body>
    </html>
    '''
    return render_template_string(html)

@app.route('/api/frame_data')
def get_frame_data():
    """API endpoint to get frame comparison data"""
    data = {
        'pairs': [],
        'video_info': f"{video_info.get('duration', 0):.1f}s, {len(frame_pairs)} comparisons"
    }
    
    for pair in frame_pairs:
        # Use pre-existing base64 data if available, otherwise convert from frame
        if 'prev_image_b64' in pair and 'curr_image_b64' in pair:
            prev_image = pair['prev_image_b64']
            curr_image = pair['curr_image_b64']
        else:
            prev_image = frame_to_base64(pair['prev_frame'].image)
            curr_image = frame_to_base64(pair['curr_frame'].image)
        
        # Convert numpy types to native Python types for JSON serialization
        jump_cut_metrics = pair.get('jump_cut_metrics', {})
        serializable_metrics = {}
        for key, value in jump_cut_metrics.items():
            if hasattr(value, 'item'):  # numpy scalar
                serializable_metrics[key] = value.item()
            else:
                serializable_metrics[key] = value
        
        data['pairs'].append({
            'prev_image': prev_image,
            'curr_image': curr_image,
            'prev_time': pair['prev_frame'].timestamp,
            'curr_time': pair['curr_frame'].timestamp,
            'similarity': pair['similarity'],
            'histogram_sim': pair.get('histogram_sim', 0),
            'phash_sim': pair.get('phash_sim', 0),
            'dhash_sim': pair.get('dhash_sim', 0),
            'delta_intensity': pair.get('delta_intensity', 0),
            'is_jump_cut': bool(pair.get('is_jump_cut', False)),
            'jump_cut_metrics': serializable_metrics
        })
    
    return jsonify(data)

def get_file_selection_html():
    """Generate HTML for file selection interface"""
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Jump Cut Debug File Selector</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
            .header { text-align: center; margin-bottom: 30px; }
            .file-list { margin: 20px 0; }
            .file-item { 
                padding: 15px; margin: 10px 0; border: 2px solid #ddd; border-radius: 8px; 
                cursor: pointer; transition: all 0.2s;
            }
            .file-item:hover { border-color: #007bff; background: #f8f9fa; }
            .file-item.selected { border-color: #007bff; background: #e7f3ff; }
            .file-name { font-weight: bold; font-size: 16px; }
            .file-info { color: #666; font-size: 14px; margin-top: 5px; }
            .load-btn { 
                background: #007bff; color: white; border: none; padding: 12px 24px; 
                border-radius: 4px; font-size: 16px; cursor: pointer; margin-top: 20px;
            }
            .load-btn:disabled { background: #ccc; cursor: not-allowed; }
            .load-btn:hover:not(:disabled) { background: #0056b3; }
            .no-files { text-align: center; color: #666; padding: 40px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎬 Jump Cut Debug File Selector</h1>
                <p>Choose an existing debug report to load, or process a new video</p>
            </div>
            
            <div id="file-list" class="file-list">
                <div class="no-files">Loading available debug reports...</div>
            </div>
            
            <div style="text-align: center;">
                <button id="load-btn" class="load-btn" disabled onclick="loadSelectedFile()">
                    Load Selected Report
                </button>
                <br><br>
                <a href="/process-new" style="color: #007bff; text-decoration: none;">
                    📹 Or process a new video instead
                </a>
            </div>
        </div>

        <script>
            let selectedFile = null;
            
            // Load available files
            fetch('/api/available_files')
                .then(response => response.json())
                .then(data => {
                    displayFiles(data.files);
                })
                .catch(error => {
                    console.error('Error loading files:', error);
                    document.getElementById('file-list').innerHTML = 
                        '<div class="no-files">Error loading files</div>';
                });

            function displayFiles(files) {
                const fileList = document.getElementById('file-list');
                
                if (files.length === 0) {
                    fileList.innerHTML = `
                        <div class="no-files">
                            <p>No debug reports found</p>
                            <p>Generate one by running:</p>
                            <code>python debug_jump_cuts.py &lt;video_url&gt;</code>
                        </div>`;
                    return;
                }
                
                fileList.innerHTML = '';
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.onclick = () => selectFile(file.path, fileItem);
                    
                    fileItem.innerHTML = `
                        <div class="file-name">${file.name}</div>
                        <div class="file-info">
                            ${file.comparisons} comparisons | ${file.duration}s video | 
                            Modified: ${new Date(file.modified).toLocaleString()}
                        </div>
                    `;
                    
                    fileList.appendChild(fileItem);
                });
            }
            
            function selectFile(filePath, element) {
                // Remove previous selection
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // Select current item
                element.classList.add('selected');
                selectedFile = filePath;
                document.getElementById('load-btn').disabled = false;
            }
            
            function loadSelectedFile() {
                if (!selectedFile) return;
                
                document.getElementById('load-btn').textContent = 'Loading...';
                document.getElementById('load-btn').disabled = true;
                
                fetch('/api/load_file', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({file_path: selectedFile})
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        window.location.reload(); // Reload to show debug interface
                    } else {
                        alert('Error loading file: ' + data.error);
                        document.getElementById('load-btn').textContent = 'Load Selected Report';
                        document.getElementById('load-btn').disabled = false;
                    }
                })
                .catch(error => {
                    console.error('Error loading file:', error);
                    alert('Error loading file');
                    document.getElementById('load-btn').textContent = 'Load Selected Report';
                    document.getElementById('load-btn').disabled = false;
                });
            }
        </script>
    </body>
    </html>
    '''

@app.route('/api/available_files')
def get_available_files():
    """Get list of available HTML debug files"""
    files = []
    
    # Look for HTML files in current directory
    current_dir = Path('.')
    for html_file in current_dir.glob('*debug_report*.html'):
        try:
            # Read file to extract metadata
            with open(html_file, 'r') as f:
                content = f.read()
            
            # Extract video info
            info_match = re.search(r'<p>Video: <strong>(.*?)</strong></p>', content)
            duration = 0
            comparisons = 0
            
            if info_match:
                info_text = info_match.group(1)
                duration_match = re.search(r'([\d.]+)s, (\d+) comparisons', info_text)
                if duration_match:
                    duration = float(duration_match.group(1))
                    comparisons = int(duration_match.group(2))
            
            files.append({
                'name': html_file.name,
                'path': str(html_file),
                'duration': duration,
                'comparisons': comparisons,
                'modified': html_file.stat().st_mtime
            })
            
        except Exception as e:
            print(f"Error reading {html_file}: {e}")
            continue
    
    # Sort by modification time (newest first)
    files.sort(key=lambda x: x['modified'], reverse=True)
    
    return jsonify({'files': files})

@app.route('/api/load_file', methods=['POST'])
def load_file():
    """Load a specific HTML debug file"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        
        if not file_path or not Path(file_path).exists():
            return jsonify({'success': False, 'error': 'File not found'})
        
        # Load the file data
        global frame_pairs, video_info
        html_path = Path(file_path)
        
        print(f"📂 Loading frame data from: {html_path}")
        
        # Read and parse the HTML file
        with open(html_path, 'r') as f:
            html_content = f.read()
        
        # Extract the JavaScript frameData array using regex
        frame_data_match = re.search(r'let frameData = (\[.*?\]);', html_content, re.DOTALL)
        if not frame_data_match:
            return jsonify({'success': False, 'error': 'Could not find frameData in HTML file'})
        
        # Parse the JSON data
        frame_data_json = frame_data_match.group(1)
        js_frame_data = json.loads(frame_data_json)
        
        # Extract video info from the HTML
        video_info = {}
        video_info_match = re.search(r'<p>Video: <strong>(.*?)</strong></p>', html_content)
        if video_info_match:
            video_info_text = video_info_match.group(1)
            # Parse duration and comparison count
            duration_match = re.search(r'([\d.]+)s, (\d+) comparisons', video_info_text)
            if duration_match:
                duration = float(duration_match.group(1))
                comparisons = int(duration_match.group(2))
                video_info['duration'] = duration
                video_info['comparisons'] = comparisons
        
        # Convert JavaScript data to our frame pairs format
        frame_pairs = []
        for i, js_pair in enumerate(js_frame_data):
            # Create mock frame objects with the data we need
            prev_frame = type('Frame', (), {
                'timestamp': js_pair['prev_time'],
                'image': None  # We'll use base64 directly for web display
            })()
            
            curr_frame = type('Frame', (), {
                'timestamp': js_pair['curr_time'],
                'image': None  # We'll use base64 directly for web display
            })()
            
            frame_pairs.append({
                'prev_frame': prev_frame,
                'curr_frame': curr_frame,
                'similarity': js_pair['similarity'],
                'histogram_sim': js_pair.get('histogram_sim', 0),
                'phash_sim': js_pair.get('phash_sim', 0),
                'dhash_sim': js_pair.get('dhash_sim', 0),
                'delta_intensity': js_pair.get('delta_intensity', 0),
                'prev_image_b64': js_pair['prev_image'],
                'curr_image_b64': js_pair['curr_image'],
                'index': i
            })
        
        print(f"✅ Loaded {len(frame_pairs)} frame pairs from {html_path}")
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Error loading file: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/process-new')
def process_new():
    """Show form to process a new video"""
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Process New Video</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
            .header { text-align: center; margin-bottom: 30px; }
            .form-group { margin: 20px 0; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
            .form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
            .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; font-size: 16px; cursor: pointer; }
            .btn:hover { background: #0056b3; }
            .back-link { color: #007bff; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Process New Video</h1>
                <p>Enter a video URL or local file path to generate a new debug report</p>
            </div>
            
            <div class="form-group">
                <label for="video-input">Video URL or Path:</label>
                <input type="text" id="video-input" placeholder="https://www.instagram.com/reel/..." />
            </div>
            
            <div style="text-align: center;">
                <button class="btn" onclick="processVideo()">Process Video</button>
                <br><br>
                <a href="/" class="back-link">← Back to file selection</a>
            </div>
            
            <div id="status" style="margin-top: 20px; text-align: center; font-weight: bold;"></div>
        </div>

        <script>
            function processVideo() {
                const videoInput = document.getElementById('video-input').value.trim();
                if (!videoInput) {
                    alert('Please enter a video URL or path');
                    return;
                }
                
                document.getElementById('status').textContent = 'Processing video... This may take a few minutes.';
                document.querySelector('.btn').disabled = true;
                
                // Note: In a real implementation, you'd want to handle this via an API endpoint
                // For now, just show instructions
                document.getElementById('status').innerHTML = `
                    <p style="color: #007bff;">To process this video, run the following command in your terminal:</p>
                    <code style="background: #f8f9fa; padding: 10px; border-radius: 4px; display: block; margin: 10px 0;">
                        python debug_jump_cuts.py "${videoInput}"
                    </code>
                    <p style="color: #666;">The web interface will automatically update once processing is complete.</p>
                `;
            }
        </script>
    </body>
    </html>
    ''')

def generate_debug_html(frame_pairs, video_info, output_path):
    """Generate static HTML file with all frame comparisons"""
    
    # Prepare frame data for JavaScript
    js_data = []
    for pair in frame_pairs:
        # Use existing base64 data if available, otherwise convert from frame
        if 'prev_image_b64' in pair and 'curr_image_b64' in pair:
            prev_image = pair['prev_image_b64']
            curr_image = pair['curr_image_b64']
        else:
            prev_image = frame_to_base64(pair['prev_frame'].image)
            curr_image = frame_to_base64(pair['curr_frame'].image)
        
        # Convert numpy types to native Python types for JSON serialization
        jump_cut_metrics = pair.get('jump_cut_metrics', {})
        serializable_metrics = {}
        for key, value in jump_cut_metrics.items():
            if hasattr(value, 'item'):  # numpy scalar
                serializable_metrics[key] = value.item()
            else:
                serializable_metrics[key] = value
        
        js_data.append({
            'prev_image': prev_image,
            'curr_image': curr_image,
            'prev_time': pair['prev_frame'].timestamp,
            'curr_time': pair['curr_frame'].timestamp,
            'similarity': pair['similarity'],
            'histogram_sim': pair.get('histogram_sim', 0),
            'phash_sim': pair.get('phash_sim', 0),
            'dhash_sim': pair.get('dhash_sim', 0),
            'delta_intensity': pair.get('delta_intensity', 0),
            'is_jump_cut': bool(pair.get('is_jump_cut', False)),
            'jump_cut_metrics': serializable_metrics
        })
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Jump Cut Detection Debug Report</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
            .container {{ max-width: 1200px; margin: 0 auto; }}
            .header {{ text-align: center; margin-bottom: 20px; }}
            .controls {{ background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
            .frames-container {{ display: flex; gap: 20px; margin-bottom: 20px; }}
            .frame-box {{ flex: 1; background: white; padding: 15px; border-radius: 8px; text-align: center; }}
            .frame-img {{ max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 4px; }}
            .similarity-info {{ background: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; }}
            .jump-cut-yes {{ color: red; font-weight: bold; }}
            .jump-cut-no {{ color: green; font-weight: bold; }}
            .stats {{ background: white; padding: 15px; border-radius: 8px; }}
            .navigation {{ display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }}
            .threshold-control {{ display: flex; align-items: center; gap: 10px; }}
            button {{ padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }}
            button:disabled {{ background: #ccc; cursor: not-allowed; }}
            button:hover:not(:disabled) {{ background: #0056b3; }}
            input[type="range"] {{ width: 200px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Jump Cut Detection Debug Report</h1>
                <p>Video: <strong>{video_info.get('duration', 0):.1f}s, {len(frame_pairs)} comparisons</strong></p>
                <p>Generated from: <code>{video_info.get('path', 'Unknown')}</code></p>
            </div>
            
            <div class="controls">
                <div class="navigation">
                    <button id="prev-btn" onclick="prevPair()" disabled>← Previous</button>
                    <button id="next-btn" onclick="nextPair()" disabled>Next →</button>
                    <span id="pair-info" style="margin-left: 20px;">Pair 0 of 0</span>
                </div>
                
                <div class="threshold-control">
                    <label>Threshold:</label>
                    <input type="range" id="threshold" min="0" max="1" step="0.01" value="0.73" onchange="updateThreshold()">
                    <span id="threshold-value">0.73</span>
                </div>
            </div>
            
            <div class="frames-container">
                <div class="frame-box">
                    <h3>Previous Frame</h3>
                    <img id="prev-frame" class="frame-img" src="" alt="Previous frame">
                    <p id="prev-frame-info">Time: --</p>
                </div>
                
                <div class="frame-box">
                    <h3>Current Frame</h3>
                    <img id="curr-frame" class="frame-img" src="" alt="Current frame">
                    <p id="curr-frame-info">Time: --</p>
                </div>
            </div>
            
            <div class="similarity-info">
                <h3 id="similarity-score">Similarity Score: --</h3>
                <div style="font-size: 14px; margin: 10px 0;">
                    <span style="color: #666;">Components:</span>
                    <span id="histogram-score" style="margin: 0 10px;">Histogram: --</span>
                    <span id="phash-score" style="margin: 0 10px;">Perceptual Hash: --</span>
                    <span id="dhash-score" style="margin: 0 10px;">Difference Hash: --</span>
                    <span id="delta-intensity-score" style="margin: 0 10px;">Delta Intensity: --</span>
                </div>
                <p id="jump-cut-status">--</p>
                <div id="jump-cut-details" style="font-size: 12px; color: #666; margin-top: 10px; display: none;">
                    <div>Initial Detection: <span id="initial-jump-cut">--</span></div>
                    <div>Delta Intensity Veto: <span id="delta-veto">--</span></div>
                    <div>Final Result: <span id="final-jump-cut">--</span></div>
                </div>
            </div>
            
            <div class="stats">
                <h3>Statistics</h3>
                <p id="stats-info">Jump Cuts: -- | Similarity Range: -- | Average: --</p>
            </div>
        </div>

        <script>
            let currentPair = 0;
            let frameData = {json.dumps(js_data)};
            let threshold = 0.73;

            function updateDisplay() {{
                if (frameData.length === 0) return;

                const pair = frameData[currentPair];
                
                // Update pair info
                document.getElementById('pair-info').textContent = `Pair ${{currentPair + 1}} of ${{frameData.length}}`;
                
                // Update images
                document.getElementById('prev-frame').src = pair.prev_image;
                document.getElementById('curr-frame').src = pair.curr_image;
                
                // Update frame info
                document.getElementById('prev-frame-info').textContent = `Time: ${{pair.prev_time.toFixed(2)}}s`;
                document.getElementById('curr-frame-info').textContent = `Time: ${{pair.curr_time.toFixed(2)}}s`;
                
                // Update similarity
                const similarity = pair.similarity;
                document.getElementById('similarity-score').textContent = 'Combined Score: ' + similarity.toFixed(4) + ' = (Hist×0.25 + PHash×0.75)';
                
                // Update component scores
                document.getElementById('histogram-score').textContent = 'Histogram: ' + pair.histogram_sim.toFixed(4) + ' (25%)';
                document.getElementById('phash-score').textContent = 'Perceptual Hash: ' + pair.phash_sim.toFixed(4) + ' (75%)';
                document.getElementById('dhash-score').textContent = 'Difference Hash: ' + pair.dhash_sim.toFixed(4) + ' (info only)';
                document.getElementById('delta-intensity-score').textContent = 'Delta Intensity: ' + pair.delta_intensity.toFixed(4) + ' (info only)';
                
                // Update jump cut status
                const isJumpCut = similarity < threshold;
                const jumpCutElement = document.getElementById('jump-cut-status');
                if (isJumpCut) {{
                    jumpCutElement.textContent = '🎬 JUMP CUT DETECTED';
                    jumpCutElement.className = 'jump-cut-yes';
                }} else {{
                    jumpCutElement.textContent = '➡️ Continuous Shot';
                    jumpCutElement.className = 'jump-cut-no';
                }}
                
                // Update navigation buttons
                document.getElementById('prev-btn').disabled = currentPair === 0;
                document.getElementById('next-btn').disabled = currentPair === frameData.length - 1;
                
                // Update statistics
                updateStatistics();
            }}

            function updateStatistics() {{
                if (frameData.length === 0) return;

                const similarities = frameData.map(pair => pair.similarity);
                const jumpCuts = frameData.filter(pair => pair.similarity < threshold);
                
                const minSim = Math.min(...similarities);
                const maxSim = Math.max(...similarities);
                const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
                
                const statsText = `Jump Cuts: ${{jumpCuts.length}} / ${{frameData.length}} | ` +
                                `Similarity Range: ${{minSim.toFixed(3)}} - ${{maxSim.toFixed(3)}} | ` +
                                `Average: ${{avgSim.toFixed(3)}}`;
                
                document.getElementById('stats-info').textContent = statsText;
            }}

            function prevPair() {{
                if (currentPair > 0) {{
                    currentPair--;
                    updateDisplay();
                }}
            }}

            function nextPair() {{
                if (currentPair < frameData.length - 1) {{
                    currentPair++;
                    updateDisplay();
                }}
            }}

            function updateThreshold() {{
                threshold = parseFloat(document.getElementById('threshold').value);
                document.getElementById('threshold-value').textContent = threshold.toFixed(2);
                updateDisplay();
            }}

            // Keyboard navigation
            document.addEventListener('keydown', function(event) {{
                if (event.key === 'ArrowLeft') {{
                    prevPair();
                }} else if (event.key === 'ArrowRight') {{
                    nextPair();
                }}
            }});
            
            // Initialize display
            updateDisplay();
        </script>
    </body>
    </html>
    '''
    
    with open(output_path, 'w') as f:
        f.write(html)
    
    print(f"✅ Debug report saved to: {output_path}")

def load_existing_frame_data():
    """Load frame data from existing HTML debug report"""
    global frame_pairs, video_info
    
    html_path = Path("jump_cut_debug_report.html")
    if not html_path.exists():
        raise FileNotFoundError("No existing debug report found. Please run with a video URL first to generate frame data.")
    
    print(f"📂 Loading existing frame data from: {html_path}")
    
    # Read and parse the HTML file
    with open(html_path, 'r') as f:
        html_content = f.read()
    
    # Extract the JavaScript frameData array using regex
    frame_data_match = re.search(r'let frameData = (\[.*?\]);', html_content, re.DOTALL)
    if not frame_data_match:
        raise ValueError("Could not find frameData in HTML file")
    
    # Parse the JSON data
    frame_data_json = frame_data_match.group(1)
    js_frame_data = json.loads(frame_data_json)
    
    # Extract video info from the HTML
    video_info_match = re.search(r'<p>Video: <strong>(.*?)</strong></p>', html_content)
    if video_info_match:
        video_info_text = video_info_match.group(1)
        # Parse duration and comparison count
        duration_match = re.search(r'([\d.]+)s, (\d+) comparisons', video_info_text)
        if duration_match:
            duration = float(duration_match.group(1))
            comparisons = int(duration_match.group(2))
            video_info['duration'] = duration
            video_info['comparisons'] = comparisons
    
    # Convert JavaScript data to our frame pairs format
    frame_pairs = []
    for i, js_pair in enumerate(js_frame_data):
        # Create mock frame objects with the data we need
        prev_frame = type('Frame', (), {
            'timestamp': js_pair['prev_time'],
            'image': None  # We'll use base64 directly for web display
        })()
        
        curr_frame = type('Frame', (), {
            'timestamp': js_pair['curr_time'],
            'image': None  # We'll use base64 directly for web display
        })()
        
        frame_pairs.append({
            'prev_frame': prev_frame,
            'curr_frame': curr_frame,
            'similarity': js_pair['similarity'],
            'histogram_sim': js_pair.get('histogram_sim', 0),
            'phash_sim': js_pair.get('phash_sim', 0),
            'prev_image_b64': js_pair['prev_image'],
            'curr_image_b64': js_pair['curr_image'],
            'index': i
        })
    
    print(f"✅ Loaded {len(frame_pairs)} frame pairs from existing data")
    return True

def load_video_frames(video_path: str):
    """Extract frames at 6 FPS for comparison"""
    global frame_pairs, video_info
    
    print(f"🎞️ Extracting frames from: {video_path}")
    
    extractor = ViralFrameExtractor()
    
    # Get video metadata
    video_length = extractor.get_video_length(video_path)
    video_info['duration'] = video_length
    video_info['path'] = video_path
    print(f"📊 Video duration: {video_length:.2f} seconds")
    
    # Extract frames at 6 FPS
    fps = 6.0
    interval = 1.0 / fps
    frames = []
    
    current_time = 0.0
    frame_count = 0
    total_frames = int(video_length * fps)
    
    print(f"📸 Extracting ~{total_frames} frames...")
    
    while current_time < video_length:
        frame = extractor.extract_single_frame(video_path, current_time)
        if frame:
            frames.append(frame)
            frame_count += 1
            
            # Progress indicator
            if frame_count % 30 == 0:
                progress = (frame_count / total_frames) * 100
                print(f"   Progress: {progress:.1f}% ({frame_count}/{total_frames} frames)")
                
        current_time += interval
    
    print(f"✅ Extracted {len(frames)} frames for comparison")
    
    # Create frame pairs for comparison
    frame_pairs = []
    print(f"🔍 Calculating similarity scores...")
    
    for i in range(1, len(frames)):
        prev_frame = frames[i-1]
        curr_frame = frames[i]
        
        # Calculate similarity components
        histogram_sim = _histogram_comparison(prev_frame.image, curr_frame.image)
        phash_sim = _perceptual_hash(prev_frame.image, curr_frame.image)
        dhash_sim = _difference_hash(prev_frame.image, curr_frame.image)
        delta_intensity = _delta_intensity(prev_frame.image, curr_frame.image)
        combined_sim = (histogram_sim * 0.25 + phash_sim * 0.75)
        
        # Use the same jump cut detection logic as ad processing
        extractor = ViralFrameExtractor()
        is_jump_cut_detected, jump_cut_metrics = _is_jump_cut(prev_frame.image, curr_frame.image, extractor.jump_cut_threshold)
        
        frame_pairs.append({
            'prev_frame': prev_frame,
            'curr_frame': curr_frame,
            'similarity': combined_sim,
            'histogram_sim': histogram_sim,
            'phash_sim': phash_sim,
            'dhash_sim': dhash_sim,
            'delta_intensity': delta_intensity,
            'is_jump_cut': is_jump_cut_detected,
            'jump_cut_metrics': jump_cut_metrics,
            'index': i
        })
        
        # Progress indicator
        if i % 30 == 0:
            progress = (i / (len(frames)-1)) * 100
            print(f"   Progress: {progress:.1f}% ({i}/{len(frames)-1} comparisons)")
    
    print(f"📊 Created {len(frame_pairs)} frame pairs for analysis")
    
    # Generate static HTML file
    output_path = Path("jump_cut_debug_report.html")
    generate_debug_html(frame_pairs, video_info, output_path)
    
    print(f"📂 Static HTML report updated: file://{output_path.absolute()}")

async def download_video_if_url(input_path: str) -> str:
    """Download video if input is URL, otherwise return path"""
    if input_path.startswith('http'):
        print(f"📥 Downloading video from URL...")
        
        # Create temp file path
        temp_video_path = tempfile.mktemp(suffix='.mp4')
        
        # Download using yt-dlp
        import yt_dlp
        ydl_opts = {
            'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
            'outtmpl': temp_video_path,
            'no_warnings': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
            },
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([input_path])
        
        print(f"✅ Video downloaded to: {temp_video_path}")
        return temp_video_path
    else:
        # Local file path
        return input_path

async def main():
    # Check if running without arguments (file selection mode)
    if len(sys.argv) == 1:
        print("🔄 No video path provided, starting with file selection interface...")
        # Don't load any data yet, let the web interface handle file selection
    elif len(sys.argv) == 2:
        # Original mode: extract frames from video
        input_path = sys.argv[1]
        
        try:
            # Download video if URL or use local path
            video_path = await download_video_if_url(input_path)
            
            # Load frames for debugging
            load_video_frames(video_path)
            
            # Cleanup temp file if downloaded
            if input_path.startswith('http') and Path(video_path).exists():
                Path(video_path).unlink()
                print(f"🗑️ Cleaned up temp file: {video_path}")
                
        except Exception as e:
            print(f"❌ Error processing video: {e}")
            import traceback
            traceback.print_exc()
            return
    else:
        print("Usage:")
        print("  python debug_jump_cuts.py                    # Load existing jump_cut_debug_report.html")
        print("  python debug_jump_cuts.py <video_url_or_path>  # Process new video")
        print()
        print("Examples:")
        print("  python debug_jump_cuts.py")
        print("  python debug_jump_cuts.py \"https://www.instagram.com/reel/DMdF0aUygVl/\"")
        print("  python debug_jump_cuts.py \"/path/to/video.mp4\"")
        return
    
    try:
        print("🚀 Starting Jump Cut Debugger Web Server...")
        
        # Kill any existing process on port 5050
        kill_port(5050)
        
        print("Open your browser and go to: http://127.0.0.1:5050")
        print("Use arrow keys or buttons to navigate between frame pairs")
        print("Adjust the threshold slider to see how it affects jump cut detection")
        print("Press Ctrl+C to stop the server")
        
        # Run Flask app on different port with 127.0.0.1
        app.run(debug=False, port=5050, host='127.0.0.1')
            
    except KeyboardInterrupt:
        print("\n👋 Stopping server...")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())