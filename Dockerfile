# Multi-stage Dockerfile: React Frontend Build + Python Flask Backend
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code and seeded data
COPY backend/ ./backend/
COPY seed.py ./

# Copy built frontend static assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose backend port
EXPOSE 5000

# Initialize DB, generate ML dataset & train champion model, then launch Gunicorn
CMD ["sh", "-c", "python seed.py && python backend/ml/generate_dataset.py && python backend/ml/train_model.py && gunicorn --bind 0.0.0.0:5000 --workers 4 'backend.app:create_app()'\"]
