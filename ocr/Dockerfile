# Receipt OCR sidecar: RapidOCR (the ONNX Runtime build of PaddleOCR's
# PP-OCR models) behind a tiny HTTP endpoint. CPU only, no keys, no network
# calls at runtime: the detection and recognition models ship inside the wheel.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=2
WORKDIR /app

# libgl/glib: OpenCV runtime deps used by rapidocr's image pipeline.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
# Warm the models once at build time so the first request is not slow.
RUN python -c "from rapidocr_onnxruntime import RapidOCR; RapidOCR()"

EXPOSE 8080
USER nobody
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
