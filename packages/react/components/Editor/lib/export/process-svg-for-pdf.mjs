/**
 * SVG post-processor for PDF export (tiled and single-page).
 *
 * svg-to-pdfkit ignores <style> blocks for path/stroke styling (injecting a
 * <style> block renders its raw CSS text as a filled black rectangle).  It DOES
 * parse the <style> block to resolve CSS class rules, applying them with higher
 * priority than presentation attributes.
 *
 * Strategy:
 *  - Remove FreeSewing logo <use> elements (the orphaned </use> kills group stacks).
 *  - Page grid reference labels (id="_pages__*", class "text-4xl … muted fill-fabric"):
 *      Strip the "muted" class so the CSS fill-opacity:0.15 rule is no longer applied,
 *      then add fill-opacity="0.5" as a presentation attribute (now the highest priority
 *      source for that property).  fill color, font-size and text-anchor all come from
 *      the remaining CSS classes (.fill-fabric, .text-4xl, .center).
 *  - All other <text> elements (part numbers, measurements, annotations): strip.
 *  - <text> wrapping <textPath> (fold-line labels): strip — they overflow page
 *    boundaries and repeat the full text run on every tile that contains the path.
 */
export function processFreeSewingSvgForPdf(svg) {
  return svg
    .replace(/<use\b[^>]*(?:href|xlink:href)\s*=\s*["']#logo["'][^>]*>(?:\s*<\/use>)?/gi, '')
    .replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, (m) => {
      if (m.includes('id="_pages__') && /class="[^"]*\btext-4xl\b/.test(m))
        return m
          .replace(/\bmuted\s?/, '')
          .replace(/<text\b/, '<text fill-opacity="0.5"')
      return ''
    })
}
