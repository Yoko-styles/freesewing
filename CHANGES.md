# FreeSewing → Yoko Styles Branding Changes

This document records every core FreeSewing file that was modified to replace the FreeSewing logo and branding with Yoko Styles.

---

## 1. `services/action-engine/packages/config/src/logo.mjs`

**What it does:** Single source of truth for the logo SVG path `d` string. All other FreeSewing components import `logoPath` from this package (`@freesewing/config`).

**What changed:** Replaced the FreeSewing "Skully" skull logo path (designed for a 24×24 viewBox) with the Yoko Styles logo path (42×44 viewBox). The Yoko logo is made of 44 separate SVG subpaths that were concatenated into one `d` string using JavaScript string concatenation (`+`).

**Before:**
```js
export const logoPath = 'M 12 ... (FreeSewing Skully skull path, 24×24 viewBox)'
```

**After:**
```js
export const logoPath =
  'M16.2433 1.33845C15.36 1.46157 13.089 2.54844 ...' +   // subpath 1
  'M15.964 1.11388C17.1596 0.608201 ...' +                  // subpath 2
  // ... 44 subpaths total, all from apps/web/public/logo.svg
  'M40.8864 8.75668C41.0569 8.93006 ...'                    // subpath 44
```

> **Why concatenate?** An SVG `d` attribute can hold multiple subpaths — each `M` command starts a new one. Combining all 44 paths from the Yoko SVG into a single string means only one `<path>` element is needed, matching how FreeSewing expects `logoPath` to be used.

---

## 2. `services/action-engine/plugins/plugin-annotations/src/logo.mjs`

**What it does:** FreeSewing plugin that injects the logo watermark into every rendered pattern SVG via `logoDefs`. The `def(scale)` function returns an SVG `<g>` element that wraps the logo path.

**What changed:**
- **Transform:** Updated translation to correctly center the 42×44 Yoko logo. The old values were tuned for the 24×24 FreeSewing logo.
- **Scale multiplier:** Removed the `2 *` multiplier from the scale. The Yoko logo is already approximately twice the size of the original, so the multiplier is not needed.
- **Fill colour:** Changed from `currentColor` (inherits theme colour) to `#D07D7A` (Yoko brand pink), so the logo always appears in the correct brand colour regardless of theme.

**Before:**
```js
def: (scale) =>
  `<g id="logo" transform="scale(${2 * scale}) translate(-12.55 -18)">
     <path class="logo" fill="currentColor" d="${logoPath}"/>
   </g>`
```

**After:**
```js
def: (scale) =>
  `<g id="logo" transform="scale(${scale}) translate(-21 -22)">
     <path class="logo" fill="#D07D7A" d="${logoPath}"/>
   </g>`
```

> `translate(-21 -22)` centres the 42×44 logo: half of 42 = 21, half of 44 = 22.

---

## 3. `services/action-engine/packages/react/components/Logo/index.mjs`

**What it does:** React component (`FreeSewingLogo`) that renders the logo as an inline SVG — used in the UI (header, sidebar, etc.).

**What changed:**
- **`viewBox`:** Updated from `"1 0 25 25"` (FreeSewing 24×24 logo with offset) to `"0 0 42 44"` (Yoko logo dimensions).
- **Fill:** Changed from inheriting `currentColor` / using a stroke pattern to a fixed `fill="#D07D7A"` on the path.
- **Simplified markup:** Removed the stroke/dual-path pattern; now a single `<path>` renders the complete Yoko logo.

**Before:**
```jsx
<svg xmlns="http://www.w3.org/2000/svg" viewBox="1 0 25 25" className={className}>
  <path d={logoPath} fill="currentColor" />
</svg>
```

**After:**
```jsx
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 44" className={className}>
  <path d={logoPath} fill="#D07D7A" />
</svg>
```

---

## 4. `services/action-engine/packages/react/components/Editor/lib/export/pdf-maker.mjs`

**What it does:** Generates the PDF export. Builds a cover page with a logo, design name, settings YAML, date, and cut layouts.

**What changed:**
- **`logoSvg` wrapper:** Updated the inline SVG wrapper's `viewBox` from `"0 0 25 25"` to `"0 0 42 44"` to match the Yoko logo dimensions. The path data itself comes from `logoPath` (imported from `@freesewing/config`), so no path data needed changing here.
- **Fill on the SVG path:** Changed from `currentColor` to `#D07D7A`.
- **Cover page heading:** Changed the hardcoded brand name from `'FreeSewing'` to `'Yoko Styles'` in the `generateCoverPageTitle()` method.

**Before:**
```js
const logoSvg = `<svg viewBox="0 0 25 25" ...>
  <path d="${logoPath}" fill="currentColor" />
</svg>`
// ...
this.addText('FreeSewing', 20).addText(this.strings.tagline, 10, 4)
```

**After:**
```js
const logoSvg = `<svg viewBox="0 0 42 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="${logoPath}" fill="#D07D7A" />
</svg>`
// ...
this.addText('Yoko Styles', 20).addText(this.strings.tagline, 10, 4)
```

---

## Root `node_modules` (same changes, different scope)

The action-engine's local packages above are symlinked into `services/action-engine/node_modules/@freesewing/`. The web app (`apps/web`) resolves `@freesewing/*` from the **root** `node_modules/` instead (separate npm scope). The same logo changes were therefore also applied to:

| Root npm package file | Change applied |
|---|---|
| `node_modules/@freesewing/config/src/logo.mjs` | Same `logoPath` replacement as §1 |
| `node_modules/@freesewing/plugin-annotations/src/logo.mjs` | Same transform/fill update as §2 |

> **Warning:** Changes to `node_modules` are not tracked by git and will be overwritten by `pnpm install` / `npm install`. A permanent solution requires `patch-package` or equivalent.
