#!/usr/bin/env python3
"""
Test script to directly test the ad analysis backend
"""

import asyncio
import requests
import json
import time

async def test_ad_analysis():
    """Test the Instagram video analysis directly"""
    
    url = "https://www.instagram.com/p/DNBhZWxyjQS"
    backend_url = "http://localhost:8000/analyze-ad"
    
    print(f"🎬 Testing ad analysis for: {url}")
    print(f"📡 Backend URL: {backend_url}")
    
    payload = {
        "url": url,
        "content_description": "Content creator equipment showcase"
    }
    
    print(f"📤 Sending request...")
    start_time = time.time()
    
    try:
        response = requests.post(
            backend_url,
            json=payload,
            timeout=300  # 5 minute timeout
        )
        
        elapsed_time = time.time() - start_time
        print(f"⏱️  Request completed in {elapsed_time:.2f} seconds")
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"✅ Analysis successful!")
            print(f"📝 Keys in response: {list(result.keys())}")
            
            if 'analysis' in result:
                analysis = result['analysis']
                print(f"📊 Analysis keys: {list(analysis.keys())}")
                
                if 'chunks' in analysis:
                    chunks = analysis['chunks']
                    print(f"🎯 Number of chunks: {len(chunks)}")
                    print(f"⏱️  Duration: {analysis.get('duration', 'N/A')} seconds")
                    
                    # Show first few chunks
                    for i, chunk in enumerate(chunks[:3]):
                        start_time = chunk.get('startTime', 'N/A')
                        end_time = chunk.get('endTime', 'N/A')
                        print(f"   Chunk {i+1}: {start_time}s - {end_time}s")
                
                print(f"\n📄 Full response preview:")
                print(json.dumps(result, indent=2)[:1000] + "..." if len(str(result)) > 1000 else json.dumps(result, indent=2))
                
            else:
                print(f"❌ No 'analysis' key in response")
                print(f"📄 Response: {response.text[:500]}...")
                
        else:
            print(f"❌ Request failed!")
            print(f"📄 Error response: {response.text}")
            
    except requests.exceptions.Timeout:
        print(f"⏰ Request timed out after 5 minutes")
    except requests.exceptions.RequestException as e:
        print(f"🔥 Request error: {e}")
    except Exception as e:
        print(f"💥 Unexpected error: {e}")

if __name__ == "__main__":
    print("🚀 Starting ad analysis test...")
    asyncio.run(test_ad_analysis())