"""Render the synthetic bill the smoke test uploads (api/fixtures/receipt-sample.png).

Runs inside the OCR image, which has Pillow and needs no fonts installed:
    docker run --rm -i snapclaim-ocr:dev python - < api/fixtures/receipt-sample.py > api/fixtures/receipt-sample.png
"""
import sys

from PIL import Image, ImageDraw, ImageFont

ROWS = [
    ("CAFE COFFEE DAY", 44, "c"),
    ("Koramangala 5th Block, Bengaluru", 22, "c"),
    ("GSTIN: 29AABCC1234D1Z5", 22, "c"),
    ("TAX INVOICE", 28, "c"),
    ("Invoice No: CCD/2026/0142", 24, "l"),
    ("Date: 12/03/2026   Time: 13:42", 24, "l"),
    ("-" * 36, 24, "l"),
    ("2 x Cappuccino              380.00", 24, "l"),
    ("1 x Veg Sandwich            220.00", 24, "l"),
    ("1 x Chocolate Brownie       180.00", 24, "l"),
    ("-" * 36, 24, "l"),
    ("Sub Total                   780.00", 24, "l"),
    ("CGST 2.5%                    19.50", 24, "l"),
    ("SGST 2.5%                    19.50", 24, "l"),
    ("GRAND TOTAL             Rs. 819.00", 32, "l"),
    ("Paid by UPI", 22, "c"),
    ("Thank you, visit again!", 22, "c"),
]
W = 720
img = Image.new("RGB", (W, 60 + sum(s + 20 for _, s, _ in ROWS) + 60), "#fbfaf5")
d = ImageDraw.Draw(img)
y = 60
for text, size, align in ROWS:
    font = ImageFont.load_default(size=size)
    w = d.textlength(text, font=font)
    x = (W - w) / 2 if align == "c" else 40
    d.text((x, y), text, fill="#1a1a1a", font=font)
    y += size + 20
img.save(sys.stdout.buffer, "PNG")
