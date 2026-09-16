// web/src/wav.ts
// Utility to convert an audio Blob (webm/ogg) into a WAV Blob with 16-bit PCM and specified sample rate.
export async function convertBlobToWav(blob: Blob, targetSampleRate = 16000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) throw new Error('Web Audio API not supported in this browser')
  const ctx = new AudioCtx()
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const numberOfChannels = Math.min(audioBuffer.numberOfChannels, 1) // use mono
    // Get channel data (mixdown if stereo)
    let channelData = audioBuffer.getChannelData(0)
    if (audioBuffer.numberOfChannels > 1) {
      const ch0 = audioBuffer.getChannelData(0)
      const ch1 = audioBuffer.getChannelData(1)
      channelData = new Float32Array(audioBuffer.length)
      for (let i = 0; i < audioBuffer.length; i++) {
        channelData[i] = 0.5 * (ch0[i] + ch1[i])
      }
    }

    // Resample to targetSampleRate if needed
    const srcRate = audioBuffer.sampleRate
    let samples: Float32Array
    if (srcRate === targetSampleRate) {
      samples = channelData
    } else {
      const ratio = srcRate / targetSampleRate
      const newLength = Math.round(channelData.length / ratio)
      samples = new Float32Array(newLength)
      for (let i = 0; i < newLength; i++) {
        const idx = i * ratio
        const idx0 = Math.floor(idx)
        const idx1 = Math.min(Math.ceil(idx), channelData.length - 1)
        const weight = idx - idx0
        samples[i] = (1 - weight) * channelData[idx0] + weight * channelData[idx1]
      }
    }

    // Convert float samples [-1,1) to 16-bit PCM
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    /* RIFF identifier */
    writeString(view, 0, 'RIFF')
    /* file length */
    view.setUint32(4, 36 + samples.length * 2, true)
    /* RIFF type */
    writeString(view, 8, 'WAVE')
    /* format chunk identifier */
    writeString(view, 12, 'fmt ')
    /* format chunk length */
    view.setUint32(16, 16, true)
    /* sample format (raw) */
    view.setUint16(20, 1, true)
    /* channel count */
    view.setUint16(22, 1, true)
    /* sample rate */
    view.setUint32(24, targetSampleRate, true)
    /* byte rate (sampleRate * blockAlign) */
    view.setUint32(28, targetSampleRate * 2, true)
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true)
    /* bits per sample */
    view.setUint16(34, 16, true)
    /* data chunk identifier */
    writeString(view, 36, 'data')
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true)

    // write the PCM samples
    let offset = 44
    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]))
      s = s < 0 ? s * 0x8000 : s * 0x7FFF
      view.setInt16(offset, s, true)
    }

    return new Blob([view], { type: 'audio/wav' })
  } finally {
    // close AudioContext to release resources
    try { ctx.close() } catch (e) {}
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
