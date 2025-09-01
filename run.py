#!/usr/bin/env python3
"""
Chess Analysis Portal - Startup Script
"""

import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app import app

if __name__ == '__main__':
    print("🚀 Starting Chess Analysis Portal...")
    print("📊 Dashboard: http://localhost:5001")
    print("📁 Upload PGNs: http://localhost:5001/upload")
    print("🎯 Press Ctrl+C to stop")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
