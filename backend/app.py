import os
from flask import Flask, send_from_directory
from backend.config import config_by_name
from backend.extensions import db, bcrypt, jwt, cors
from backend.routes.auth_routes import auth_bp
from backend.routes.campus_routes import campus_bp
from backend.routes.crowd_routes import crowd_bp
from backend.routes.prediction_routes import prediction_bp
from backend.routes.route_routes import route_bp
from backend.routes.emergency_routes import emergency_bp, simulation_bp
from backend.routes.optimization_routes import optimization_bp
from backend.routes.what_if_routes import what_if_bp
from backend.routes.analytics_routes import analytics_bp
from backend.models.emergency import EmergencyScenario, Simulation, SimulationResult
from backend.models.optimization import OptimizationConfig, OptimizationResult
from backend.models.what_if import WhatIfScenario
from backend.models.prediction import MLModelMetadata, PredictionLog
from backend.models.analytics import RouteLog, PerformanceLog
from backend.utils.response import api_response

def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
    assets_dir = os.path.join(dist_dir, 'assets')

    app = Flask(
        __name__, 
        static_folder=assets_dir if os.path.exists(assets_dir) else None,
        static_url_path='/assets'
    )
    app.config.from_object(config_by_name.get(config_name, config_by_name['default']))

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # JWT Error Handlers
    @jwt.unauthorized_loader
    def unauthorized_callback(callback):
        return api_response(
            success=False,
            message="Missing Authorization Header with Bearer Token.",
            error="UNAUTHORIZED",
            status_code=401
        )

    @jwt.invalid_token_loader
    def invalid_token_callback(callback):
        return api_response(
            success=False,
            message="Invalid JWT Token signature or structure.",
            error="INVALID_TOKEN",
            status_code=401
        )

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return api_response(
            success=False,
            message="The JWT Token has expired. Please log in again.",
            error="TOKEN_EXPIRED",
            status_code=401
        )

    # General HTTP Error Handlers
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return api_response(
            success=False,
            message="An internal server error occurred.",
            error="INTERNAL_SERVER_ERROR",
            status_code=500
        )

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(campus_bp)
    app.register_blueprint(crowd_bp)
    app.register_blueprint(prediction_bp)
    app.register_blueprint(route_bp)
    app.register_blueprint(emergency_bp)
    app.register_blueprint(simulation_bp)
    app.register_blueprint(optimization_bp)
    app.register_blueprint(what_if_bp)
    app.register_blueprint(analytics_bp)

    # Health check route
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return api_response(
            success=True,
            data={
                "status": "online",
                "system": "AI-Powered Campus Simulation, Crowd Prediction & Emergency Optimization",
                "version": "1.0.0",
                "environment": os.environ.get('FLASK_ENV', 'development')
            },
            message="Campus Simulation API is operational."
        )

    # Frontend Single Page Application (SPA) catch-all route
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend_spa(path):
        if path.startswith('api/'):
            return api_response(
                success=False,
                message="The requested API endpoint was not found.",
                error="NOT_FOUND",
                status_code=404
            )

        # Serve static file if it exists in dist
        file_path = os.path.join(dist_dir, path)
        if path and os.path.isfile(file_path):
            return send_from_directory(dist_dir, path)

        # Serve index.html for SPA routing
        if os.path.isfile(os.path.join(dist_dir, 'index.html')):
            return send_from_directory(dist_dir, 'index.html')

        return api_response(
            success=True,
            message="Campus Simulation API Server is active. Frontend build ready.",
            data={"status": "online"}
        )

    # Create tables and auto-seed default dataset if empty (skipped during testing)
    with app.app_context():
        db.create_all()
        if config_name != 'testing':
            try:
                from backend.models.user import User
                if User.query.count() == 0:
                    from backend.seed.seed_users import seed_default_users
                    from backend.seed.seed_campus import seed_campus_topology
                    from backend.seed.seed_crowd import seed_crowd_data
                    from backend.models.optimization import OptimizationConfig
                    seed_default_users()
                    seed_campus_topology()
                    seed_crowd_data()
                    OptimizationConfig.get_or_create()
            except Exception as e:
                pass

    return app
