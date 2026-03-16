FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc curl git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install — separate layer for caching
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/main.py /app/main.py
COPY backend/database.py /app/database.py

# Copy crew engine files
COPY run_crew.py /app/run_crew.py
COPY research.py /app/research.py
COPY branding_crew.py /app/branding_crew.py
COPY social_crew.py /app/social_crew.py
COPY ads_crew.py /app/ads_crew.py
COPY proposal_crew.py /app/proposal_crew.py
COPY memory_stack.py /app/memory_stack.py

# Create data directories
RUN mkdir -p /app/data /app/data/clients/users /app/knowledge

# Environment
ENV PROJECT_ROOT=/app
ENV CLIENTS_DIR=/app/data/clients
ENV DB_PATH=/app/data/artprotocol.db
ENV PYTHON_EXEC=python

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
