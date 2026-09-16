import React from 'react'
import Recorder from './Recorder'
import CameraOCR from './CameraOCR'

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Smart Dictation Pal — Prototype</h1>
      <p>Record audio (Whisper backend) and do camera OCR (Tesseract.js browser).</p>
      <Recorder />
      <hr />
      <CameraOCR />
    </div>
  )
}
