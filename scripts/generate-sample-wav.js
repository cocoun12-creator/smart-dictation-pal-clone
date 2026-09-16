const fs = require('fs')

// Generates a 1-second 16kHz 16-bit PCM mono WAV with a short 440Hz sine tone
const sampleRate = 16000
const durationSec = 1
const freq = 440
const samples = sampleRate * durationSec
const numChannels = 1
const bitsPerSample = 16

const byteRate = sampleRate * numChannels * bitsPerSample / 8
const blockAlign = numChannels * bitsPerSample / 8
const dataSize = samples * numChannels * bitsPerSample / 8
const buffer = Buffer.alloc(44 + dataSize)

let offset = 0
function writeString(str) {
  buffer.write(str, offset)
  offset += str.length
}
function writeUInt32(v) { buffer.writeUInt32LE(v, offset); offset += 4 }
function writeUInt16(v) { buffer.writeUInt16LE(v, offset); offset += 2 }

writeString('RIFF')
writeUInt32(36 + dataSize)
writeString('WAVE')
writeString('fmt ')
writeUInt32(16)
writeUInt16(1) // PCM
writeUInt16(numChannels)
writeUInt32(sampleRate)
writeUInt32(byteRate)
writeUInt16(blockAlign)
writeUInt16(bitsPerSample)
writeString('data')
writeUInt32(dataSize)

// fill samples (sine wave)
for (let i = 0; i < samples; i++) {
  const t = i / sampleRate
  const sample = Math.round(Math.sin(2 * Math.PI * freq * t) * 0.2 * 0x7fff)
  buffer.writeInt16LE(sample, offset)
  offset += 2
}

const outPath = 'scripts/sample.wav'
fs.mkdirSync('scripts', { recursive: true })
fs.writeFileSync(outPath, buffer)
console.log('WAV generated:', outPath)
