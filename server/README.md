# server README

This server provides two endpoints used by the frontend:

- POST /api/asr
  - multipart/form-data: file (audio file), lang (language code, e.g. "yue" or "zh")
  - Behaviour: if the environment variable WHISPER_CMD_TEMPLATE is set, the server will run that shell command (with placeholders) to transcribe audio.
  - Template placeholders: {file}, {lang}, {model}
  - Example template:
    ./main -m ./models/ggml-small.bin -f {file} --language {lang}

  - If WHISPER_CMD_TEMPLATE is not set, the endpoint returns 501 with a helpful message.

- POST /api/ocr
  - multipart/form-data: file (image)
  - Behaviour: uses Tesseract.js (node) to OCR the image and returns the recognized text.

Notes on installing a whisper.cpp binary for server-side ASR
- This server does NOT bundle whisper models or binaries.
- You can use whisper.cpp (https://github.com/ggerganov/whisper.cpp) compiled on your server, or any other command-line tool that accepts an audio file and prints recognized text.
- Set WHISPER_CMD_TEMPLATE to the command line to execute (the server will replace {file} and {lang} before running).
