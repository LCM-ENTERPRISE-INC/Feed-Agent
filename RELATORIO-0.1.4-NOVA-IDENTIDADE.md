# RELATÓRIO 0.1.4 — Nova identidade visual ZapBusiness (monograma ZB)

**Marco:** Milestone 0.1.4  
**Branch:** `Front`  
**Escopo:** Identidade visual oficial baseada na referência do monograma ZB (reconstrução vetorial).  
**Fora de escopo:** backend, banco, API, QR, WhatsApp, lógica de negócio.

---

## Resumo

A identidade provisória (símbolo genérico) foi substituída pelo **monograma ZB oficial**, reconstruído em SVG com:

- Z como estrutura (barra superior, **canto vivo** superior direito, diagonal)
- B nascendo da curva inferior do Z, com dois lóbulos em D à direita
- Gradiente ciano → azul royal sobre fundo navy
- Wordmark **ZapBusiness** (Zap claro / Business em azul); LCM apenas em copyright/rodapé

---

## Assets gerados

### Vetores (`front-end/src/assets/brand/`)

| Arquivo | Uso |
|---------|-----|
| `zb-monogram.svg` | Símbolo sem fundo |
| `symbol.svg` / `app-icon.svg` / `zapbusiness-symbol.svg` | App icon (navy + ZB) |
| `logo-horizontal.svg` / `logo-dark.svg` / `zapbusiness-logo*.svg` | Logo horizontal (tema escuro) |
| `logo-horizontal-light.svg` / `logo-light.svg` | Logo horizontal (tema claro) |
| `logo-vertical.svg` / `logo-vertical-light.svg` | Logo vertical |
| `symbol-mono-light.svg` / `symbol-mono-dark.svg` | Monocromático |
| `symbol-outline.svg` | Outline |
| `app-icon-512.png` / `zb-monogram-512.png` | Preview raster |
| `logo-horizontal-dark.png` / `logo-horizontal-light.png` / `logo-vertical-dark.png` | Export PNG logos |

### Públicos (`front-end/public/`)

| Arquivo | Uso |
|---------|-----|
| `favicon.svg` | Favicon vetorial (versão otimizada small) |
| `favicon.ico` | Favicon legado (32px) |
| `favicon-16.png` … `favicon-64.png` | Favicons PNG |
| `apple-touch-icon.png` / `.svg` | Apple Touch (180) |
| `pwa-192x192.png` / `pwa-512x512.png` (+ SVG) | PWA |
| `android-chrome-192x192.png` / `android-chrome-512x512.png` | Android |
| `app-icon-512.png` | App icon raster |
| `manifest.webmanifest` | Manifest com ícones PNG/SVG |

### Geração

```bash
npm run generate:brand
```

Script: `front-end/scripts/generate-brand-assets.mjs` (SVG + raster via Playwright).

---

## Locais substituídos

| Superfície | Como |
|------------|------|
| Sidebar (aberta / recolhida) | `BrandMark` → `symbol.svg` |
| Login | `BrandMark` + wordmark |
| Loading / Splash | `StateViews` → `symbol.svg` |
| Header | Títulos via `BRAND` / `PAGE_TITLES` |
| Favicon | `index.html` (ICO + SVG + PNG 16/32/48) |
| PWA / Android | `manifest.webmanifest` |
| Apple Touch | `apple-touch-icon.png` |
| Meta / Document title | `index.html` + `useDocumentBrand` / `BRAND` |
| Copyright | LCM apenas via `BrandCopyright` / rodapé |

---

## Arquivos alterados

- `front-end/scripts/generate-brand-assets.mjs` (novo/atualizado)
- `front-end/src/assets/brand/*` (suite ZB)
- `front-end/public/favicon*` / `pwa-*` / `apple-touch-icon*` / `android-chrome-*` / `manifest.webmanifest`
- `front-end/index.html`
- `front-end/src/components/BrandMark.tsx`
- `front-end/src/config/brand.ts`
- `front-end/src/index.css` (peso tipográfico do wordmark → SemiBold 600)
- `front-end/package.json` (`generate:brand`)
- `RELATORIO-0.1.4-NOVA-IDENTIDADE.md`

**Não alterados:** backend, APIs, auth, WhatsApp/QR, broadcast, responsividade estrutural.

---

## Validação

| Cenário | Resultado |
|---------|-----------|
| Sidebar aberta | Marca ZB + ZapBusiness |
| Sidebar recolhida | Apenas símbolo ZB |
| Login | Marca + wordmark; sem “by LCM” no logo |
| Header / document title | ZapBusiness |
| Favicon / PWA / Apple | Novos assets |
| Dark / Light | Logos dark/light + tokens LCM existentes |
| Testes unitários marca | `brand.test.tsx` (ZapBusiness, copyright LCM) |

Comandos sugeridos:

```bash
cd front-end
npm run lint
npm run typecheck
npm run test:run
npm run build
```

---

## Responsividade

- Símbolo 36px (sidebar) / compacto no colapso — legível
- Favicon 16–64 com traço levemente mais grosso (`monogramSmall`)
- App icon / PWA 192–512 mantém padding navy + squircle
- Sem mudança de breakpoints de layout

---

## Critérios de marca respeitados

- Referência oficial reconstruída (não novo conceito)
- Sem “by LCM” / Enterprise no logo
- Sem glow exagerado, neon, metal ou 3D pesado
- Paleta: navy / royal / elétrico / ciano
- Wordmark: Zap + Business (Business em azul)

---

## Commit

```
feat(brand): aplica identidade oficial ZB do ZapBusiness
```

Sem push. Sem merge.
