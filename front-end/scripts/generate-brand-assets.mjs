/**
 * Gera identidade oficial ZB (monograma da referência) + rasters PNG/ICO.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandDir = path.resolve(__dirname, '../src/assets/brand');
const publicDir = path.resolve(__dirname, '../public');

const GRAD = `
  <linearGradient id="zb" x1="16" y1="12" x2="114" y2="118" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#5CEBFF"/>
    <stop offset="38%" stop-color="#14B4EE"/>
    <stop offset="72%" stop-color="#0070C0"/>
    <stop offset="100%" stop-color="#004A96"/>
  </linearGradient>
  <linearGradient id="zbFold" x1="42" y1="55" x2="78" y2="108" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#002B56" stop-opacity="0"/>
    <stop offset="50%" stop-color="#002B56" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#001A38" stop-opacity="0.34"/>
  </linearGradient>`;

/**
 * Monograma ZB — reconstrução da referência oficial.
 * Z = estrutura (barra + canto vivo + diagonal).
 * B nasce da curva inferior do Z; dois lóbulos em D à direita da diagonal.
 */
function monogramOfficial(stroke = 'url(#zb)', sw = 13.2, { fold = true } = {}) {
  const foldOverlay = fold && stroke.startsWith('url')
    ? `<path d="M84 29 L46 104" stroke="url(#zbFold)" stroke-width="${sw * 0.88}" stroke-linecap="butt" fill="none"/>`
    : '';
  return `
  <g fill="none" stroke="${stroke}" stroke-width="${sw}">
    <!-- Z: terminal redondo + CANTO VIVO + diagonal -->
    <path d="M20 29 H84 L46 104"
          stroke-linecap="round"
          stroke-linejoin="miter"
          stroke-miterlimit="2.15"/>
    ${foldOverlay}
    <!-- Lóbulo superior do B (D), topo alinhado à barra do Z -->
    <path d="M69 34
             C94 31 111 29 113.5 40
             C116 51 98 55.5 71 55.5"
          stroke-linecap="round"
          stroke-linejoin="round"/>
    <!-- Barra média do B nascendo da diagonal -->
    <path d="M61 66 H100" stroke-linecap="round"/>
    <!-- Pé do Z curva → lóbulo inferior do B -->
    <path d="M46 104
             C47 112 62 117 84 117
             C109 117 119.5 101 118 82
             C116.5 66 100 62 73 64"
          stroke-linecap="round"
          stroke-linejoin="round"/>
  </g>`;
}

function monogramSmall(stroke = 'url(#zb)', sw = 14.8) {
  return `
  <g fill="none" stroke="${stroke}" stroke-width="${sw}">
    <path d="M17 30 H80 L42 104"
          stroke-linecap="round"
          stroke-linejoin="miter"
          stroke-miterlimit="2.15"/>
    <path d="M66 35
             C90 32 108 30 110 41
             C112 52 96 56 68 56"
          stroke-linecap="round"
          stroke-linejoin="round"/>
    <path d="M58 66 H96" stroke-linecap="round"/>
    <path d="M42 104
             C43 112 58 116 80 116
             C104 116 114 101 112 82
             C110 67 96 62 70 64"
          stroke-linecap="round"
          stroke-linejoin="round"/>
  </g>`;
}

const monogramPaths = monogramOfficial('url(#zb)', 13.4);
const monogramPathsMono = (color) => monogramOfficial(color, 13.4, { fold: false });
const monogramPathsOutline = (color) => monogramOfficial(color, 10, { fold: false });

function svgWrap(inner, { bg = null, size = 128 } = {}) {
  const rx = Math.round(size * 0.22);
  const glow = bg
    ? `<radialGradient id="bgGlow" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#122038"/>
      <stop offset="100%" stop-color="#07111F" stop-opacity="0"/>
    </radialGradient>`
    : '';
  const bgRect = bg
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="${bg}"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bgGlow)"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" role="img" aria-hidden="true">
  <defs>${GRAD}${glow}</defs>
  ${bgRect}
  ${inner}
</svg>
`;
}

function wordmark({ dark = true, vertical = false } = {}) {
  const zap = dark ? '#F4F8FC' : '#0D2137';
  const business = dark ? '#14B4EE' : '#0072BB';
  if (vertical) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" fill="none" role="img" aria-hidden="true">
  <defs>${GRAD}</defs>
  <g transform="translate(16,6)">${monogramPaths}</g>
  <text x="80" y="170" text-anchor="middle" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="22" font-weight="600" letter-spacing="-0.02em">
    <tspan fill="${zap}">Zap</tspan><tspan fill="${business}">Business</tspan>
  </text>
</svg>
`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 72" fill="none" role="img" aria-hidden="true">
  <defs>${GRAD}</defs>
  <g transform="translate(-4,-24) scale(0.7)">${monogramPaths}</g>
  <text x="98" y="46" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="28" font-weight="600" letter-spacing="-0.02em">
    <tspan fill="${zap}">Zap</tspan><tspan fill="${business}">Business</tspan>
  </text>
</svg>
`;
}

async function rasterize(page, svgContent, outPath, size, height = size) {
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <div id="c" style="width:${size}px;height:${height}px">${svgContent.replace(
      '<svg',
      `<svg width="${size}" height="${height}"`,
    )}</div>
  </body></html>`;
  await page.setViewportSize({ width: size, height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('#c').screenshot({ path: outPath, omitBackground: true });
}

function writeIcoFromPng(pngPath, icoPath) {
  const png = fs.readFileSync(pngPath);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]));
}

async function main() {
  fs.mkdirSync(brandDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const appIcon = svgWrap(monogramPaths, { bg: '#07111F', size: 128 });
  const appIconSmall = svgWrap(monogramSmall('url(#zb)', 15), { bg: '#07111F', size: 128 });

  const files = {
    'zb-monogram.svg': svgWrap(monogramPaths, { size: 128 }),
    'symbol.svg': appIcon,
    'app-icon.svg': appIcon,
    'logo-horizontal.svg': wordmark({ dark: true }),
    'logo-horizontal-light.svg': wordmark({ dark: false }),
    'logo-vertical.svg': wordmark({ dark: true, vertical: true }),
    'logo-vertical-light.svg': wordmark({ dark: false, vertical: true }),
    'logo-dark.svg': wordmark({ dark: true }),
    'logo-light.svg': wordmark({ dark: false }),
    'symbol-mono-light.svg': svgWrap(monogramPathsMono('#F4F8FC'), { size: 128 }),
    'symbol-mono-dark.svg': svgWrap(monogramPathsMono('#0D2137'), { size: 128 }),
    'symbol-outline.svg': svgWrap(monogramPathsOutline('#14B4EE'), { size: 128 }),
    'zapbusiness-symbol.svg': appIcon,
    'zapbusiness-logo.svg': wordmark({ dark: true }),
    'zapbusiness-logo-dark.svg': wordmark({ dark: true }),
    'zapbusiness-logo-light.svg': wordmark({ dark: false }),
  };

  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(brandDir, name), content.trim() + '\n', 'utf8');
    console.log('wrote', name);
  }

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), appIconSmall, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.svg'), appIcon, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.svg'), appIcon, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.svg'), appIcon, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pngSizes = [
    { file: 'favicon-16.png', size: 16, svg: appIconSmall },
    { file: 'favicon-32.png', size: 32, svg: appIconSmall },
    { file: 'favicon-48.png', size: 48, svg: appIconSmall },
    { file: 'favicon-64.png', size: 64, svg: appIcon },
    { file: 'pwa-192x192.png', size: 192, svg: appIcon },
    { file: 'pwa-512x512.png', size: 512, svg: appIcon },
    { file: 'apple-touch-icon.png', size: 180, svg: appIcon },
    { file: 'android-chrome-192x192.png', size: 192, svg: appIcon },
    { file: 'android-chrome-512x512.png', size: 512, svg: appIcon },
    { file: 'app-icon-512.png', size: 512, svg: appIcon },
  ];

  for (const { file, size, svg } of pngSizes) {
    await rasterize(page, svg, path.join(publicDir, file), size);
    console.log('raster', file);
  }

  await rasterize(page, appIcon, path.join(brandDir, 'app-icon-512.png'), 512);
  await rasterize(page, files['zb-monogram.svg'], path.join(brandDir, 'zb-monogram-512.png'), 512);
  await rasterize(page, files['logo-horizontal.svg'], path.join(brandDir, 'logo-horizontal-dark.png'), 340, 72);
  await rasterize(page, files['logo-horizontal-light.svg'], path.join(brandDir, 'logo-horizontal-light.png'), 340, 72);
  await rasterize(page, files['logo-vertical.svg'], path.join(brandDir, 'logo-vertical-dark.png'), 160, 200);

  await browser.close();

  writeIcoFromPng(path.join(publicDir, 'favicon-32.png'), path.join(publicDir, 'favicon.ico'));
  console.log('wrote favicon.ico');
  console.log('BRAND_ASSETS_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
