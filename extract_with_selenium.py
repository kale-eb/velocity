#!/usr/bin/env python3
"""
Extract localStorage data using Selenium to open the app in a browser.
This will actually load the app and extract the localStorage data.
"""

import json
import time
from datetime import datetime
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import WebDriverException
except ImportError:
    print("❌ Selenium not installed. Installing now...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "selenium"])
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import WebDriverException

def extract_localstorage():
    """Extract localStorage data by opening the app in Chrome."""
    
    print("🌐 Starting Chrome browser...")
    
    # Configure Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    driver = None
    try:
        # Create Chrome driver
        driver = webdriver.Chrome(options=chrome_options)
        
        print("📱 Opening marketing app at http://localhost:5173...")
        driver.get("http://localhost:5173")
        
        # Wait for the app to load
        print("⏳ Waiting for app to load...")
        time.sleep(5)
        
        # Check if page loaded properly
        title = driver.title
        print(f"📄 Page title: {title}")
        
        # Extract all localStorage data
        print("📥 Extracting localStorage data...")
        
        # JavaScript to extract all marketing app data
        extract_script = """
        console.log('Starting localStorage extraction...');
        const keys = {
            scripts: 'marketing_app_generated_scripts',
            nodes: 'marketing_app_workspace_nodes',
            ads: 'marketing_app_processed_ads',
            connections: 'marketing_app_workspace_connections',
            viewport: 'marketing_app_workspace_viewport',
            ui_state: 'marketing_app_workspace_ui_state',
            settings: 'marketing_app_user_settings'
        };
        
        const exportData = {};
        let foundKeys = [];
        
        Object.entries(keys).forEach(([name, key]) => {
            const data = localStorage.getItem(key);
            if (data) {
                foundKeys.push(name);
                try {
                    exportData[name] = JSON.parse(data);
                    console.log(`Found ${name}: ${data.length} chars`);
                } catch(e) {
                    console.error(`Failed to parse ${name}:`, e);
                }
            } else {
                console.log(`No data found for ${name}`);
            }
        });
        
        console.log('Found keys:', foundKeys);
        console.log('Total localStorage items:', localStorage.length);
        
        // Also check all localStorage keys to see what's there
        let allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            allKeys.push(localStorage.key(i));
        }
        console.log('All localStorage keys:', allKeys);
        
        return {
            data: exportData,
            foundKeys: foundKeys,
            allKeys: allKeys,
            totalItems: localStorage.length
        };
        """
        
        result = driver.execute_script(extract_script)
        
        print(f"📊 Found {len(result['foundKeys'])} marketing app keys out of {result['totalItems']} total localStorage items")
        print(f"🔍 All keys in localStorage: {result['allKeys']}")
        
        # Close the browser
        driver.quit()
        
        return result['data']
        
    except WebDriverException as e:
        print(f"❌ Browser error: {e}")
        if "chrome" in str(e).lower():
            print("\n💡 Try installing ChromeDriver: brew install chromedriver")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

def save_data(data):
    """Save the extracted data to JSON files."""
    if not data:
        print("❌ No data to save")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save complete export
    output_file = Path(f"marketing_app_export_{timestamp}.json")
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"\n✅ Saved complete export to: {output_file}")
    
    # Save scripts separately if they exist
    if 'scripts' in data:
        scripts_file = Path(f"scripts_export_{timestamp}.json")
        with open(scripts_file, 'w') as f:
            json.dump(data['scripts'], f, indent=2)
        print(f"✅ Saved scripts to: {scripts_file}")
        
        # Extract current script if it exists
        scripts_data = data['scripts']
        if isinstance(scripts_data, dict) and 'current_script' in scripts_data:
            current_script_file = Path(f"current_script_{timestamp}.json")
            with open(current_script_file, 'w') as f:
                json.dump(scripts_data['current_script'], f, indent=2)
            print(f"✅ Saved current script to: {current_script_file}")
            
            # Print summary
            chunks = scripts_data['current_script'].get('chunks', [])
            print(f"\n📊 Current Script Summary:")
            print(f"  - Title: {scripts_data['current_script'].get('title', 'Untitled')}")
            print(f"  - Chunks: {len(chunks)}")
            if chunks:
                print(f"  - First chunk: {chunks[0].get('title', 'No title')[:50]}...")
    
    # Print overall summary
    print(f"\n📊 Export Summary:")
    for key, value in data.items():
        if isinstance(value, dict):
            # Check if it's wrapped in the storage format
            if 'data' in value and 'timestamp' in value:
                actual_data = value['data']
                if isinstance(actual_data, dict):
                    print(f"  - {key}: {len(actual_data)} items")
                elif isinstance(actual_data, list):
                    print(f"  - {key}: {len(actual_data)} items")
                else:
                    print(f"  - {key}: {type(actual_data).__name__}")
            else:
                print(f"  - {key}: {len(value)} items")
        elif isinstance(value, list):
            print(f"  - {key}: {len(value)} items")
        else:
            print(f"  - {key}: present")

def main():
    print("🚀 Marketing App localStorage Extractor")
    print("=" * 40)
    
    data = extract_localstorage()
    
    if data:
        save_data(data)
        print("\n✨ Extraction complete!")
    else:
        print("\n❌ Extraction failed")
        print("\nTroubleshooting:")
        print("1. Make sure the marketing app is running: npm run dev")
        print("2. Make sure Chrome is installed")
        print("3. Try manually opening http://localhost:5173 first")

if __name__ == "__main__":
    main()