#!/usr/bin/env python3
"""
Switch to production branch and start the stable app
"""

import subprocess
import sys
import os
import signal

def kill_servers():
    """Kill any running servers"""
    try:
        # Kill processes on ports 8080 and 3001
        subprocess.run(['pkill', '-f', 'simple-api-server.py'], check=False)
        subprocess.run(['pkill', '-f', 'http.server'], check=False)
        print("🔥 Stopped any running servers")
    except Exception as e:
        print(f"Note: {e}")

def switch_to_production():
    """Switch to production branch and start app"""
    try:
        # Kill any running servers first
        kill_servers()
        
        # Switch to production branch
        result = subprocess.run(['git', 'checkout', 'production'], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Failed to switch to production: {result.stderr}")
            return False
            
        print("✅ Switched to PRODUCTION branch")
        
        # Start the production app
        print("🚀 Starting production app...")
        subprocess.Popen([sys.executable, 'start-app.py'])
        
        print("📱 Production app starting...")
        print("   Web: http://localhost:8080")
        print("   API: http://localhost:3001")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    if switch_to_production():
        print("\n🟢 PRODUCTION VERSION ACTIVE")
        print("   Use 'python3 switch-to-beta.py' to return to beta testing")
    else:
        print("\n🔴 Failed to switch to production")
        sys.exit(1)