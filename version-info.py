#!/usr/bin/env python3
"""
Show current branch and version information
"""

import subprocess
import sys
from datetime import datetime

def get_current_branch():
    """Get current git branch"""
    try:
        result = subprocess.run(['git', 'branch', '--show-current'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
        return "unknown"
    except Exception:
        return "no-git"

def get_commit_info():
    """Get latest commit info"""
    try:
        # Get commit hash and message
        hash_result = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], 
                                   capture_output=True, text=True)
        msg_result = subprocess.run(['git', 'log', '-1', '--pretty=%s'], 
                                  capture_output=True, text=True)
        
        if hash_result.returncode == 0 and msg_result.returncode == 0:
            return {
                'hash': hash_result.stdout.strip(),
                'message': msg_result.stdout.strip()
            }
        return None
    except Exception:
        return None

def check_server_status():
    """Check if servers are running"""
    try:
        # Check API server
        api_result = subprocess.run(['curl', '-s', 'http://localhost:3001/'], 
                                  capture_output=True, timeout=2)
        api_running = api_result.returncode == 0
        
        # Check web server  
        web_result = subprocess.run(['curl', '-s', 'http://localhost:8080/'], 
                                  capture_output=True, timeout=2)
        web_running = web_result.returncode == 0
        
        return {'api': api_running, 'web': web_running}
    except Exception:
        return {'api': False, 'web': False}

def main():
    print("🏷️  IT Inventory App - Version Info")
    print("=" * 40)
    
    # Current branch
    branch = get_current_branch()
    if branch == "production":
        print(f"🟢 Current Version: {branch.upper()} (Stable)")
    elif branch == "beta":
        print(f"🟡 Current Version: {branch.upper()} (Testing)")
    else:
        print(f"🔴 Current Version: {branch}")
    
    # Commit info
    commit = get_commit_info()
    if commit:
        print(f"📝 Latest Commit: {commit['hash']}")
        print(f"💬 Message: {commit['message']}")
    
    # Server status
    print("\n🖥️  Server Status:")
    status = check_server_status()
    api_status = "🟢 Running" if status['api'] else "🔴 Stopped"
    web_status = "🟢 Running" if status['web'] else "🔴 Stopped"
    
    print(f"   API Server (3001):  {api_status}")
    print(f"   Web Server (8080):  {web_status}")
    
    # URLs
    if status['api'] and status['web']:
        print(f"\n🌐 Access URLs:")
        print(f"   App: http://localhost:8080")
        print(f"   API: http://localhost:3001")
    
    # Available commands
    print(f"\n🛠️  Available Commands:")
    print(f"   python3 switch-to-production.py  - Switch to stable version")
    print(f"   python3 switch-to-beta.py        - Switch to testing version")
    print(f"   python3 start-app.py             - Start current version")
    print(f"   python3 version-info.py          - Show this information")

if __name__ == '__main__':
    main()