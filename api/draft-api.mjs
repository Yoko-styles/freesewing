import express from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Aaron } from '@freesewing/aaron'
import { Albert } from '@freesewing/albert'
import { Yuri } from '@freesewing/yuri'
import { cisMaleAdult40 } from '@freesewing/models'
import { themePlugin } from '@freesewing/plugin-theme'
import { pluginI18n } from '@freesewing/plugin-i18n'
import fs from 'fs'
import path from 'path'

const app = express()
const port = process.env.PORT || 9000

app.use(express.json())

// Map of available designs
const designs = {
  aaron: Aaron,
  albert: Albert,
  yuri: Yuri,
}

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
    return res.status(404).json({ error: `Design '${design}' not found.` })
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
 *                 description: |
 *                   Body measurements in millimeters.
 *                 example:
 *                   chest: 1053
 *                   hips: 884
 *                   neck: 400
 *                   hpsToWaistBack: 486
 *                   shoulderToShoulder: 465
 *                   waistToHips: 134
 *               options:
 *                 type: object
 *                 description: |
 *                   Design-specific options.
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
  const { design = 'aaron', measurements = cisMaleAdult40, options = {} } = req.body

  const DesignClass = designs[design.toLowerCase()]
  if (!DesignClass) {
    return res
      .status(400)
      .json({
        error: `Design '${design}' not found. Available: ${Object.keys(designs).join(', ')}`,
      })
  }

  try {
    const settings = {
      measurements,
      options,
      embed: false,
    }

    const pattern = new DesignClass(settings)
    pattern.use(themePlugin, { stripped: false, skipGrid: ['pages'] })
    pattern.use(pluginI18n, (key) => key)

    pattern.draft()

    // Optional: Clean up snippets if needed (matching draft-pattern.mjs logic)
    const draftedParts = pattern.parts[0]
    for (const name in draftedParts) {
      if (draftedParts[name].snippets?.logo) {
        delete draftedParts[name].snippets.logo
      }
    }

    const svg = pattern.render()
    
    // Save to dist folder
    const distDir = path.join(process.cwd(), 'dist')
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true })
    }
    const filename = `${design}-${Date.now()}.svg`
    const filePath = path.join(distDir, filename)
    fs.writeFileSync(filePath, svg)
    
    res.json({
      message: 'Pattern drafted successfully',
      file: filename,
      path: filePath
    })
  } catch (error) {
    console.error('Drafting error:', error)
    res.status(500).json({ error: 'Failed to draft pattern', message: error.message })
  }
})

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FreeSewing Drafting API',
      version: '1.0.0',
      description: 'An API to programmatically draft FreeSewing patterns.',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
  },
  apis: ['./draft-api.mjs'], // Search for @openapi in this file
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.listen(port, () => {
  console.log(`🚀 FreeSewing Drafting API listening at http://localhost:${port}`)
  console.log(`📖 Swagger docs available at http://localhost:${port}/docs`)
})
