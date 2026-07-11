# /backend/Dockerfile
# ANFA FastAPI Backend - Python 3.11 with asyncpg and arq

FROM python:3.11-slim

# Security: Run as non-root user
RUN groupadd -r anfa-group && useradd -r -g anfa-group anfa-user

# Set working directory
WORKDIR /app

# Install system dependencies required for asyncpg and security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./app ./app

# Set proper ownership
RUN chown -R anfa-user:anfa-group /app

# Switch to non-root user
USER anfa-user

# Expose the application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:4000/api/health')" || exit 1

# Start the FastAPI application with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000", "--loop", "uvloop", "--http", "httptools", "--workers", "4"]
