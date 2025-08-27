#!/usr/bin/env python3
"""
Switch to beta branch for testing new features
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

def switch_to_beta():
    """Switch to beta branch and start app"""
    try:
        # Kill any running servers first
        kill_servers()
        
        # Switch to beta branch
        result = subprocess.run(['git', 'checkout', 'beta'], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Failed to switch to beta: {result.stderr}")
            return False
            
        print("✅ Switched to BETA branch")
        
        # Start the beta app
        print("🚀 Starting beta app...")
        subprocess.Popen([sys.executable, 'start-app.py'])
        
        print("📱 Beta app starting...")
        print("   Web: http://localhost:8080")
        print("   API: http://localhost:3001")
        print("\n⚠️  BETA VERSION - New features under testing")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    if switch_to_beta():
        print("\n🟡 BETA VERSION ACTIVE")
        print("   Use 'python3 switch-to-production.py' to return to stable version")
        print("   Report issues and test new features")
    else:
        print("\n🔴 Failed to switch to beta")
        sys.exit(1)