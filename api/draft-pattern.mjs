/**
 * This script demonstrates how to draft a FreeSewing pattern standalone.
 * It mimics the behavior of the internal draft() function.
 */
import { Aaron } from '@freesewing/aaron'
import { cisMaleAdult40 } from '@freesewing/models'
import { themePlugin } from '@freesewing/plugin-theme'
import { pluginI18n } from '@freesewing/plugin-i18n'
import fs from 'fs'

// 1. Setup the settings
const settings = {
  measurements: cisMaleAdult40,
  embed: false, // Match the official export settings
  options: {
    // Optional: customize options
  },
}

console.log('🚀 Starting "Professional" draft for: Aaron')
console.log('-------------------------------------------')

try {
  // 2. Instantiate the Design
  const pattern = new Aaron(settings)

  // 3. Add Plugins (The same way the main site does)
  // themePlugin adds CSS, grids, and standard styling
  pattern.use(themePlugin, { stripped: false, skipGrid: ['pages'] })
  // pluginI18n handles translations
  pattern.use(pluginI18n, (key) => key)

  // 4. Draft the pattern
  pattern.draft()

  // 5. Remove the FreeSewing logo
  // We iterate through all drafted parts and delete the 'logo' snippet
  const draftedParts = pattern.parts[0]
  for (const name in draftedParts) {
    if (draftedParts[name].snippets?.logo) {
      delete draftedParts[name].snippets.logo
      console.log(`✂️  Removed logo from part: ${name}`)
    }
  }

  console.log(`\n\x1b[32m✅ Pattern drafted and cleaned!\x1b[0m\n`)
  console.log(`Drafted Parts (Set 0):`)
  for (const name in draftedParts) {
    const part = draftedParts[name]
    const points = Object.keys(part.points || {}).length
    const paths = Object.keys(part.paths || {}).length
    console.log(
      `- ${name.padEnd(15)}: ${points.toString().padStart(3)} points, ${paths.toString().padStart(3)} paths`
    )
  }

  // 6. Generate SVG output
  console.log(`\n📦 Generating Styled SVG output...`)
  const svg = pattern.render()

  // 7. Export to file
  const distDir = './dist'
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }
  const filename = `${distDir}/aaron-pro.svg`
  fs.writeFileSync(filename, svg)
  console.log(`\x1b[32m📂 Exported styled pattern to: ${filename}\x1b[0m`)

  console.log('\n-------------------------------------------')
  console.log('Done! This SVG now includes the FreeSewing theme/CSS.')
} catch (error) {
  console.error('\n\x1b[31m❌ Error:\x1b[0m')
  console.error(error)
}
