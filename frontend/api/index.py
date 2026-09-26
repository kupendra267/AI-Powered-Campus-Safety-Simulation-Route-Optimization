"""
Vercel Serverless Function Handler (Frontend Root Scope)
=========================================================
Entrypoint for Vercel Python Serverless Functions when Root Directory is frontend/.
"""

import os
import sys
import traceback

# Add monorepo root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ['VERCEL'] = '1'

try:
    from backend.app import create_app
    app = create_app('production')
except Exception as startup_err:
    startup_trace = traceback.format_exc()
    try:
        from flask import Flask, jsonify
        app = Flask(__name__)
        @app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
        @app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
        def serverless_diagnostic_handler(path):
            return jsonify({
                "success": False,
                "error": "SERVERLESS_STARTUP_EXCEPTION",
                "message": str(startup_err),
                "traceback": startup_trace.splitlines()
            }), 500
    except Exception as fallback_err:
        def app(environ, start_response):
            status = '500 Internal Server Error'
            response_headers = [('Content-type', 'text/plain')]
            start_response(status, response_headers)
            return [f"Startup Fatal Error:\n{startup_trace}".encode('utf-8')]
