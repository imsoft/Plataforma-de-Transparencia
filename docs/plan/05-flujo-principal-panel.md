# Entregable 8 — Flujo principal del panel, pantalla por pantalla

Meta: primer documento subido y enlace copiado en < 2 minutos sin ayuda. Lenguaje sin jerga. Botones ícono + texto. Áreas de clic ≥ 44 px. Cada pantalla tiene estado vacío, cargando, error y éxito.

## Pantalla 1 — Inicio del municipio (`/m/tuxcacuesco`)

```
ESCRITORIO                                               CELULAR
┌──────────────────────────────────────────────────┐     ┌──────────────────────┐
│ [Escudo] Tuxcacuesco ▾        Brandon ▾  ☾  [🏷] │     │ [Escudo] Tuxcacuesco ▾│
├──────────────────────────────────────────────────┤     ├──────────────────────┤
│  ¿Qué quieres publicar hoy?                      │     │ ¿Qué quieres publicar?│
│  ┌──────────────────────────────────────┐ [Subir]│     │ ┌──────────────────┐ │
│  │ 🔍 Escribe la clave (85a) o palabras │        │     │ │🔍 clave o palabras│ │
│  └──────────────────────────────────────┘        │     │ └──────────────────┘ │
│   estados financieros · actas · nómina · (chips) │     │ ⬆ Subir documento    │
├────────────────────────┬─────────────────────────┤     ├──────────────────────┤
│ Te falta subir     (4) │ Recientes               │     │ Te falta subir   (4) │
│ 🔴 8.5b Estados fin.   │ Acta 12 · 8.5a · hoy    │     │ 🔴 8.5b Estados fin. │
│    marzo 2026   [Subir]│ Nómina mar · 8.5g · ayer│     │    marzo 2026 [Subir]│
│ 🟡 15.11 Actas 1T      │ …                       │     │ 🟡 15.11 Actas 1T    │
├────────────────────────┴─────────────────────────┤     ├──────────────────────┤
│ Explorar: [Ayuntamiento]  [DIF]                  │     │ Explorar ▸ Ayuntam.  │
└──────────────────────────────────────────────────┘     │           ▸ DIF      │
                                                         └──────────────────────┘
```

- El buscador busca por clave (`85a`, `8.5a`, `8 5 a`) y por palabras del título oficial. Resultados en vivo: "8.5.b — Estados financieros mensuales".
- El botón **Subir documento** abre el paso 1 del asistente aunque no se haya elegido lugar.
- Estado vacío (municipio nuevo): "Todavía no hay documentos. Empieza por buscar dónde va el primero."

## Pantalla 2 — Encontrar el lugar (árbol o resultado de búsqueda)

```
ESCRITORIO  /m/tuxcacuesco/ayuntamiento
┌ Ayuntamiento › Artículo 8 ─────────────────────────────┐
│ ▸ Art. 8  Información fundamental – General    120 docs│
│   ▾ Fracc. V  Información financiera…            🟡     │
│      a) Partidas del presupuesto…        3 docs  🟢  [Subir aquí] │
│      b) Estados financieros mensuales   36 docs  🔴  [Subir aquí] │
│ ▸ Art. 15 …                                             │
└─────────────────────────────────────────────────────────┘
CELULAR: acordeón de un nivel a la vez con breadcrumb arriba y botón fijo abajo "Subir aquí".
```

- Cada nodo muestra: etiqueta, título recortado, cantidad de documentos, semáforo, "Copiar enlace" en el menú `⋯`.
- Tocar un inciso abre la Pantalla 5 (lista de documentos) con el botón de subir arriba.

## Pantalla 3 — Subir (paso 2 de 3)

```
ESCRITORIO (diálogo)                                      CELULAR (pantalla completa)
┌ Subir a 8.5.b Estados financieros mensuales ──── ✕ ┐     ┌ ← 8.5.b Estados fin.  ┐
│  Paso 2 de 3 · Elegir archivo         ●●○         │     │ Paso 2 de 3            │
│ ┌────────────────────────────────────────────┐    │     │ ┌────────────────────┐ │
│ │   ⬆  Arrastra aquí tus archivos            │    │     │ │ 📄 Elegir archivo  │ │
│ │      o  [Elegir archivos]                  │    │     │ │ (PDF, Word, Excel…)│ │
│ │  PDF, Word, Excel, PowerPoint, ZIP, imagen │    │     │ └────────────────────┘ │
│ │  o video · máx. 50 MB (videos 2 GB)        │    │     │ 📎 estado-marzo.pdf    │
│ └────────────────────────────────────────────┘    │     │ ▓▓▓▓▓▓░░░░ 62 % 2.3 MB │
│ 📄 ESTADO_FINANCIERO_MARZO_2026.pdf  2.3 MB  ✓    │     │                        │
│ 📄 balance-marzo.xlsx                ▓▓▓░ 40 %   │     │ [Continuar]            │
│                                   [Continuar →]   │     └────────────────────────┘
└───────────────────────────────────────────────────┘
```

- La subida empieza **al soltar**, en paralelo con el paso 3 (no se espera a confirmar el nombre). Multipart con reintentos; si se corta la red: "Se perdió la conexión, reintentando…".
- Error de tamaño: "Este archivo pesa 60 MB y el máximo es 50 MB. Intenta comprimirlo o dividirlo." Error de tipo: "Solo se pueden subir PDF, Word, Excel… Este archivo es .exe".
- Si no se eligió lugar antes: el paso 1 es el buscador de la Pantalla 1 dentro del diálogo.

## Pantalla 4 — Confirmar nombre (paso 3 de 3)

```
┌ Subir a 8.5.b ─────────────────────────────────────┐
│  Paso 3 de 3 · Confirma el nombre      ●●●         │
│  Nombre que verán los ciudadanos                   │
│  ┌────────────────────────────────────────────┐    │
│  │ Estado financiero marzo 2026               │    │   ← sugerido desde el nombre del archivo
│  └────────────────────────────────────────────┘    │
│  Periodo   [ Marzo 2026 ▾ ]   (sugerido)           │   ← detectado: "marzo", "2026"
│  ─ Segundo archivo ─                               │
│  Nombre  [ Balance marzo ]   Periodo [ Marzo 2026 ]│
│                        [← Atrás]  [Publicar ✓]     │
└────────────────────────────────────────────────────┘
```

- Periodo: selector simple según la periodicidad del nodo (mensual → mes y año; trimestral → "1er trimestre 2026"; permanente → oculto).
- "Publicar" se habilita cuando la subida terminó y el nombre no está vacío. Si la subida sigue: "Publicando cuando termine la subida… 80 %".

## Pantalla 5 — Listo + lista del nodo

```
┌ 8.5.b Estados financieros mensuales ────────── [⬆ Subir] [🔗 Copiar enlace de esta sección] ┐
│ ✅ Se publicó "Estado financiero marzo 2026"   [🔗 Copiar enlace]  [Ver en el sitio ↗]  ✕ │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│ ≡ 📕 Estado financiero marzo 2026    PDF · 2.3 MB   Marzo 2026   hoy     [🔗 Copiar] [⋯]  │
│ ≡ 📗 Balance marzo                   Excel · 310 KB Marzo 2026   hoy     [🔗 Copiar] [⋯]  │
│ ≡ 📕 Estado financiero febrero 2026  PDF · 2.1 MB   Febrero 2026 12 mar  [🔗 Copiar] [⋯]  │
│   ⋯ = Renombrar · Cambiar periodo · Reemplazar archivo · Ocultar · Historial · Papelera    │
│ ☐ Este periodo no generó información   [Marcar]                                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
CELULAR: tarjetas apiladas; "Copiar enlace" como botón grande en cada tarjeta; ⋯ abre hoja inferior.
```

- "Copiar enlace" → toast "¡Enlace copiado! tuxcacuesco.gob.mx/d/k7x9q2abcd" con botón "Probar".
- Papelera/ocultar: toast "Se mandó a la papelera · [Deshacer]" 8 s; sin diálogo de confirmación.
- Reordenar: arrastrar con `≡` (Fase 1.5); en MVP orden por periodo desc y fecha.
- Opciones avanzadas (historial, versiones) solo dentro de `⋯` o en el detalle del documento.

Tiempo estimado del flujo: buscar (20 s) → soltar archivo (10 s) → confirmar (15 s) → copiar (5 s) ≈ 1 minuto con la subida en paralelo.
