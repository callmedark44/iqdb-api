#!/usr/bin/env ts-node
import { search } from './src/api'
import { Service } from './src/type'
import express from 'express'
import multer from 'multer'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })
const port = process.env.PORT || 3333
const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY
console.log('Proxy:', proxy || '(none)')

const services: { value: Service; label: string; origin: 'www' | '3d' }[] = [
  { value: Service.Danbooru, label: 'Danbooru', origin: 'www' },
  { value: Service.Konachan, label: 'Konachan', origin: 'www' },
  { value: Service.Yandere, label: 'Yande.re', origin: 'www' },
  { value: Service.Gelbooru, label: 'Gelbooru', origin: 'www' },
  { value: Service.SankakuChannel, label: 'Sankaku Channel', origin: 'www' },
  { value: Service.EShuushuu, label: 'e-shuushuu', origin: 'www' },
  { value: Service.Zerochan, label: 'Zerochan', origin: 'www' },
  { value: Service.AnimePictures, label: 'Anime-Pictures', origin: 'www' },
  { value: Service.ThreeDBooru, label: '3dbooru', origin: '3d' },
  { value: Service.IdolComplex, label: 'Idol Complex', origin: '3d' },
]

app.use(express.urlencoded({ extended: true }))

app.get('/', (_req, res) => {
  const svcRows = services.map(s => {
    const id = s.value.replace(/[^a-z0-9]/gi, '_')
    return `<label class="svc" data-origin="${s.origin}"><input type="checkbox" name="services" value="${s.value}" id="${id}" checked> ${s.label}</label>`
  }).join('')

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IQDB Search</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; min-height: 100vh; }
.container { max-width: 1000px; margin: 0 auto; padding: 2rem 1rem; }
h1 { font-size: 1.8rem; margin-bottom: 0.5rem; color: #58a6ff; }
.subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 1.5rem; }
.card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
.form-row { margin-bottom: 1rem; }
.form-row:last-child { margin-bottom: 0; }
label.block { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; }
input[type="text"], input[type="file"] { width: 100%; padding: 0.6rem 0.8rem; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 0.95rem; }
input[type="text"]:focus { border-color: #58a6ff; outline: none; }
.or-divider { text-align: center; color: #8b949e; font-size: 0.85rem; margin: 0.8rem 0; }
.actions { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
button { padding: 0.55rem 1.2rem; background: #238636; border: none; border-radius: 6px; color: #fff; font-size: 0.95rem; cursor: pointer; font-weight: 600; }
button:hover { background: #2ea043; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
label.svc { display: inline-flex; align-items: center; gap: 0.3rem; margin: 0.2rem 0.6rem 0.2rem 0; font-size: 0.9rem; cursor: pointer; white-space: nowrap; }
label.svc input { width: auto; accent-color: #58a6ff; }
label.svc input:disabled { opacity: 0.4; }
.origin-tab { display: inline-block; padding: 0.4rem 1rem; border: 1px solid #30363d; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #8b949e; background: #0d1117; margin-bottom: -1px; }
.origin-tab.active { background: #161b22; border-color: #58a6ff; border-bottom-color: #161b22; color: #58a6ff; }
.origin-tab:hover { color: #58a6ff; }
.services-box { border: 1px solid #30363d; border-radius: 0 6px 6px 6px; padding: 0.8rem; background: #0d1117; margin-top: 0.5rem; }
.services-box.www-only .svc[data-origin="3d"] { display: none; }
.services-box.origin-3d .svc[data-origin="www"] { display: none; }
label.opt { display: inline-flex; align-items: center; gap: 0.3rem; text-transform: none; letter-spacing: 0; color: #c9d1d9; font-size: 0.9rem; cursor: pointer; margin-right: 1rem; }
label.opt input { width: auto; }
#loading { display: none; text-align: center; padding: 2rem; color: #8b949e; font-size: 1.1rem; }
.spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid #30363d; border-top-color: #58a6ff; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 0.6rem; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-card { background: #3d1f1f; border: 1px solid #f85149; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; color: #f85149; }
.meta { font-size: 0.9rem; color: #8b949e; margin-bottom: 1rem; }
.results { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
.result-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; transition: border-color 0.2s; }
.result-card:hover { border-color: #58a6ff; }
.result-card img { width: 100%; height: 180px; object-fit: contain; background: #0d1117; display: block; }
.result-info { padding: 0.6rem; font-size: 0.8rem; }
.result-match { font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.match-best { color: #3fb950; }
.match-additional { color: #58a6ff; }
.match-possible { color: #d29922; }
.match-other { color: #8b949e; }
.result-sim { font-size: 1rem; font-weight: 700; margin: 0.2rem 0; }
.result-source { color: #8b949e; }
.result-source a { color: #58a6ff; text-decoration: none; }
.result-source a:hover { text-decoration: underline; }
.result-type { display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; margin-top: 0.2rem; }
.type-safe { background: #1b3a1b; color: #3fb950; }
.type-ero { background: #3d1f1f; color: #d29922; }
.type-explicit { background: #3d1f1f; color: #f85149; }
.type-unrated { background: #1f1f3d; color: #8b949e; }
.result-dims { color: #8b949e; font-size: 0.75rem; margin-top: 0.2rem; }
.other-links { margin-top: 1.5rem; }
.other-links a { color: #8b949e; text-decoration: none; margin-right: 1rem; font-size: 0.85rem; }
.other-links a:hover { color: #58a6ff; }
.thumbnail-preview { margin-top: 1rem; text-align: center; }
.thumbnail-preview img { max-width: 100%; max-height: 200px; border-radius: 6px; border: 1px solid #30363d; }
</style>
</head>
<body>
<div class="container">
  <h1>🔍 IQDB Image Search</h1>
  <div class="subtitle">iqdb.org / 3d.iqdb.org</div>
  <div class="card">
    <div id="searchForm">
      <div class="form-row">
        <label class="block" for="url">Image URL</label>
        <input type="text" id="url" placeholder="https://example.com/image.jpg">
      </div>
      <div class="or-divider">— or —</div>
      <div class="form-row">
        <label class="block" for="file">Upload Image</label>
        <input type="file" id="file">
      </div>
      <div class="form-row">
        <label class="block">Sites to search</label>
        <div><span class="origin-tab active" data-origin="www">iqdb.org</span><span class="origin-tab" data-origin="3d">3d.iqdb.org</span></div>
        <div class="services-box www-only" id="servicesBox">${svcRows}</div>
      </div>
      <div class="form-row">
        <div class="actions">
          <button type="button" id="submitBtn">Search</button>
          <label class="opt"><input type="checkbox" id="ignoreColors"> Ignore colors</label>
          <label class="opt"><input type="checkbox" id="pickOtherResults"> More results</label>
        </div>
      </div>
    </div>
  </div>
  <div id="loading"><span class="spinner"></span> Searching...</div>
  <div id="results"></div>
</div>
<script>
const resultsDiv = document.getElementById('results')
const loadingDiv = document.getElementById('loading')
const submitBtn = document.getElementById('submitBtn')

document.querySelectorAll('.origin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const origin = tab.dataset.origin
    document.querySelectorAll('.origin-tab').forEach(t => t.classList.toggle('active', t.dataset.origin === origin))
    const box = document.getElementById('servicesBox')
    box.classList.toggle('www-only', origin === 'www')
    box.classList.toggle('origin-3d', origin === '3d')
  })
})

submitBtn.addEventListener('click', async (e) => {
  e.preventDefault()
  resultsDiv.innerHTML = ''
  loadingDiv.style.display = 'block'
  submitBtn.disabled = true

  const queueTimer = setTimeout(() => {
    loadingDiv.innerHTML = '<span class="spinner"></span> Waiting in queue...'
  }, 4000)

  const fd = new FormData()
  const file = document.getElementById('file').files[0]
  const url = document.getElementById('url').value.trim()
  if (file) fd.append('file', file)
  if (url) fd.append('url', url)
  fd.append('origin', document.querySelector('.origin-tab.active')?.dataset.origin || 'www')
  document.querySelectorAll('#servicesBox input:checked').forEach(cb => fd.append('services', cb.value))
  fd.append('ignoreColors', document.getElementById('ignoreColors').checked ? '1' : '0')
  fd.append('pickOtherResults', document.getElementById('pickOtherResults').checked ? '1' : '0')

  try {
    const res = await fetch('/search', { method: 'POST', body: fd })
    clearTimeout(queueTimer)
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Search request failed')
    }
    const data = await res.json()
    loadingDiv.style.display = 'none'
    submitBtn.disabled = false
    renderResults(data)
  } catch (err) {
    clearTimeout(queueTimer)
    loadingDiv.style.display = 'none'
    submitBtn.disabled = false
    resultsDiv.innerHTML = '<div class="error-card">' + (err.message || 'Connection failed') + '</div>'
  }
})

function renderResults(data) {
  let html = '<div class="meta">Searched ' + data.searched.toLocaleString() + ' images in ' + data.timeSeconds + 's</div>'

  if (data.thumbnailSrc) {
    html += '<div class="thumbnail-preview"><img src="' + data.thumbnailSrc + '" alt="Your image"></div>'
  }

  if (data.results.length === 0) {
    html += '<p style="color:#8b949e">No results found.</p>'
  } else {
    html += '<div class="results">'
    for (const r of data.results) {
      const matchClass = 'match-' + r.match
      const typeClass = 'type-' + r.type
      const thumbSrc = r.thumbnail?.fixedSrc || ''
      const src = r.sources[0] || {}
      html += '<div class="result-card">'
      html += '<a href="' + (src.fixedHref || '#') + '" target="_blank" rel="noopener"><img src="' + thumbSrc + '" alt="" loading="lazy"></a>'
      html += '<div class="result-info">'
      html += '<div class="result-match ' + matchClass + '">' + r.match + '</div>'
      html += '<div class="result-sim">' + r.similarity + '%</div>'
      html += '<div class="result-source">' + (src.service || '') + '</div>'
      html += '<div><span class="result-type ' + typeClass + '">' + r.type + '</span></div>'
      if (r.width && r.height) html += '<div class="result-dims">' + r.width + '×' + r.height + '</div>'
      html += '</div></div>'
    }
    html += '</div>'
  }

  html += '<div class="other-links">Also search on: '
  const o = data.otherSearchHrefs || {}
  if (o.saucenao) html += '<a href="' + o.saucenao + '" target="_blank" rel="noopener">SauceNao</a>'
  if (o.ascii2d) html += '<a href="' + o.ascii2d + '" target="_blank" rel="noopener">ascii2d</a>'
  if (o.google) html += '<a href="' + o.google + '" target="_blank" rel="noopener">Google</a>'
  if (o.tineye) html += '<a href="' + o.tineye + '" target="_blank" rel="noopener">TinEye</a>'
  html += '</div>'

  resultsDiv.innerHTML = html
}
</script>
</body>
</html>`)
})

app.post('/search', upload.single('file'), async (req, res) => {
  const url = req.body.url?.trim()
  const file = req.file

  if (!url && !file) {
    return res.status(400).json({ error: 'Provide an image URL or upload a file' })
  }

  try {
    const ignoreColors = req.body.ignoreColors === '1'
    const pickOtherResults = req.body.pickOtherResults === '1'
    const origin: 'www' | '3d' = req.body.origin === '3d' ? '3d' : 'www'
    const selected = ([] as string[]).concat(req.body.services || []).filter(Boolean)

    const website: any = { origin }
    if (selected.length > 0) website.services = selected

    const opts: any = { website, ignoreColors, pickOtherResults }
    if (proxy) opts.proxy = proxy

    const input = url || file!.buffer
    const result = await search(input, opts)
    res.json(result)
  } catch (e: any) {
    console.error('Search error:', e)
    res.status(500).json({ error: e.message || e.code || 'Search failed' })
  }
})

app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 8 MB limit required by iqdb.org' : err.message })
  }
  console.error('Server error:', err)
  res.status(500).json({ error: 'Server error' })
})

app.listen(port, () => {
  console.log('IQDB Search UI: http://localhost:' + port)
})
