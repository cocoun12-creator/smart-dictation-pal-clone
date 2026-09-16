const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { createWorker } = require('tesseract.js');

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.post('/api/asr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    const lang = req.body.lang || 'auto';
    const filePath = path.resolve(req.file.path);

    const template = process.env.WHISPER_CMD_TEMPLATE;
    if (!template) {
      // Clean up upload
      fs.unlinkSync(filePath);
      return res.status(501).json({ error: 'ASR not configured on server. Set WHISPER_CMD_TEMPLATE env variable. See server/README.md' });
    }

    const cmd = template.replace(/{file}/g, filePath).replace(/{lang}/g, lang).replace(/{model}/g, process.env.WHISPER_MODEL || '');

    console.log('Running ASR command:', cmd);
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      // Clean up upload
      try { fs.unlinkSync(filePath); } catch (e) {}
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
