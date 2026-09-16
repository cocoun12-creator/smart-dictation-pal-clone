export async function uploadAudio(file: Blob, lang = 'auto') {
  const fd = new FormData()
  fd.append('file', file, 'rec.webm')
  fd.append('lang', lang)
  const res = await fetch('http://localhost:3001/api/asr', { method: 'POST', body: fd })
  return res.json()
}
