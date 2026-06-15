"""OCR tool — extract text from document images using pytesseract."""

from __future__ import annotations

import os
from pathlib import Path

ATTACHMENT_DIR = os.getenv("DONNA_ATTACHMENT_DIR", "/gbio/donna/documents")

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "ocr_document",
            "description": (
                "Extract text from a document image or PDF stored in the intake documents folder. "
                "Use after the client mentions they have uploaded or faxed documents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename in the documents folder (e.g. 'police_report.jpg')",
                    },
                    "doc_type": {
                        "type": "string",
                        "enum": ["police_report", "medical_record", "insurance_card", "other"],
                        "description": "Type of document being scanned",
                    },
                },
                "required": ["filename"],
            },
        },
    }
]


def ocr_document(filename: str, doc_type: str = "other") -> dict:
    """Extract text from a document file. Returns extracted text and metadata."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return {"ok": False, "error": "pytesseract not installed", "text": ""}

    path = Path(ATTACHMENT_DIR) / filename
    if not path.exists():
        return {"ok": False, "error": f"File not found: {filename}", "text": ""}

    try:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            try:
                from pdf2image import convert_from_path
                images = convert_from_path(str(path))
                text = "\n".join(
                    pytesseract.image_to_string(img, config="--psm 6") for img in images
                )
            except ImportError:
                return {"ok": False, "error": "pdf2image not installed for PDF OCR", "text": ""}
        else:
            img = Image.open(path)
            text = pytesseract.image_to_string(img, config="--psm 6")

        text = text.strip()
        return {
            "ok": True,
            "filename": filename,
            "doc_type": doc_type,
            "text": text,
            "char_count": len(text),
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc), "text": ""}
