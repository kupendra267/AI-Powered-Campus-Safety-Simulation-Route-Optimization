import os
from datetime import timedelta
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-campus-simulation-2026')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-campus-simulation-2026')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    # Handle serverless / Vercel writable temporary path and PostgreSQL prefixes
    db_env_url = os.environ.get('DATABASE_URL')
    if db_env_url and db_env_url.startswith('postgres://'):
        db_env_url = db_env_url.replace('postgres://', 'postgresql://', 1)

    is_serverless = bool(os.environ.get('VERCEL') or os.environ.get('VERCEL_ENV') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'))

    if is_serverless:
        if not db_env_url or ('sqlite' in db_env_url and '/tmp/' not in db_env_url):
            db_env_url = 'sqlite:////tmp/campus_simulation.db'
    elif not db_env_url:
        db_env_url = f"sqlite:///{os.path.join(basedir, 'campus_simulation.db')}"

    SQLALCHEMY_DATABASE_URI = db_env_url
    CORS_HEADERS = 'Content-Type'

class DevelopmentConfig(Config):
    DEBUG = True

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)

class ProductionConfig(Config):
    DEBUG = False

config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
