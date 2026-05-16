/**
 * Standalone Export API
 * POST /export  { design, format, measurements?, options? }
 *
 * Supported formats: svg | pdf | json | yaml | a4 | a3 | a2 | a1 | a0 | letter | legal | tabloid
 *
 * Tiled paper formats (a4, a3, …) use FreeSewing's PdfMaker — cover page,
 * rulers, and page markers are included automatically.
 * "pdf" produces a single full-size page via SinglePdfMaker.
 *
 * The generated file is saved to ./dist and returned as a download.
 */

import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import { themePlugin } from '@freesewing/plugin-theme'
import { pluginI18n } from '@freesewing/plugin-i18n'
import { cisMaleAdult40 } from '@freesewing/models'
import { PdfMaker } from '../packages/react/components/Editor/lib/export/pdf-maker.mjs'
import { SinglePdfMaker } from '../packages/react/components/Editor/lib/export/single-pdf-maker.mjs'
import { tilerPlugin } from '../packages/react/components/Editor/lib/export/plugin-tiler.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')

// ─── Constants ────────────────────────────────────────────────────────────────

const TILED_FORMATS = new Set(['a4', 'a3', 'a2', 'a1', 'a0', 'letter', 'legal', 'tabloid'])
const MARGIN_MM = 10
const VALID_FORMATS = [...TILED_FORMATS, 'svg', 'pdf', 'json', 'yaml']

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
  json: 'application/json',
  yaml: 'text/yaml',
}

const FORMAT_EXT = {
  svg: 'svg', pdf: 'pdf', json: 'json', yaml: 'yaml',
  a4: 'pdf', a3: 'pdf', a2: 'pdf', a1: 'pdf', a0: 'pdf',
  letter: 'pdf', legal: 'pdf', tabloid: 'pdf',
}

// ─── Design registry ──────────────────────────────────────────────────────────

const designs = {}

async function loadDesign(name) {
  if (designs[name]) return designs[name]
  const exportName = name.charAt(0).toUpperCase() + name.slice(1)
  const mod = await import(`@freesewing/${name}`)
  if (!mod[exportName]) throw new Error(`No named export '${exportName}' in @freesewing/${name}`)
  designs[name] = mod[exportName]
  return designs[name]
}

// ─── Blob → Buffer (Node 18+) ─────────────────────────────────────────────────

async function blobToBuffer(blob) {
  return Buffer.from(await blob.arrayBuffer())
}

// ─── Export logic ─────────────────────────────────────────────────────────────

async function exportPattern({ design, format, measurements, options }) {
  const DesignClass = await loadDesign(design)

  // Merge caller measurements over the cisMaleAdult40 defaults
  const merged = { ...cisMaleAdult40, ...(measurements || {}) }

  const pageSettings = {
    size: format,
    orientation: 'portrait',
    margin: MARGIN_MM,
    coverPage: true,
    cutlist: false,
  }

  const pattern = new DesignClass({ measurements: merged, options: options || {}, embed: false })
  pattern.use(themePlugin, { stripped: format !== 'svg', skipGrid: ['pages'] })
  pattern.use(pluginI18n, (key) => key)

  if (TILED_FORMATS.has(format)) {
    pattern.use(
      tilerPlugin({
        ...pageSettings,
        printStyle: true,
        renderBlanks: false,
        setPatternSize: true,
      })
    )
  }

  pattern.draft()
  const svg = pattern.render()

  // ── Convert to output buffer ──────────────────────────────────────────────

  if (TILED_FORMATS.has(format)) {
    const pages = pattern.setStores[pattern.activeSet].get('pages')
    const strings = {
      design: design.charAt(0).toUpperCase() + design.slice(1),
      tagline: 'FreeSewing — sewing patterns for everyone',
      url: '',
      cuttingLayout: 'Cutting layout',
      setName: 'Default',
      yaml: yaml.dump({ design, measurements: merged, options: options || {} }),
      version: '',
      notes: '',
      warns: '',
    }
    const maker = new PdfMaker({ svg, pageSettings, pages, strings, cutLayouts: null })
    await maker.makePdf()
    return blobToBuffer(await maker.toBlob())
  }

  if (format === 'pdf') {
    const maker = new SinglePdfMaker({
      svg,
      pageSettings: { size: [pattern.width, pattern.height] },
    })
    await maker.makePdf()
    return blobToBuffer(await maker.toBlob())
  }

  if (format === 'svg') return Buffer.from(svg, 'utf-8')

  const data = { design, measurements: merged, options: options || {} }
  if (format === 'json') return Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
  return Buffer.from(yaml.dump(data), 'utf-8') // yaml
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express()
app.use(cors())
app.use(express.json())

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

/**
 * POST /export
 * Body: { design, format, measurements?, options? }
 * Returns the exported file as a download.
 */
app.post('/export', async (req, res) => {
  const { design = 'aaron', format = 'svg', measurements, options } = req.body

  if (!VALID_FORMATS.includes(format)) {
    return res.status(400).json({
      error: `Unknown format '${format}'`,
      valid: VALID_FORMATS,
    })
  }

  try {
    const buffer = await exportPattern({ design, format, measurements, options })

    const ext = FORMAT_EXT[format]
    const filename = `${design}-${format}.${ext}`
    const filePath = path.join(distDir, filename)
    fs.writeFileSync(filePath, buffer)

    res
      .set('Content-Type', CONTENT_TYPES[ext])
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .set('Content-Length', buffer.length)
      .send(buffer)
  } catch (err) {
    console.error('Export error:', err)
    res.status(500).json({ error: 'Export failed', message: err.message })
  }
})

const port = process.env.EXPORT_PORT || 9001
app.listen(port, () => {
  console.log(`✅ Export API listening on http://localhost:${port}`)
  console.log(`   POST /export  { design, format, measurements?, options? }`)
  console.log(`   Formats: ${VALID_FORMATS.join(', ')}`)
})
