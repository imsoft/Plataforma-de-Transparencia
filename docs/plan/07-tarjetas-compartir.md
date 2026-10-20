# Entregable 10 — Tarjetas al compartir y el caso de `/d/<id>`

## Diseño de la imagen (1200 × 630, `next/og`, una plantilla en `packages/transparencia/og/`)

```
┌────────────────────────────────────────────────────────────────┐
│ ████ franja superior 12 px color-primario-legible               │
│                                                                │
│  [Escudo 120px]  H. AYUNTAMIENTO DE TUXCACUESCO       (gris)   │
│                  Transparencia                                 │
│                                                                │
│  ┌───────┐  Estado financiero marzo 2026                      │
│  │  📕   │  (título, 2 líneas máx., 52 px, negro sobre blanco) │
│  │  PDF  │                                                     │
│  └───────┘  Art. 8 · Fracc. V · Inciso b   ·   Marzo 2026      │
│             (chip con fondo color-primario-suave)              │
│                                                                │
│  8.5b                                  Publicado 14/04/2026    │
│  (clave grande, color-primario-legible)        (gris)          │
│ ████ franja inferior 12 px color-secundario                     │
└────────────────────────────────────────────────────────────────┘
```

- Fondo blanco siempre; el color del municipio solo en franjas, clave y chip: así cualquier color de partido se ve bien y el texto siempre cumple contraste (los tokens `-legible` del entregable 5).
- Tarjeta de **inciso**: sin ícono de archivo; en su lugar "12 documentos" y el título oficial del inciso.
- Tarjeta de **video**: la miniatura ocupa la mitad derecha con un ▶ encima; izquierda igual que arriba.
- Tarjeta de **página institucional**: escudo, nombre del municipio y título de la página; sin clave.
- Fuente: la del tema si está en la lista cerrada (se carga como ArrayBuffer en el edge), si no, Inter.
- Peso: PNG con pocos colores planos sale en 60–150 KB; prueba automática de < 300 KB.
- URL: `/og/d/<id>-<v>.png` y `/og/nodo/<so>/<clave>-<v>.png` donde `v = hash(título, periodo, tema.version)`. `Cache-Control: public, max-age=31536000, immutable`. Cambia el nombre o el color → cambia `v` → tarjeta nueva aunque WhatsApp tuviera la anterior.

## `/d/<id>` para robots de vista previa

`packages/transparencia/bots.ts` exporta la lista: `WhatsApp`, `facebookexternalhit`, `Facebot`, `Twitterbot`, `TelegramBot`, `LinkedInBot`, `Slackbot`, `Discordbot`, `Pinterestbot`, `iMessage`/`Applebot`? → **no** (Applebot es buscador; iMessage usa `facebookexternalhit`), `Googlebot` → **no** (sería cloaking). Prueba unitaria sobre la lista.

Respuesta al bot: HTML de ~2 KB con `<head>` completo (og:*, twitter:card, canonical = `/d/<id>`) y un `<body>` con el nombre y un enlace al archivo. Sin JS. `Cache-Control: public, s-maxage=3600`. La variación por user-agent se declara con `Vary: User-Agent`.

Etiquetas en todas las páginas: `og:title`, `og:description`, `og:image` + `width/height/alt`, `og:url`, `og:type` (`article` para documento/inciso, `website` para el resto), `og:site_name` (nombre oficial del sujeto obligado), `og:locale=es_MX`, `twitter:card=summary_large_image`.

## ¿Página pública del documento para personas?

**Recomendación: no en el MVP; mantener la redirección al archivo.** Razones y matices:

|                           | Redirigir al archivo (propuesto)                                      | Página intermedia con vista previa                                          |
| ------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Enlaces pegados en la PNT | El verificador abre el PDF directo: cero fricción, cero observaciones | Un clic más; algunos verificadores lo han marcado como "no es el documento" |
| Ciudadano desde WhatsApp  | Ya vio la tarjeta; llega al PDF                                       | Ve datos + botón; mejor en móvil con PDFs pesados                           |
| SEO                       | El PDF se indexa con su `Content-Disposition` legible                 | La página indexa título/descripción; mejor                                  |
| Costo                     | Nada                                                                  | 1–2 días                                                                    |

Camino intermedio que sí propongo: el inciso (`/85a`) ya es esa "página con datos" y cada documento en la lista muestra tamaño y tipo; los videos sí tienen página propia. Si en Fase 2 quieres la página intermedia, se agrega `/d/<id>/ver` sin tocar `/d/<id>`.
