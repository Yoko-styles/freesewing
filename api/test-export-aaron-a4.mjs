/**
 * Standalone test: export Aaron A4 PDF directly (no API server needed).
 * Run: node services/action-engine/api/test-export-aaron-a4.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import { themePlugin } from '@freesewing/plugin-theme'
import { pluginI18n } from '@freesewing/plugin-i18n'
import { cisMaleAdult40 } from '@freesewing/models'
import { Aaron } from '@freesewing/aaron'
import { PdfMaker } from '../packages/react/components/Editor/lib/export/pdf-maker.mjs'
import { tilerPlugin } from '../packages/react/components/Editor/lib/export/plugin-tiler.mjs'
import { processFreeSewingSvgForPdf } from '../packages/react/components/Editor/lib/export/process-svg-for-pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(__dirname, 'dist', 'test-aaron-a4.pdf')

const MARGIN_MM = 10
const pageSettings = {
  size: 'a4',
  orientation: 'portrait',
  margin: MARGIN_MM,
  coverPage: true,
  cutlist: false,
}

console.log('Drafting Aaron pattern …')

const pattern = new Aaron({ measurements: cisMaleAdult40, options: {}, embed: false })
pattern.use(themePlugin, { stripped: true, skipGrid: ['pages'] })
pattern.use(pluginI18n, (key) => key)
pattern.use(
  tilerPlugin({
    ...pageSettings,
    printStyle: true,
    renderBlanks: false,
    setPatternSize: true,
  })
)

pattern.draft()
const rawSvg = pattern.render()
const svg = processFreeSewingSvgForPdf(rawSvg)

const pages = pattern.setStores[pattern.activeSet].get('pages')
const strings = {
  design: 'Aaron',
  tagline: 'Yoko Styles — sewing patterns for everyone',
  url: '',
  cuttingLayout: 'Cutting layout',
  setName: 'Default',
  yaml: yaml.dump({ design: 'aaron', measurements: cisMaleAdult40, options: {} }),
  version: '',
  notes: '',
  warns: '',
}

console.log(`Pages: ${pages.rows} rows × ${pages.cols} cols`)

const maker = new PdfMaker({ svg, pageSettings, pages, strings, cutLayouts: null })
await maker.makePdf()
const blob = await maker.toBlob()
const buffer = Buffer.from(await blob.arrayBuffer())

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, buffer)

console.log(`Saved ${buffer.length} bytes → ${OUT_FILE}`)
console.log('Open the PDF and verify page labels (A1, B1, C1 …) are visible.')
