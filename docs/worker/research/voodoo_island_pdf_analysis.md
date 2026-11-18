# Technical Analysis: Voodoo Island PDF Ingestion & OCR Degradation

**File Analyzed**: `/home/dawit/Downloads/Voodoo Island-.pdf`  
**Date**: 2026-11-15  
**Investigator**: Senior Software Developer & AI Engineer  

---

## 1. Executive Summary

When attempting to upload `/home/dawit/Downloads/Voodoo Island-.pdf`, users encountered two issues:
1. An API failure: `temp_source_id is required.`
2. A document warning: `Non-Narrative Document Detected. The document content appears to be unreadable or corrupted OCR text.` (Type: `unknown`, Words: 4,949, Pages: 43).

Both issues were deeply investigated at the byte, OCR, and API levels.

---

## 2. Root Cause 1: `temp_source_id is required.`

### Mechanism
- The inspect endpoint `POST /api/v1/books/inspect` creates a `ProcessingJob` and returns:
  ```json
  { "temp_source_id": "<job_id>", ... }
  ```
- In `frontend/src/components/AddBookModal.jsx`, the confirmation handler called:
  ```javascript
  lorelyApi.ingestSource({ tempSourceId: inspectionResult.job_id, ... })
  ```
- Because `inspectionResult.job_id` was `undefined`, `tempSourceId` sent `undefined` in the request body to `/api/v1/books/ingest`.
- The backend route strictly verified `body.get("temp_source_id")` and threw a 400 Bad Request error.

### Resolution
- **Frontend**: Updated `AddBookModal.jsx` to defensively access `inspectionResult.temp_source_id || inspectionResult.job_id`.
- **Backend**: Updated `LorelyService.inspect_source` to return both `temp_source_id` and `job_id`.

---

## 3. Root Cause 2: Why the PDF was Flagged as Corrupted OCR / Non-Narrative

### Is the book story enough?
Yes. Visually, *Voodoo Island* by Michael Duckworth (Oxford Bookworms Library) is a 43-page novella with characters, dialogue, and plot.

### Why did the system detect corrupted OCR?
A PDF containing scanned pages can either be:
1. Pure scanned bitmap images (requiring live OCR to read).
2. Scanned images overlaid with an invisible text layer (`3 Tr` text rendering mode in PDF specification).

In `/home/dawit/Downloads/Voodoo Island-.pdf`, the file contains high-resolution monochrome scans (`2480x3507` at 300 DPI), but the embedded invisible text layer created during the original scan is **severely corrupted/scrambled**:

#### Extracted Byte Samples from the PDF
- **Page 1**:
  ```text
  =  / .  >  r  =  /  : : - = = , - : - ' - = : - ; a - J = = == |: i = z = - =
  ```
- **Page 2**:
  ```text
  N c ) . a \ r ) - l  . a F - 4 -l -l -l .a o t r . ) o a c l . a d- $ d- ri \.) v)
  ```
- **Page 4**:
  ```text
  E E ; 9 + i # 3 ; J ; E  e  g *  o ; : g t E . q g T E - " ' i = 9 ! .  f  t  i i
  ```
- **Page 10**:
  ```text
  tigi: iiii* €:EriEji:E iE {111i iiiiii i;ii{l;t3€ ii EE€i, +i i{: i g: q: E!;
  ```

### What Happened During Inspection
1. PyMuPDF (`fitz`) extracted this text layer.
2. The AI classifier (`ClassificationService`) received a 4,000-character sample consisting entirely of punctuation marks, mathematical symbols, and non-alphanumeric noise.
3. The LLM accurately concluded that this was not readable narrative text, setting `document_type: unknown` and flagging:
   > *"The document content appears to be unreadable or corrupted OCR text."*

---

## 4. How to Successfully Ingest This Book

1. **Clean Digital Copy (Recommended)**: Use an EPUB or clean digital text version of *Voodoo Island*, where characters, words, and chapter boundaries are preserved as true Unicode strings.
2. **Re-OCR the PDF**: Run a clean OCR engine (such as Tesseract, Google Cloud Vision, or Adobe Acrobat OCR) over the scanned image pages to replace the corrupted invisible text layer with clean English words.
3. **Pasted Text**: If text is available from another source, paste it directly into the **Paste Text** tab of the Add Book modal.
