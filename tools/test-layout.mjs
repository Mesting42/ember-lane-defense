// Static CSS sizing checks. These do not replace browser layout inspection.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import postcss from 'postcss'

const css = fs.readFileSync('src/styles.css', 'utf8')
const tree = postcss.parse(css)
function active(rule, width, height = Infinity) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type !== 'atrule' || parent.name !== 'media') continue
    if (parent.params.includes('(orientation: landscape)') && width <= height) return false
    for (const match of parent.params.matchAll(/\((min|max)-height:\s*([\d.]+)px\)/g)) {
      if (match[1] === 'min' ? height < +match[2] : height > +match[2]) return false
    }
    for (const match of parent.params.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)) {
      if (match[1] === 'min' ? width < +match[2] : width > +match[2]) return false
    }
  }
  return true
}
function value(selector, property, width) {
  let result
  tree.walkRules(rule => {
    if (!rule.selector.split(',').map(s => s.trim()).includes(selector) || !active(rule, width)) return
    rule.walkDecls(decl => {
      if (decl.prop === property) result = decl.value
      if (property === 'padding-left' && decl.prop === 'padding') {
        const sides = decl.value.split(/\s+/)
        result = sides[3] ?? sides[1] ?? sides[0]
      }
    })
  })
  assert(result !== undefined, `${selector} ${property}`)
  return result
}
function size(length, root) {
  // Static desktop fixture assumes no device cutout; real browser tests cover CSS.
  const safeInset = /^max\(([^,]+), env\(safe-area-inset-(?:left|right)\)\)$/.exec(length)
  if (safeInset) return size(safeInset[1].trim(), root)
  const match = /^([\d.]+)(rem|px)$/.exec(length)
  assert(match, length)
  return +match[1] * (match[2] === 'rem' ? root : 1)
}
function rootSize(width, preferred = 16) { return Math.max(preferred, Math.min(preferred * 2, width * .0125)) }
assert.equal(value('html', 'font-size', 2560), 'clamp(100%, 1.25vw, 200%)')
assert.equal(rootSize(2560), 32)
assert.equal(rootSize(1920), 24)
assert.equal(rootSize(1280), 16)
assert.equal(rootSize(390), 16)
assert.equal(rootSize(2560, 20), 32) // Respect larger user font settings.
assert.equal(rootSize(390, 20), 20)
assert.equal(rootSize(2560) / rootSize(1280), 2)
// At 200% browser zoom a 2560 screen exposes a 1280 CSS-pixel viewport.
assert.equal(rootSize(1280) * 2, rootSize(2560))

const rows = []
for (const width of [320, 390, 620, 820, 1000, 1150, 1200, 1280, 1366, 1440, 1920, 2560, 3440, 3840]) {
  const root = rootSize(width)
  const row = { width, rootPixels: root, scale: root / 16 }
  if (width >= 1200) {
    // Desktop columns use fixed rem sidebars and a flexible center.
    const columns = value('.battle-layout', 'grid-template-columns', width)
    const parts = /^(\S+) minmax\((\S+), 1fr\) (\S+)$/.exec(columns)
    assert(parts, columns)
    const padding = size(value('.battle-screen', 'padding-left', width) ?? '1.1875rem', root)
    const gaps = size(value('.battle-layout', 'gap', width), root) * 2
    const minimum = size(parts[1], root) + size(parts[2], root) + size(parts[3], root) + gaps + padding * 2
    assert(minimum <= width, `Desktop battlefield columns exceed ${width}: ${minimum}`)
    row.battleMinimumWidth = minimum
    row.mapNodeWidth = size(value('.map-node', 'width', width), root)
    row.mapHeight = size(value('.star-map', 'height', width), root)
    row.rewardBadgeWidth = size(value('.reward-card-icon', 'width', width), root)
    row.settingsRowHeight = size(value('.setting-row', 'min-height', width), root)
    row.trainingButtonHeight = size(value('.training-launch', 'min-height', width), root)
  }
  if (width <= 620) {
    assert.equal(value('.battle-layout', 'display', width), 'flex')
    assert.equal(value('.reward-cards', 'grid-template-columns', width), '1fr')
    assert.equal(value('.star-map', 'overflow-x', width), 'auto')
  }
  if (width <= 1000) assert.equal(value('.training-layout', 'grid-template-columns', width), 'minmax(0, 1fr)')
  rows.push(row)
}
const large = rows.find(row => row.width === 2560)
assert.equal(large.mapNodeWidth, 248)
assert.equal(large.mapHeight, 620)
assert.equal(large.rewardBadgeWidth, 224)
assert.equal(large.settingsRowHeight, 164)
assert.equal(large.trainingButtonHeight, 92)
for (const selector of ['.landing-copy h1', '.page-brand b', '.map-brief h2', '.node-title', '.reward-card h3', '.setting-row b', '.training-build', '.ending-main h1']) {
  const property = selector === '.training-build' || selector === '.setting-row b' || selector === '.node-title' ? 'font-size' : 'font'
  assert(value(selector, property, 2560).includes('rem'), `Fixed typography: ${selector}`)
}
assert(!/\bzoom\s*:/.test(css), 'Do not override browser zoom')
fs.mkdirSync('art-source/verification', { recursive: true })
fs.writeFileSync('art-source/verification/layout-sizing.json', JSON.stringify({ date: new Date().toISOString(), scope: 'Static CSS units, breakpoint and sizing math; not browser rendering', rows }, null, 2))
console.log(`PASS CSS scale and layout sizing at ${rows.length} widths, including 2560 at 100% and browser 200%.`)
