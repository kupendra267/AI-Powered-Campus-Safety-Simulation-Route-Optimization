"""
Vercel Serverless Function Handler
==================================
Entrypoint for Vercel Python Serverless Functions routing all /api/* requests
directly to the Flask application instance.
"""

import os
import sys

# Ensure root directory is on Python search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set VERCEL environment flag
os.environ['VERCEL'] = '1'

from backend.app import create_app

app = create_app('production')
