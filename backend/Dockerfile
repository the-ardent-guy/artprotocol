FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc curl git \
    && rm -rf /var/lib/apt/lists/*

# Install heavy crew deps first (separate layer for caching)
RUN pip install --no-cache-dir \
    crewai>=0.80.0 \
    crewai-tools>=0.20.0 \
    google-search-results>=2.4.2 \
    serpapi>=0.1.5 \
    beautifulsoup4>=4.12.0

# Install remaining backend deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ /app/backend/

# Copy crew files from repo root
COPY run_crew.py /app/run_crew.py
COPY branding_crew.py /app/branding_crew.py
COPY social_crew.py /app/social_crew.py
COPY ads_crew.py /app/ads_crew.py
COPY proposal_crew.py /app/proposal_crew.py
COPY research.py /app/research.py

WORKDIR /app/backend

RUN mkdir -p /app/clients/users

ENV PROJECT_ROOT=/app
ENV CLIENTS_DIR=clients
ENV PYTHON_EXEC=python

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
