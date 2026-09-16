import React, { useEffect, useRef, useState } from 'react'
import Tesseract from 'tesseract.js'

function preprocessCanvas(canvas: HTMLCanvasElement, maxWidth = 1024) {
  // Resize if too large to improve performance
  const ctx = canvas.getContext('2d')!
  let { width, height } = canvas
  if (width > maxWidth) {
    const scale = maxWidth / width
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  const offCtx = off.getContext('2d')!
  offCtx.drawImage(canvas, 0, 0, width, height)

  // Apply basic contrast & grayscale
  const img = offCtx.getImageData(0, 0, width, height)
  const data = img.data
  // Simple contrast enhancement
  const contrast = 1.2 // 1 = no change, >1 increases contrast
  const intercept = 128 * (1 - contrast)
  for (let i = 0; i < data.length; i += 4) {
    // convert to grayscale
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    // contrast
    const c = gray * contrast + intercept
    // simple adaptive threshold boost
    const boosted = c < 60 ? 0 : c
    data[i] = data[i + 1] = data[i + 2] = boosted
  }
  offCtx.putImageData(img, 0, 0)
  return off
}

export default function CameraOCR() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ocrText, setOcrText] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (e) {
        console.error('getUserMedia failed', e)
        setError('無法啟動相機，請確認瀏覽器權限或使用上方上傳功能。')
      }
    })()
    return () => {
      mounted = false
      // stop tracks when unmount
      const v = videoRef.current
      if (v && v.srcObject) {
        const s = v.srcObject as MediaStream
        s.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const recognizeFromCanvas = async (canvas: HTMLCanvasElement) => {
    setRunning(true)
    setOcrText('正在辨識...')
    setError(null)
    try {
      const processed = preprocessCanvas(canvas, 1024)
      // Use dataURL to feed Tesseract (smaller image speeds recognition)
      const dataUrl = processed.toDataURL('image/jpeg', 0.9)
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'chi_tra+eng', {
        logger: m => console.log('tesseract', m)
      })
      setOcrText(text)
    } catch (e) {
      console.error('OCR error', e)
      setError('OCR 錯誤：' + String(e))
      setOcrText('')
    } finally {
      setRunning(false)
    }
  }

  const captureAndRecognize = async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current!
    // prefer naturalSize if available
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    await recognizeFromCanvas(canvas)
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setRunning(true)
    setOcrText('讀取圖片...')
    setError(null)
    try {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('不能載入圖片'))
      })
      const canvas = canvasRef.current!
      // draw image to canvas with correct size
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      await recognizeFromCanvas(canvas)
      URL.revokeObjectURL(img.src)
    } catch (err) {
      console.error(err)
      setError('讀取/辨識圖片失敗: ' + String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <h2>Camera OCR</h2>
      <div>
        <video ref={videoRef} style={{ maxWidth: '100%', border: '1px solid #ccc' }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={captureAndRecognize} disabled={running || !!error}>拍照並辨識</button>
        <label style={{ marginLeft: 12 }}>
          或上傳圖片：
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ marginTop: 12 }}>
        <strong>OCR 結果：</strong>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{ocrText}</pre>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
      <p style={{ color: '#666' }}>※ Tesseract.js 會下載所需語言資料，且第一次執行會較慢；若相機無法啟動，請使用上傳圖片功能。</p>
    </div>
  )
}
