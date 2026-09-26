import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import create_app

app = create_app(os.environ.get('FLASK_ENV', 'development'))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"==================================================")
    print(f"  AI-Powered Campus Backend Running on Port {port}")
    print(f"  Environment: {os.environ.get('FLASK_ENV', 'development')}")
    print(f"  API Health: http://localhost:{port}/api/health")
    print(f"==================================================")
    app.run(host='0.0.0.0', port=port, debug=True)
