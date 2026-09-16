import React, { useState, useRef } from 'react'

export default function Recorder() {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const [lang, setLang] = useState('yue')

  const start = async () => {
    setTranscript(null)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    mediaRecorderRef.current = mr
    chunksRef.current = []
    mr.ondataavailable = (e) => chunksRef.current.push(e.data)
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('file', blob, 'rec.webm')
      fd.append('lang', lang)
      try {
        const res = await fetch('http://localhost:3001/api/asr', { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json()
          setTranscript('Error: ' + (err.error || res.statusText))
          return
        }
        const data = await res.json()
        setTranscript(data.text || JSON.stringify(data))
      } catch (e) {
        setTranscript('Network error: ' + e)
      }
    }
    mr.start()
    setRecording(true)
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
          <button onClick={start}>開始錄音</button>
        ) : (
          <button onClick={stop}>停止並上傳</button>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <strong>辨識結果：</strong>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{transcript}</pre>
      </div>
      <p style={{ color: '#666' }}>※ 伺服器端需設定 WHISPER_CMD_TEMPLATE 才能做 ASR（請參閱 server/README.md）</p>
    </div>
  )
}
