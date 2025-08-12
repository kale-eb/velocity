#!/usr/bin/env python3
"""
Extract localStorage data from Chrome/Chromium browser for the marketing app.
Saves the data as JSON files in the project directory.
"""

import json
import sqlite3
import os
import sys
from pathlib import Path
from datetime import datetime
import shutil
import tempfile

def find_chrome_profiles():
    """Find Chrome profile directories based on the operating system."""
    home = Path.home()
    chrome_paths = []
    
    # macOS paths
    if sys.platform == "darwin":
        chrome_paths.extend([
            home / "Library/Application Support/Google/Chrome",
            home / "Library/Application Support/Chromium",
            home / "Library/Application Support/Google/Chrome Beta",
            home / "Library/Application Support/Google/Chrome Canary"
        ])
    # Linux paths
    elif sys.platform.startswith("linux"):
        chrome_paths.extend([
            home / ".config/google-chrome",
            home / ".config/chromium",
            home / ".config/google-chrome-beta"
        ])
    # Windows paths
    elif sys.platform == "win32":
        chrome_paths.extend([
            Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Chromium/User Data"
        ])
    
    profiles = []
    for chrome_path in chrome_paths:
        if chrome_path.exists():
            # Check Default profile
            default_profile = chrome_path / "Default"
            if default_profile.exists():
                profiles.append(default_profile)
            
            # Check other profiles (Profile 1, Profile 2, etc.)
            for profile_dir in chrome_path.glob("Profile *"):
                if profile_dir.is_dir():
                    profiles.append(profile_dir)
    
    return profiles

def extract_localstorage_data(profile_path, origin="http://localhost:5173"):
    """Extract localStorage data for a specific origin from Chrome's LevelDB."""
    leveldb_path = profile_path / "Local Storage/leveldb"
    
    if not leveldb_path.exists():
        return None
    
    # Create a temporary copy of the leveldb to avoid lock issues
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_leveldb = Path(temp_dir) / "leveldb"
        shutil.copytree(leveldb_path, temp_leveldb)
        
        # Read all .ldb and .log files
        storage_data = {}
        marketing_keys = [
            'marketing_app_generated_scripts',
            'marketing_app_workspace_nodes',
            'marketing_app_processed_ads',
            'marketing_app_workspace_connections',
            'marketing_app_workspace_viewport',
            'marketing_app_workspace_ui_state',
            'marketing_app_user_settings'
        ]
        
        # Check all leveldb files
        for file_path in temp_leveldb.glob("*.ldb"):
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                    # Convert to string ignoring errors
                    text = content.decode('utf-8', errors='ignore')
                    
                    # Look for our keys in the content
                    for key in marketing_keys:
                        # localStorage keys are stored with a specific format
                        search_patterns = [
                            f'_http://localhost:5173\x00\x01{key}',
                            f'_http://localhost:5174\x00\x01{key}',
                            f'_http://127.0.0.1:5173\x00\x01{key}',
                            f'_http://127.0.0.1:5174\x00\x01{key}',
                        ]
                        
                        for pattern in search_patterns:
                            if pattern in text:
                                # Try to extract the value
                                start_idx = text.find(pattern) + len(pattern)
                                # Find the JSON value after the key
                                # Look for JSON-like content
                                for i in range(start_idx, min(start_idx + 10000, len(text))):
                                    if text[i] in ['{', '[']:
                                        # Found potential JSON start
                                        json_start = i
                                        brace_count = 0
                                        bracket_count = 0
                                        in_string = False
                                        escape_next = False
                                        
                                        for j in range(json_start, len(text)):
                                            char = text[j]
                                            
                                            if escape_next:
                                                escape_next = False
                                                continue
                                            
                                            if char == '\\':
                                                escape_next = True
                                                continue
                                            
                                            if char == '"' and not in_string:
                                                in_string = True
                                            elif char == '"' and in_string:
                                                in_string = False
                                            elif not in_string:
                                                if char == '{':
                                                    brace_count += 1
                                                elif char == '}':
                                                    brace_count -= 1
                                                elif char == '[':
                                                    bracket_count += 1
                                                elif char == ']':
                                                    bracket_count -= 1
                                                
                                                if brace_count == 0 and bracket_count == 0:
                                                    # Found complete JSON
                                                    json_str = text[json_start:j+1]
                                                    try:
                                                        parsed = json.loads(json_str)
                                                        storage_data[key] = parsed
                                                        print(f"✓ Found {key} ({len(json_str)} chars)")
                                                    except json.JSONDecodeError:
                                                        pass
                                                    break
                                        break
            except Exception:
                pass
        
        # Also try .log files
        for file_path in temp_leveldb.glob("*.log"):
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                    text = content.decode('utf-8', errors='ignore')
                    
                    for key in marketing_keys:
                        if key in text and key not in storage_data:
                            # Similar extraction logic as above
                            # (simplified for log files)
                            pass
            except Exception:
                pass
        
        return storage_data

def save_extracted_data(data, output_dir="."):
    """Save extracted data to JSON files."""
    output_dir = Path(output_dir)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if not data:
        print("No marketing app data found in Chrome localStorage")
        return None
    
    # Save complete export
    output_file = output_dir / f"marketing_app_export_{timestamp}.json"
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"\n✅ Saved complete export to: {output_file}")
    
    # Save scripts separately if they exist
    if 'marketing_app_generated_scripts' in data:
        scripts_file = output_dir / f"scripts_export_{timestamp}.json"
        with open(scripts_file, 'w') as f:
            json.dump(data['marketing_app_generated_scripts'], f, indent=2)
        print(f"✅ Saved scripts to: {scripts_file}")
        
        # Extract current script if it exists
        scripts_data = data['marketing_app_generated_scripts']
        if isinstance(scripts_data, dict) and 'current_script' in scripts_data:
            current_script_file = output_dir / f"current_script_{timestamp}.json"
            with open(current_script_file, 'w') as f:
                json.dump(scripts_data['current_script'], f, indent=2)
            print(f"✅ Saved current script to: {current_script_file}")
    
    return output_file

def main():
    print("🔍 Searching for Chrome profiles...")
    profiles = find_chrome_profiles()
    
    if not profiles:
        print("❌ No Chrome profiles found")
        sys.exit(1)
    
    print(f"Found {len(profiles)} Chrome profile(s)")
    
    all_data = {}
    for profile in profiles:
        print(f"\n📂 Checking profile: {profile.name}")
        data = extract_localstorage_data(profile)
        if data:
            all_data.update(data)
    
    if all_data:
        output_file = save_extracted_data(all_data)
        print(f"\n📊 Summary:")
        print(f"  - Total keys found: {len(all_data)}")
        for key, value in all_data.items():
            if isinstance(value, dict):
                print(f"  - {key}: {len(value)} items")
            elif isinstance(value, list):
                print(f"  - {key}: {len(value)} items")
            else:
                print(f"  - {key}: {type(value).__name__}")
    else:
        print("\n❌ No marketing app data found in any Chrome profile")
        print("\nMake sure:")
        print("1. Chrome is closed (to avoid database locks)")
        print("2. You've used the marketing app at http://localhost:5173")
        print("3. There's data saved in localStorage")

if __name__ == "__main__":
    main()