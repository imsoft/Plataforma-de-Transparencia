# Entregables 5, 6 y 7 — Temas, generador, invalidación de caché y formato del índice

## 5a. Sistema de temas (`packages/theme`)

**Flujo:** `municipio_tema` (BD) → `temaDesdeBD(slug)` (cacheado con etiqueta `tema:<slug>`) → `tokensDeTema(tema)` (función pura: calcula variantes y contraste) → `<style>` inline en `<html>` con variables CSS → Tailwind v4 las consume vía `@theme`.

```css
/* packages/config/tailwind.css */
@theme inline {
  --color-primario: var(--t-primario);
  --color-primario-legible: var(--t-primario-legible);
  --color-sobre-primario: var(--t-sobre-primario);
  --color-secundario: …;
  --color-acento: …;
  --font-sans: var(--t-tipografia);
}
```

`tokensDeTema` genera por cada color base: `-legible` (se oscurece o aclara en pasos de OKLCH hasta ≥ 4.5:1 contra el fondo), `-sobre` (blanco o negro, el que dé más contraste), `-suave` (fondo tenue), y en el panel la variante **oscura** (`.dark`, misma regla contra fondo oscuro). Contraste WCAG 2.2 calculado en `contraste.ts` con pruebas unitarias; la UI del panel muestra "este color se ajustó para que sea legible" y la vista previa.

- Sitios: solo claro; la fuente se carga con `next/font` a partir de una lista cerrada (Inter, Source Sans 3, Merriweather, Roboto, Montserrat); el nombre viene de la BD.
- Escudo y logo de administración se guardan en R2 bajo `<municipio>/_tema/`.
- Cambiar identidad = `UPDATE municipio_tema` + `version + 1` + revalidar `tema:<slug>` y `og:*`. Sin redeploy.
- Fallback: cada app trae `tema.config.ts` con los valores iniciales por si la BD no responde en build.

## 5b. Generador (`pnpm new-municipality`)

Script `scripts/nuevo-municipio.ts` con `@clack/prompts`:

1. Pregunta: slug, nombre, nombre oficial, dominio, plantilla (MVP: solo `institucional-clasica`), colores base, sujetos obligados (Ayuntamiento preseleccionado; agregar DIF con prefijo `dif`, etc.).
2. Valida slug único (BD y carpeta), prefijos contra palabras reservadas.
3. Copia `templates/<plantilla>` → `apps/site-<slug>`, reemplaza `{{slug}}`, `{{nombre}}`, `{{dominio}}`; escribe `tema.config.ts` y `.env.example` con `MUNICIPALITY_SLUG` y `REVALIDATION_SECRET` generado.
4. Inserta `municipios`, `organization`, `municipio_dominios`, `municipio_tema`, `sujetos_obligados` dentro de `withUser` (actor: el superadmin que corre el script, `origen: 'generador'`).
5. Imprime los pasos manuales: crear proyecto en Vercel con Root Directory `apps/site-<slug>`, variables, dominio, Search Console. En Fase 2 estos pasos se hacen por API.
6. Idempotente: si la carpeta o el municipio ya existen, pregunta si actualizar o aborta.

## 6. Invalidación de caché entre panel y sitio

**Etiquetas** (`packages/transparency/etiquetas-cache.ts`, función pura):

| Cambio                                                               | Etiquetas afectadas                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Documento (crear, renombrar, reordenar, estado, reemplazar, periodo) | `documento:<id>`, `nodo:<so>:<clave>` + sus ancestros (`nodo:<so>:85`, `nodo:<so>:8`), `so:<prefijo>`, `sitemap` |
| Leyenda                                                              | `nodo:…` y ancestros                                                                                             |
| Redes sociales, tema, datos de contacto                              | `municipio` (lo usa el layout) y `og`                                                                            |
| Sujetos obligados, versión del índice                                | `todo`                                                                                                           |

**Lado del sitio:** cada lectura va en una función con `'use cache'` + `cacheTag(...)` + `cacheLife('days')` (Cache Components de Next 16); el endpoint `POST /api/revalidate` recibe `{ etiquetas: string[] }`, valida `Authorization: Bearer <secreto>` con `timingSafeEqual`, limita el cuerpo a 100 etiquetas y llama `revalidateTag` por cada una. Responde `{ ok, revalidadas }`.

**Lado del panel:**

1. Dentro de la transacción de `withUser` se inserta una fila en `revalidaciones_pendientes` (outbox). Si la transacción falla, no hay revalidación fantasma.
2. Al terminar la acción, `after()` de Next dispara `procesarRevalidaciones(municipioId)`: agrupa etiquetas pendientes, hace el POST con timeout de 5 s, y borra las filas si responde 200.
3. Si falla (sitio caído, deploy en curso), quedan las filas; un Vercel Cron cada 5 min (`/api/cron/revalidaciones`) reintenta con backoff y avisa a Sentry después de 10 intentos.
4. Red de seguridad: `cacheLife` de 1 día en el sitio, así nada queda desactualizado más de 24 h aunque todo lo anterior falle.
5. El secreto por municipio vive hasheado en `municipios.secreto_revalidacion` (para verificarlo en el panel al configurar) y en claro solo en las variables de entorno de la app del sitio y del panel (`REVALIDATION_SECRETS` JSON por slug). Si se rota, se cambia en ambos lados.

En local, `url_revalidacion` apunta a `http://localhost:3001/api/revalidate`.

## 7. Formato del archivo del índice

JSON (sin dependencias, validado con zod, diff legible en git). Un archivo por versión y tipo de sujeto obligado: `packages/law-index/data/jalisco/ley-anterior/ayuntamiento.json`.

```json
{
  "estado": "JAL",
  "version": {
    "slug": "ley-anterior",
    "nombre": "Ley de Transparencia de Jalisco (anterior)",
    "vigenciaDesde": "2013-08-08"
  },
  "tipoSujetoObligado": "ayuntamiento",
  "nodos": [
    {
      "nivel": "articulo",
      "numero": "8",
      "titulo": "Información fundamental — General",
      "hijos": [
        {
          "nivel": "fraccion",
          "numero": "V",
          "titulo": "La información financiera, patrimonial y administrativa",
          "periodicidad": "mensual",
          "hijos": [
            {
              "nivel": "inciso",
              "numero": "a",
              "titulo": "Las partidas del Presupuesto de Egresos…",
              "periodicidad": "anual"
            },
            {
              "nivel": "inciso",
              "numero": "b",
              "titulo": "Los estados financieros mensuales…",
              "periodicidad": "mensual"
            }
          ]
        }
      ]
    },
    {
      "nivel": "articulo",
      "numero": "15",
      "titulo": "Información fundamental — Ayuntamientos",
      "hijos": [
        {
          "nivel": "fraccion",
          "numero": "XI",
          "titulo": "Las actas de las sesiones del Ayuntamiento",
          "periodicidad": "mensual"
        }
      ]
    }
  ]
}
```

Reglas del cargador (`cargar.ts`):

- `numero` de fracción se acepta en romano o arábigo; se guarda arábigo y la etiqueta en romano.
- `clave` se genera: artículo + fracción arábiga + inciso + (sub-inciso numérico si existe). `periodicidad` se hereda del padre si falta; falta en la raíz → error.
- `carpeta_r2` se deriva (`art-08/fr-05/inc-a`).
- Errores detienen la carga con lista completa (clave duplicada, hijo sin padre válido, nivel fuera de orden).
- Re-ejecutar sobre una versión `borrador` la sincroniza (upsert por clave); sobre una `vigente` o `historica` solo permite cambios de `titulo`/`descripcion` (nunca estructura): la estructura de una versión publicada es inmutable, para eso existe la siguiente versión.
- Los textos oficiales del ejemplo son ilustrativos; los reales salen del HTML actual de Tuxcacuesco (v1) y del texto de la ley 2026 cuando lo tengas.
