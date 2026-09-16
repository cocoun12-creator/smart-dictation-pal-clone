const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { createWorker } = require('tesseract.js');
const util = require('util');
const execAsync = util.promisify(exec);

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

async function convertToWavIfNeeded(inputPath) {
  // If the file already has a .wav extension, assume it's fine
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;

  const outPath = inputPath + '.converted.wav';
  // Use ffmpeg to convert to 16kHz mono 16-bit WAV
  const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -sample_fmt s16 "${outPath}"`;
  try {
    const { stdout, stderr } = await execAsync(ffmpegCmd, { maxBuffer: 1024 * 1024 * 10 });
    console.log('ffmpeg stdout', stdout);
    console.log('ffmpeg stderr', stderr);
    return outPath;
  } catch (e) {
    console.error('ffmpeg conversion failed', e);
    throw new Error('ffmpeg conversion failed: ' + (e.stderr || e.message));
  }
}

app.post('/api/asr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    const lang = req.body.lang || 'auto';
    const originalPath = path.resolve(req.file.path);
    let filePath = originalPath;
    let convertedPath = null;

    const template = process.env.WHISPER_CMD_TEMPLATE;
    if (!template) {
      // Clean up upload
      try { fs.unlinkSync(originalPath); } catch (e) {}
      return res.status(501).json({ error: 'ASR not configured on server. Set WHISPER_CMD_TEMPLATE env variable. See server/README.md' });
    }

    // Try to convert to WAV if needed
    try {
      const ext = path.extname(originalPath).toLowerCase();
      if (ext !== '.wav') {
        convertedPath = await convertToWavIfNeeded(originalPath);
        filePath = convertedPath;
      }
    } catch (convErr) {
      // conversion failed - clean up and return error
      try { fs.unlinkSync(originalPath); } catch (e) {}
      return res.status(500).json({ error: 'Audio conversion failed', details: String(convErr) });
    }

    const cmd = template.replace(/{file}/g, filePath).replace(/{lang}/g, lang).replace(/{model}/g, process.env.WHISPER_MODEL || '');

    console.log('Running ASR command:', cmd);
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      // Clean up upload + converted file
      try { fs.unlinkSync(originalPath); } catch (e) {}
      if (convertedPath) {
        try { fs.unlinkSync(convertedPath); } catch (e) {}
      }
      if (err) {
        console.error('ASR error', err, stderr);
        return res.status(500).json({ error: 'ASR command failed', details: stderr || err.message });
      }
      // Return stdout as text
      return res.json({ text: stdout.trim(), raw: stdout });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing image file' });
    const filePath = path.resolve(req.file.path);

    const worker = createWorker({
      // You can set logger here
      logger: m => console.log(m)
    });

    await worker.load();
    await worker.loadLanguage('chi_tra+eng');
    await worker.initialize('chi_tra+eng');
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();

    // Clean up upload
    try { fs.unlinkSync(filePath); } catch (e) {}

    return res.json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
