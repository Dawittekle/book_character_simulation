FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir .

ENV PORT=5000 \
    HOST=0.0.0.0 \
    APP_ENV=production \
    PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["python", "run.py"]
