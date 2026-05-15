FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY api.py .
COPY engine/ engine/
COPY frontend/ frontend/

# Expose port (can be overridden by environment)
EXPOSE 8000

# Run the API with environment variable support for platforms like Render
CMD uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
