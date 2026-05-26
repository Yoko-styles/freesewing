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
import { processFreeSewingSvgForPdf } from '../packages/react/components/Editor/lib/export/process-svg-for-pdf.mjs'

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

// ─── SVG post-processors ──────────────────────────────────────────────────────

// For SVG format: inject a <style> block — browsers fully honour CSS specificity.
// Mirrors PatternDraftLayer.tsx so the downloaded SVG matches the web preview.
function processFreeSewingSvg(svg) {
  const overrides = `<style>
    svg > rect:first-of-type { fill: white !important; }
    .bg, [class*="-bg"] { fill: transparent !important; }
    .fabric { stroke: #b06060 !important; stroke-width: 1.5px !important; fill: none !important; }
    .lining { stroke: #8ca08c !important; stroke-width: 1px !important; fill: rgba(140,160,140,0.08) !important; }
    .interfacing { stroke: #9e8a85 !important; stroke-width: 0.8px !important; fill: none !important; stroke-dasharray: 4 2 !important; }
    .contrast { stroke: #b06090 !important; stroke-width: 0.8px !important; fill: none !important; }
    .mark { stroke: #6080b0 !important; stroke-width: 0.4px !important; fill: none !important; }
    .various { stroke: #b07060 !important; stroke-width: 0.6px !important; fill: none !important; }
    .note { stroke: #b06060 !important; stroke-width: 0.6px !important; fill: none !important; }
    use[href="#logo"], use[xlink\\:href="#logo"], .logo, .scalebox { display: none !important; }
    text, tspan { display: none !important; }
    text.text-4xl, text.text-4xl tspan { display: inline !important; fill: #2d2420 !important; }
    text.text-lg.font-bold, text.text-lg.font-bold tspan { display: inline !important; fill: #2d2420 !important; }
    text:has(textPath), text:has(textPath) textPath, text:has(textPath) tspan { display: inline !important; fill: #b06060 !important; }
  </style>`
  return svg.replace(/(<svg[^>]*>)/, `$1${overrides}`)
}

// processFreeSewingSvgForPdf is imported from the shared export lib above.

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

  // Parts that were never drafted keep bottomRight === false (the Part constructor default).
  // Calling asRenderProps() on them throws "false.asRenderProps is not a function".
  // Remove them from their stacks so the renderer skips them entirely.
  for (const stack of Object.values(pattern.stacks || {})) {
    for (const part of [...stack.parts]) {
      if (part.bottomRight === false || part.topLeft === false) {
        stack.parts.delete(part)
      }
    }
  }

  const rawSvg = pattern.render()
  // SVG: browser-safe CSS injection.  PDF/tiled: attribute-level manipulation
  // (svg-to-pdfkit ignores <style> blocks and renders their text as a black box).
  const svg = format === 'svg'
    ? processFreeSewingSvg(rawSvg)
    : processFreeSewingSvgForPdf(rawSvg)

  // ── Convert to output buffer ──────────────────────────────────────────────

  if (TILED_FORMATS.has(format)) {
    const pages = pattern.setStores[pattern.activeSet].get('pages')
    const strings = {
      design: design.charAt(0).toUpperCase() + design.slice(1),
      tagline: 'Yoko Styles — sewing patterns for everyone',
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
