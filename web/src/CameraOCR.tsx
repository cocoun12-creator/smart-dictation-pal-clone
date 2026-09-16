import React, { useEffect, useRef, useState } from 'react'
import Tesseract from 'tesseract.js'

export default function CameraOCR() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ocrText, setOcrText] = useState<string>('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (e) {
        console.error('getUserMedia failed', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  const captureAndRecognize = async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current!
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setRunning(true)
    setOcrText('正在辨識...')
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'chi_tra+eng', {
        logger: m => console.log(m)
      })
      setOcrText(text)
    } catch (e) {
      setOcrText('OCR error: ' + e)
    }
    setRunning(false)
  }

  return (
    <div>
      <h2>Camera OCR</h2>
      <div>
        <video ref={videoRef} style={{ maxWidth: '100%', border: '1px solid #ccc' }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={captureAndRecognize} disabled={running}>拍照並辨識</button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ marginTop: 12 }}>
        <strong>OCR 結果：</strong>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{ocrText}</pre>
      </div>
      <p style={{ color: '#666' }}>※ Tesseract.js 會下載所需語言資料，初次運行會較慢。</p>
    </div>
  )
}
