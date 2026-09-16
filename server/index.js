const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { createWorker } = require('tesseract.js');
const util = require('util');
const execAsync = util.promisify(exec);

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// security headers
app.use(helmet());

// JSON body (if used)
app.use(express.json());
app.use(cors());

// multer setup for uploads (tmp storage) with file-size limit and deterministic path
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || `${10 * 1024 * 1024}`, 10), // default 10MB
  },
});

// rate limiting for /api/*
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// simple API key middleware (optional — enable by setting API_KEY env)
function requireApiKey(req, res, next) {
  const required = process.env.API_KEY;
  if (!required) return next();
  const provided = req.get('x-api-key') || req.query.api_key;
  if (!provided || provided !== required) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
app.use('/api/', requireApiKey);

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

// Utility: build command + args from template safely
function buildCmdArgsFromTemplate(template, filePath, lang) {
  // split tokens while preserving quoted segments
  const tokens = template.match(/(?:[^\s"]+|"[^"]*")+/g).map(t => t.replace(/^"(.+)"$/,'$1'));
  const cmd = tokens[0].replace('{file}', filePath).replace('{lang}', lang);
  const args = tokens.slice(1).map(tok => tok.replace('{file}', filePath).replace('{lang}', lang));
  return { cmd, args };
}

// Run whisper with spawn and timeout
function runWhisper(filePath, lang) {
  return new Promise((resolve, reject) => {
    const tpl = process.env.WHISPER_CMD_TEMPLATE;
    if (!tpl) return reject(new Error('WHISPER_CMD_TEMPLATE not set'));

    const { cmd, args } = buildCmdArgsFromTemplate(tpl, filePath, lang);

    // Optional safety check: if cmd is a path, ensure it exists
    try {
      if (cmd.includes('/') && !fs.existsSync(cmd)) {
        return reject(new Error(`Whisper binary not found at ${cmd}`));
      }
    } catch (e) {
      // ignore
    }

    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    const timeoutMs = parseInt(process.env.WHISPER_TIMEOUT_MS || '120000', 10); // default 2 min
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      reject(new Error('Whisper timeout'));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        const out = (stdout && stdout.trim()) ? stdout.trim() : stderr.trim();
        resolve(out);
      } else {
        const msg = stderr || stdout || `Exited with code ${code}`;
        reject(new Error(`Whisper failed: ${msg}`));
      }
    });
  });
}

app.post('/api/asr', upload.single('file'), async (req, res) => {
  const originalPath = req.file ? path.resolve(req.file.path) : null;
  const lang = req.body?.lang || 'auto';
  let convertedPath = null;
  let filePath = originalPath;

  if (!originalPath) {
    return res.status(400).json({ error: 'Missing file' });
  }

  // If WHISPER_CMD_TEMPLATE is not set, behave as before: cleanup and return 501
  if (!process.env.WHISPER_CMD_TEMPLATE) {
    try { fs.unlinkSync(originalPath); } catch (e) {}
    return res.status(501).json({ error: 'ASR not configured on server. Set WHISPER_CMD_TEMPLATE env variable.' });
  }

  try {
    // Convert if needed (reuse existing helper)
    const ext = path.extname(originalPath).toLowerCase();
    if (ext !== '.wav') {
      convertedPath = await convertToWavIfNeeded(originalPath);
      filePath = convertedPath;
    }

    const asrOutput = await runWhisper(filePath, lang);
    return res.json({ text: asrOutput });
  } catch (err) {
    console.error('ASR error:', err);
    return res.status(500).json({ error: err.message || 'ASR failed' });
  } finally {
    // always cleanup original and converted
    try { if (originalPath && fs.existsSync(originalPath)) fs.unlinkSync(originalPath); } catch (e) {}
    try { if (convertedPath && fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath); } catch (e) {}
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
