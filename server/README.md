# server README

This server provides two endpoints used by the frontend:

- POST /api/asr
  - multipart/form-data: file (audio file), lang (language code, e.g. "yue" or "zh")
  - Behaviour: if the environment variable WHISPER_CMD_TEMPLATE is set, the server will run that shell command (with placeholders) to transcribe audio.
  - Template placeholders: {file}, {lang}, {model}
  - Example template:
    /opt/whisper/main -m /opt/whisper/models/ggml-small.bin -f {file} --language {lang}

  - If WHISPER_CMD_TEMPLATE is not set, the endpoint returns 501 with a helpful message.

- POST /api/ocr
  - multipart/form-data: file (image)
  - Behaviour: uses Tesseract.js (node) to OCR the image and returns the recognized text.

Notes on installing a whisper.cpp binary for server-side ASR
- This server does NOT bundle whisper models or binaries.
- You can use whisper.cpp (https://github.com/ggerganov/whisper.cpp) compiled on your server, or any other command-line tool that accepts an audio file and prints recognized text.
- Set WHISPER_CMD_TEMPLATE to the command line to execute (the server will replace {file} and {lang} before running).

Docker usage (recommended)
1. Prepare a local directory `./whisper` that contains your whisper binary (`main`) and models folder (e.g. `models/ggml-small.bin`). Example layout:

   ./whisper/
   ├─ main              # compiled whisper.cpp binary (or other ASR binary)
   └─ models/
      └─ ggml-small.bin

2. Create a `.env` file next to `docker-compose.yml` with the WHISPER_CMD_TEMPLATE you want to use. Example `.env`:

   WHISPER_CMD_TEMPLATE="/opt/whisper/main -m /opt/whisper/models/ggml-small.bin -f {file} --language {lang}"
   WHISPER_MODEL="/opt/whisper/models/ggml-small.bin"

3. Start services with docker-compose:

   docker compose up --build -d

4. The server will be available at http://localhost:3001. The Recorder frontend will POST audio to /api/asr, and the container will execute your mounted whisper binary with the provided template.

Notes and troubleshooting
- Models and binaries are NOT baked into the Docker image — mount them into ./whisper and point WHISPER_CMD_TEMPLATE to the mounted path.
- If you get errors about permissions when the container tries to execute the binary, ensure the mounted `main` binary has execute permission (chmod +x main) on the host before starting the container.
- Keep an eye on container logs for ASR errors: `docker compose logs server -f`.

