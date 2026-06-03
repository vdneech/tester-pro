FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app/tester

RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ..
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ../requirements.txt

COPY tester .

RUN useradd -U appuser && \
    mkdir -p static && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE ${PORT}

CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    gunicorn tester.wsgi:application --bind 0.0.0.0:8000 --workers 3