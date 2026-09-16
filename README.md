# Smart Dictation Pal — Clone (Prototype)

This repository is a prototype implementation of the Smart Dictation Pal app.

Goals in this branch:
- Backend: provide /api/asr (hook for whisper.cpp or other local ASR command) and /api/ocr (server-side Tesseract.js OCR endpoint).
- Frontend: React + Vite app with recording UI (upload audio to /api/asr) and camera OCR using Tesseract.js in-browser.

Notes:
- This prototype uses an external whisper binary (whisper.cpp or other) for ASR if you configure the WHISPER_CMD_TEMPLATE environment variable. See server/README notes below.
- OCR on the web uses Tesseract.js; traineddata for chi_tra will be downloaded automatically by Tesseract.js when needed.

Quick start (development):
1. Start server
   cd server
   npm install
   # Optionally set WHISPER_CMD_TEMPLATE, e.g.:
   # export WHISPER_CMD_TEMPLATE="./main -m ./models/ggml-small.bin -f {file} -lang {lang}"
   npm run dev

2. Start web
   cd web
   npm install
   npm run dev

Open: http://localhost:5173

See server/README.md for more details about installing whisper.cpp / ggml models if you want server-side ASR.
