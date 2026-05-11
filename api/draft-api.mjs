import express from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { themePlugin } from '@freesewing/plugin-theme'
import { pluginI18n } from '@freesewing/plugin-i18n'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load default measurements and per-design measurement keys from local JSON
const { measurements: defaultMeasurements, designMeasurements } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'measurements.json'), 'utf-8')
)

// Folders in the designs directory that are not actual garment patterns
const SKIP = new Set(['examples', 'legend', 'plugintest', 'rendertest', 'bonny'])

// Discover all design folders and dynamically import each @freesewing/<name> package.
// Designs whose package isn't installed yet are silently skipped.
const designs = {}
const designsDir = path.join(__dirname, '../designs')

for (const name of fs.readdirSync(designsDir)) {
  if (SKIP.has(name)) continue
  if (!fs.statSync(path.join(designsDir, name)).isDirectory()) continue

  try {
    const exportName = name.charAt(0).toUpperCase() + name.slice(1)
    const mod = await import(`@freesewing/${name}`)
    if (mod[exportName]) {
      designs[name] = mod[exportName]
    }
  } catch {
    // Package not installed — skip silently
  }
}

console.log(`Loaded ${Object.keys(designs).length} designs: ${Object.keys(designs).join(', ')}`)

const app = express()
const port = process.env.PORT || 9000

app.use(express.json())

/**
 * @openapi
 * /api/designs:
 *   get:
 *     summary: List all available designs
 *     description: Returns the names of every design whose package is currently installed.
 *     responses:
 *       200:
 *         description: Array of design names.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 designs:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/api/designs', (_req, res) => {
  res.json({ designs: Object.keys(designs) })
})

/**
 * @openapi
 * /api/designs/{design}:
 *   get:
 *     summary: Get design-specific metadata
 *     description: Returns the required measurements and available styling options for a specific design.
 *     parameters:
 *       - in: path
 *         name: design
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the design (e.g., 'aaron').
 *     responses:
 *       200:
 *         description: Metadata for the design.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 measurements:
 *                   type: array
 *                   items:
 *                     type: string
 *                 options:
 *                   type: object
 *       404:
 *         description: Design not found.
 */
app.get('/api/designs/:design', (req, res) => {
  const { design } = req.params
  const DesignClass = designs[design.toLowerCase()]

  if (!DesignClass) {
    return res.status(404).json({
      error: `Design '${design}' not found.`,
      available: Object.keys(designs),
    })
  }

  const config = DesignClass.patternConfig || {}
  res.json({
    measurements: config.measurements || [],
    options: config.options || {},
  })
})

/**
 * @openapi
 * /api/draft:
 *   post:
 *     summary: Draft a FreeSewing pattern
 *     description: Takes measurements and options to generate a pattern SVG.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               design:
 *                 type: string
 *                 default: aaron
 *                 description: The name of the design to draft (e.g., 'aaron').
 *               measurements:
 *                 type: object
 *                 description: Body measurements in millimeters.
 *                 example:
 *                   chest: 1053
 *                   hips: 884
 *                   neck: 400
 *                   hpsToWaistBack: 486
 *                   shoulderToShoulder: 465
 *                   waistToHips: 134
 *               options:
 *                 type: object
 *                 description: Design-specific options.
 *                 example: {}
 *     responses:
 *       200:
 *         description: Success message and path to the saved SVG.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 file:
 *                   type: string
 *                 path:
 *                   type: string
 *       400:
 *         description: Invalid request or design not found.
 */
app.post('/api/draft', (req, res) => {
  const { design = 'aaron', measurements: rawMeasurements, options = {} } = req.body

  // Merge provided measurements over defaults, then filter to only what this design needs
  const merged = { ...defaultMeasurements, ...(rawMeasurements || {}) }
  const needed = designMeasurements[design.toLowerCase()] || []
  const measurements = needed.length > 0
    ? Object.fromEntries(needed.map(k => [k, merged[k]]).filter(([, v]) => v !== undefined))
    : merged

  const DesignClass = designs[design.toLowerCase()]
  if (!DesignClass) {
    return res.status(400).json({
      error: `Design '${design}' not found.`,
      available: Object.keys(designs),
    })
  }

  try {
    const pattern = new DesignClass({ measurements, options, embed: false })
    pattern.use(themePlugin, { stripped: false, skipGrid: ['pages'] })
    pattern.use(pluginI18n, (key) => key)
    pattern.draft()

    // Remove logo snippets
    const draftedParts = pattern.parts[0]
    for (const name in draftedParts) {
      if (draftedParts[name].snippets?.logo) {
        delete draftedParts[name].snippets.logo
      }
    }

    const svg = pattern.render()

    const distDir = path.join(process.cwd(), 'dist')
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })
    const filename = `${design}-${Date.now()}.svg`
    const filePath = path.join(distDir, filename)
    fs.writeFileSync(filePath, svg)

    res.json({ message: 'Pattern drafted successfully', file: filename, path: filePath })
  } catch (error) {
    console.error('Drafting error:', error)
    res.status(500).json({ error: 'Failed to draft pattern', message: error.message })
  }
})

/**
 * @openapi
 * /api/patterns/{filename}:
 *   get:
 *     summary: Retrieve a drafted pattern file
 *     description: Returns the SVG file content for a previously drafted pattern.
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename returned by the /api/draft endpoint.
 *     responses:
 *       200:
 *         description: The SVG file content.
 *         content:
 *           image/svg+xml:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Pattern file not found.
 */
app.get('/api/patterns/:filename', (req, res) => {
  const { filename } = req.params
  const filePath = path.join(process.cwd(), 'dist', filename)

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.sendFile(filePath)
  } else {
    res.status(404).json({ error: 'Pattern file not found' })
  }
})

// Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FreeSewing Drafting API',
      version: '1.0.0',
      description: 'An API to programmatically draft FreeSewing patterns.',
    },
    servers: [{ url: `http://localhost:${port}` }],
  },
  apis: ['./draft-api.mjs'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.listen(port, () => {
  console.log(`🚀 FreeSewing Drafting API listening at http://localhost:${port}`)
  console.log(`📖 Swagger docs available at http://localhost:${port}/docs`)
})
