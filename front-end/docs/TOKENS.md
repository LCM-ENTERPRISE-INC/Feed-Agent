# Design tokens — Feed-Agent front-end

Fonte canônica: `front-end/src/index.css` (`:root` e `[data-theme='dark']`).

## Cores

| Token | Uso |
|-------|-----|
| `--background` | Fundo da aplicação |
| `--surface` / `--surface-raised` | Superfícies e cards |
| `--panel-bg` / `--panel-border` | Painéis glass |
| `--text-main` / `--text-muted` / `--text-disabled` | Tipografia |
| `--primary` / `--primary-hover` / `--primary-alpha` / `--primary-ink` | Ação principal |
| `--success` / `--warning` / `--error` / `--info` | Semântica |
| `--border` | Bordas |

## Layout e interação

| Token | Uso |
|-------|-----|
| `--radius-sm/md/lg/full` | Raios |
| `--shadow-sm/md/lg` | Sombras |
| `--page-pad`, `--section-gap`, `--card-pad` | Espaçamentos |
| `--control-height`, `--touch-min` | Altura de controles |
| `--modal-width-sm/md/lg/xl` | Larguras de modal |
| `--focus-ring` | Anel de foco |
| `--z-*` | Empilhamento |
| `--bp-*` | Breakpoints de referência |

Não criar aliases duplicados com nomes diferentes para o mesmo valor.
