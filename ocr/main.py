"""Receipt OCR service.

POST /ocr with the raw image or PDF bytes (Content-Type image/* or
application/pdf) returns the recognised text lines in reading order:

    {"width": 1080, "height": 1920, "lines": [{"text": "...", "score": 0.97,
      "box": [[x, y], [x, y], [x, y], [x, y]]}, ...]}

Lines are the OCR engine's own text boxes, sorted top-to-bottom and merged
left-to-right when they sit on the same baseline, so a receipt row such as
"GRAND TOTAL     1,234.00" comes back as one line. Field parsing (merchant,
date, totals) happens in the API, which knows the company's categories.
"""
from __future__ import annotations

import io
import logging
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, ImageOps
from rapidocr_onnxruntime import RapidOCR

log = logging.getLogger("ocr")
app = FastAPI(title="SnapClaim OCR")
engine = RapidOCR()

MAX_SIDE = 2000  # px; receipts photographed at 12 MP are downscaled, which also speeds detection


def to_image(data: bytes, content_type: str) -> Image.Image:
    if content_type == "application/pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(data)
        if len(pdf) == 0:
            raise HTTPException(422, "empty_pdf")
        page = pdf[0]
        img = page.render(scale=2.5).to_pil()  # ~180 dpi: enough for printed invoices
        pdf.close()
        return img.convert("RGB")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # phones store rotation in EXIF
        return img.convert("RGB")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"bad_image:{e.__class__.__name__}") from e


def downscale(img: Image.Image) -> Image.Image:
    w, h = img.size
    m = max(w, h)
    if m <= MAX_SIDE:
        return img
    s = MAX_SIDE / m
    return img.resize((int(w * s), int(h * s)), Image.LANCZOS)


def merge_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group boxes whose vertical centres overlap into one row, left to right."""
    rows: list[list[dict[str, Any]]] = []
    for it in sorted(items, key=lambda i: i["cy"]):
        for row in rows:
            ref = row[0]
            if abs(it["cy"] - ref["cy"]) < 0.6 * max(it["h"], ref["h"]):
                row.append(it)
                break
        else:
            rows.append([it])
    out = []
    for row in rows:
        row.sort(key=lambda i: i["x0"])
        text = "  ".join(i["text"] for i in row)
        score = float(min(i["score"] for i in row))
        x0 = min(i["x0"] for i in row)
        x1 = max(i["x1"] for i in row)
        y0 = min(i["y0"] for i in row)
        y1 = max(i["y1"] for i in row)
        out.append({"text": text, "score": round(score, 3), "box": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], "parts": [i["text"] for i in row]})
    return out


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "rapidocr-onnxruntime"}


@app.post("/ocr")
async def ocr(request: Request) -> dict[str, Any]:
    data = await request.body()
    if not data:
        raise HTTPException(400, "empty_body")
    content_type = (request.headers.get("content-type") or "application/octet-stream").split(";")[0].strip().lower()
    img = downscale(to_image(data, content_type))
    arr = np.asarray(img)[:, :, ::-1]  # PIL RGB -> OpenCV BGR, which the models were trained on
    result, _elapsed = engine(arr)
    items: list[dict[str, Any]] = []
    for box, text, score in result or []:
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        items.append({"text": str(text).strip(), "score": float(score), "x0": x0, "x1": x1, "y0": y0, "y1": y1, "cy": (y0 + y1) / 2, "h": y1 - y0})
    items = [i for i in items if i["text"]]
    log.info("ocr: %dx%d, %d boxes", img.width, img.height, len(items))
    return {"width": img.width, "height": img.height, "lines": merge_rows(items)}
