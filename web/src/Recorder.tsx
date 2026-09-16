import React, { useState, useRef } from 'react'
import { convertBlobToWav } from './wav'

export default function Recorder() {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const [lang, setLang] = useState('yue')
  const [processing, setProcessing] = useState(false)

  const start = async () => {
    setTranscript(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        setProcessing(true)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        try {
          // Convert to 16k WAV for better ASR compatibility
          const wavBlob = await convertBlobToWav(blob, 16000)
          const fd = new FormData()
          fd.append('file', wavBlob, 'rec.wav')
          fd.append('lang', lang)
          const res = await fetch('http://localhost:3001/api/asr', { method: 'POST', body: fd })
          if (!res.ok) {
            const err = await res.json()
            setTranscript('Error: ' + (err.error || res.statusText))
            return
          }
          const data = await res.json()
          setTranscript(data.text || JSON.stringify(data))
        } catch (e) {
          setTranscript('Processing error: ' + String(e))
        } finally {
          setProcessing(false)
        }
      }
      mr.start()
      setRecording(true)
    } catch (e) {
      setTranscript('Cannot access microphone: ' + String(e))
    }
  }

  const stop = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  return (
    <div>
      <h2>Recorder</h2>
      <label>
        語言：
        <select value={lang} onChange={e => setLang(e.target.value)}>
          <option value="zh">普通話 (zh)</option>
          <option value="yue">粵語 (yue)</option>
          <option value="auto">自動 (auto)</option>
        </select>
      </label>
      <div style={{ marginTop: 8 }}>
        {!recording ? (
          <button onClick={start} disabled={processing}>開始錄音</button>
        ) : (
          <button onClick={stop}>停止並上傳</button>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <strong>辨識結果：</strong>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{transcript}</pre>
      </div>
      <p style={{ color: '#666' }}>
        ※ 前端會把錄音轉為 16kHz 16-bit WAV 再上傳（可提高 ASR 相容性）。
      </p>
    </div>
  )
}
