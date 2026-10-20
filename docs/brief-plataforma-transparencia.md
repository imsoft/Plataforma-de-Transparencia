# Prompt inicial: Plataforma de Transparencia Municipal (proyecto nuevo)

> Pega este documento completo al iniciar el proyecto nuevo, o guárdalo como `docs/brief.md` y pídele a Claude que lo lea antes de empezar.

---

## 0. Instrucciones para ti (Claude)

Vas a construir desde cero una plataforma SaaS multi-municipio, organizada como **monorepo**: **una app de administración** (panel) y **una app por cada municipio** (su sitio web con su propio dominio y diseño), todas compartiendo la lógica de transparencia en paquetes comunes. Antes de escribir código:

1. Lee todo este documento.
2. Propón un **plan de implementación por fases** (con el MVP primero), la **estructura de carpetas** y el **esquema de base de datos** completo, y espera mi aprobación.
3. Si algo de este documento es ambiguo o contradictorio, pregúntame **una** cosa a la vez, la más importante, y avanza con supuestos razonables en lo demás diciéndolos en voz alta.
4. No inventes contenido legal (artículos, fracciones, incisos, periodicidades). El índice de la ley lo cargaremos desde una fuente que yo te dé (ver sección 6).

Trabajo solo: soy desarrollador, ventas y operación al mismo tiempo. Prioriza lo que me ahorre tiempo y dime explícitamente qué se puede posponer.

### Resumen de decisiones ya tomadas (no las vuelvas a discutir salvo que veas un problema serio)

- **Monorepo Turborepo:** `apps/panel` (administración central) + **una app por municipio** (`apps/sitio-<municipio>`, cada una con su dominio y diseño) + paquetes compartidos. La transparencia vive en un paquete y nunca se copia.
- **Stack:** Next.js + TypeScript + Tailwind + shadcn/ui · **Neon** (Postgres) + **Drizzle** · **Better Auth** · **Cloudflare R2** · Vercel Pro · Resend · Sentry · Vitest + Playwright.
- **URLs:** claves cortas sin puntos (`/85a`), sujetos obligados con prefijo (`/dif/85a`), enlaces permanentes de documentos (`/d/<id>`).
- **Roles:** superadmin, supervisor (externo, varios municipios, **sí sube documentos**), admin municipal, capturista.
- **Bitácora inmutable** por triggers de Postgres; nada se borra de verdad (papelera + versiones).
- **Índice de la ley versionado** (Jalisco aprobó nueva ley en julio de 2026).
- **Archivos en R2 en carpetas legibles** que incluyen el ID del documento.
- **Diseño:** panel con acento de color del municipio y modo oscuro; sitios solo en claro con 3 plantillas base; marca de la plataforma en el panel y discreta en los sitios.
- **Prioridades transversales:** facilidad de uso extrema, responsivo, ciberseguridad, SEO y tarjetas elegantes al compartir.

---

## 1. Contexto

Soy Brandon (imSoft, Guadalajara, Jalisco). Desarrollo y mantengo sitios web de municipios. Hoy, en el sitio del municipio de **Tuxcacuesco** (Angular 13, repo aparte), los documentos de transparencia están escritos a mano en el HTML: unos **2,750 enlaces** a PDF alojados en DigitalOcean Spaces. Cada documento nuevo implica que el municipio me contacte, yo edite el HTML, compile y vuelva a publicar. Eso no escala.

**Objetivo:** una plataforma donde **cada municipio sube y administra sus propios documentos de transparencia** sin depender de mí, y donde cada sección de la ley tiene una URL corta y fácil de compartir. La quiero vender a la mayor cantidad posible de municipios de Jalisco (son 125) y después, quizá, de otros estados.

**Momento clave:** en Jalisco hay elecciones municipales en junio de 2027 y las nuevas administraciones entran en octubre de 2027. En ese cambio los municipios suelen perder su información de transparencia. La plataforma debe garantizar que la información y su historial **se queden con el municipio, no con la persona**. Ese es uno de los principales argumentos de venta.

**Calendario objetivo:**

| Periodo          | Meta                                                    |
| ---------------- | ------------------------------------------------------- |
| Ahora → feb 2027 | MVP funcionando. Tuxcacuesco como piloto (migrado)      |
| Feb → jun 2027   | 3–5 municipios más. Ajustes por uso real                |
| Jun → sep 2027   | Pulido, material de venta, municipio demo               |
| Oct 2027         | Entran nuevas administraciones: ventana grande de venta |

---

## 2. Glosario del dominio

- **Municipio:** cliente de la plataforma. Tiene su propio dominio (ej. `tuxcacuesco.gob.mx`), su propia app de sitio web en el monorepo y su propio diseño.
- **Panel:** la app de administración central donde todos los usuarios (superadmin, supervisor, personal de los municipios) gestionan documentos.
- **Sujeto obligado:** entidad dentro del municipio con obligaciones de transparencia propias. El principal es el **Ayuntamiento**; otros son el **DIF**, el organismo de agua potable, etc. Cada uno publica su propia información.
- **Índice de la ley (catálogo):** el árbol de obligaciones que marca la ley: **artículo → fracción → inciso** (y a veces sub-niveles o periodos). Es **igual para todos los municipios del estado**, así que se define una sola vez y lo comparten todos.
- **Versión del índice:** las leyes cambian (ver sección 6). Cada versión del índice corresponde a una versión de la ley.
- **Clave corta:** identificador de un nodo del índice usado en la URL. Ej.: artículo 8, fracción V, inciso a → `85a`.
- **Documento:** archivo publicado (PDF, Word, Excel, PowerPoint, ZIP, imagen o video; ver 5.8) colgado de un nodo del índice, con un **nombre visible** independiente del nombre del archivo.
- **Periodicidad:** cada cuánto debe actualizarse un nodo (mensual, trimestral, semestral, anual, permanente/sin vencimiento). Se usa para el semáforo de cumplimiento.
- **Leyenda "No se generó información":** cuando un municipio no tiene nada que publicar en un periodo, la ley pide publicar una justificación. Cuenta como **cumplido**.

---

## 3. URLs públicas (requisito central)

El sitio público de cada municipio responde en **su propio dominio** (servido por su propia app). Estas rutas de transparencia son **idénticas en todas las apps de municipio** porque vienen del paquete compartido `@plataforma/transparencia` (ver sección 7):

| URL                                         | Muestra                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tuxcacuesco.gob.mx/85a`                    | Solo el inciso a, fracción V, artículo 8 del **Ayuntamiento** con sus documentos                                                                                                |
| `tuxcacuesco.gob.mx/85`                     | La fracción V completa                                                                                                                                                          |
| `tuxcacuesco.gob.mx/articulo-8` (o similar) | El artículo completo (acordeón/árbol)                                                                                                                                           |
| `tuxcacuesco.gob.mx/dif/85a`                | Lo mismo, pero del **DIF**                                                                                                                                                      |
| `tuxcacuesco.gob.mx/dif`                    | Portada con el índice completo de transparencia del DIF                                                                                                                         |
| `tuxcacuesco.gob.mx/d/<id>`                 | **Enlace permanente** a un documento: redirige al archivo (los videos muestran una página con reproductor, ver 5.8; los robots de redes sociales reciben una tarjeta, ver 10.3) |

### Reglas de las claves cortas

- Formato: **número de artículo + número de fracción en arábigo + letra del inciso**, todo junto, **sin puntos ni guiones**. Ej.: `85a`, `151b`, `1511a`.
- La clave canónica va en minúsculas. `85A` redirige (301) a `85a`.
- Variantes que alguien podría escribir (`8.5a`, `8-5-a`, `8.V.a`) redirigen a la canónica.
- El **Ayuntamiento** vive en la raíz (`/85a`). Los demás sujetos obligados usan un **prefijo de ruta** (`/dif/85a`, `/agua/85a`). La clave es la misma, el prefijo indica el sujeto obligado.
- Los prefijos (`dif`, `agua`, `d`, `admin`, etc.) son **palabras reservadas**: ninguna otra página del sitio puede usarlas.
- Las claves del índice siempre empiezan con número y las páginas normales del sitio (`/directorio`, `/contacto`) con letra, así no chocan.
- Las claves **se generan automáticamente** al cargar una versión del índice, y el sistema **valida que no haya duplicados** dentro de la misma versión. Si hay un choque, falla la carga con un error claro; nunca se resuelve en silencio.

### Enlaces permanentes de documentos

- Los municipios pegan los enlaces de sus documentos en formatos oficiales (Plataforma Nacional de Transparencia). **Un enlace roto les genera observaciones.**
- Por eso nunca se reparte la URL directa del bucket. Cada documento tiene `/d/<id>`, que redirige al archivo actual.
- El archivo se guarda en el bucket en una **ruta ordenada y legible que incluye el ID del documento** (ver 7.5). El nombre visible oficial vive en la base de datos; la ruta del archivo puede cambiar (ej. al renombrar) sin afectar `/d/<id>`.
- Renombrar, reordenar o **reemplazar** el archivo nunca cambia `/d/<id>`.
- Un documento eliminado (en papelera) o histórico debe mostrar una página clara en `/d/<id>` (no un 404 genérico). Define el comportamiento exacto en el plan.

---

## 4. Usuarios y roles

| Rol                 | Alcance                                                                                  | Permisos                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Superadmin** (yo) | Toda la plataforma                                                                       | Todo: alta de municipios, sujetos obligados, versiones del índice, usuarios de cualquier nivel, configuración, facturación                                                                                                                  |
| **Supervisor**      | Municipios que se le asignen (o todos)                                                   | **Ver** todo de sus municipios (tablero, semáforo, documentos, bitácora, reportes) **y también subir, renombrar, reordenar, reemplazar, ocultar, eliminar y restaurar documentos**. **No** gestiona usuarios ni configuración del municipio |
| **Admin municipal** | Su municipio                                                                             | Gestiona usuarios de su municipio y todos sus documentos                                                                                                                                                                                    |
| **Capturista**      | Su municipio; opcionalmente restringido a ciertos sujetos obligados o ciertas fracciones | Subir, renombrar, reordenar, reemplazar, ocultar, eliminar y restaurar documentos dentro de su alcance                                                                                                                                      |

Notas:

- El supervisor es una persona **externa al gobierno** que trabaja por su cuenta con varios municipios. Es probable que se vuelva un canal de venta, así que su experiencia de uso importa.
- Un mismo usuario puede tener roles en más de un municipio (ej. supervisor de 5 municipios). Al iniciar sesión elige en cuál trabajar.
- La autorización se valida **siempre en el servidor del panel** (nunca solo en la UI) con una capa central de permisos. Además, como segunda capa, **Row Level Security** de Postgres en las tablas con datos de municipios (ver 7.2).
- Autenticación con **Better Auth**: el **plugin de organizaciones** modela municipios (organización), membresías, roles e invitaciones; el **plugin de 2FA** la verificación en dos pasos; el **plugin admin** el rol global de superadmin, baneo de usuarios, revocación de sesiones e _impersonation_ para soporte. El supervisor es miembro de varias organizaciones (o tiene un rol global de "supervisor de todos"; propón el mejor modelado).
- En el MVP no hay registro público: los usuarios se dan de alta **por invitación** (correo).

---

## 5. Funcionalidades

### 5.1 Panel — app `apps/panel` (dominio central, ej. `panel.<plataforma>.mx`)

El panel es **una sola app** en **un solo dominio central**, no dentro de cada `.gob.mx`: un solo inicio de sesión, sin problemas de cookies entre dominios, y un selector de municipio para quien tenga varios. Gestiona los documentos de **todos** los municipios; los sitios de los municipios solo los muestran.

**Para capturistas, admins municipales y supervisores:**

- Navegar el árbol del índice por sujeto obligado (Ayuntamiento, DIF, ...).
- Entrar a un nodo y ver sus documentos.
- **Subir uno o varios archivos** con arrastrar y soltar, directo del navegador al bucket (ver 7.2).
- Asignar o editar el **nombre visible** de cada documento.
- Asignar **periodo** (ej. "marzo 2026", "1er trimestre 2026", "ejercicio 2025") cuando aplique.
- **Reordenar** documentos dentro de un nodo.
- **Reemplazar** el archivo de un documento (conserva la versión anterior).
- **Ocultar / mandar a histórico** un documento.
- **Eliminar** (papelera) y **restaurar**.
- Marcar un nodo/periodo con la leyenda **"No se generó información"** más su texto de justificación.
- Botón **"Copiar enlace"** en cada documento (`/d/<id>`) y en cada nodo (`/85a`).
- Ver el **historial** de cada documento.

**Para admins municipales (además):**

- Invitar usuarios, asignar rol y alcance, y **dar de baja usuarios** en un clic. En los municipios el personal cambia mucho; quien se va no puede conservar acceso.
- **Gestionar las redes sociales** de su municipio y de cada sujeto obligado (ver 5.7).

**Para el supervisor (además):**

- **Tablero general:** tabla de municipios con porcentaje de avance, fecha de la última actualización y **semáforo**:
  - 🟢 al día
  - 🟡 próximo a vencer
  - 🔴 atrasado o vacío
- **Detalle por municipio:** el árbol del índice con el estado de cada nodo.
- **Bitácora** filtrable por municipio, usuario, acción y fechas.
- **Reportes exportables** (Excel y PDF) por municipio o generales.

**Para el superadmin (además):**

- Alta de municipio en la base de datos (nombre, dominio(s), sujetos obligados con su prefijo). Junto con el generador de apps (ver 7.4), dejar un municipio nuevo funcionando **debe tomar minutos**, no días.
- Configuración de **identidad** del municipio (colores, tipografía, escudo, logo de la administración, imágenes) y del **modo veda** (ver 5.6).
- Gestión de **versiones del índice** (cargar, validar, publicar, marcar la vigente).
- Asignar municipios a supervisores.
- **Importación masiva** (ver 11).
- **Exportación completa** por municipio (ver 5.4).
- Suspender el **panel** de un municipio por falta de pago **sin afectar nunca su sitio público** (apagar la transparencia de un municipio es un problema legal y de reputación).

### 5.2 Semáforo de cumplimiento

- Cada nodo del índice tiene una **periodicidad**. El estado se calcula con la fecha del último documento (o leyenda) del periodo vigente.
- Los nodos con periodicidad "permanente" (leyes, reglamentos) no vencen: basta con que tengan al menos un documento.
- La leyenda "No se generó información" cuenta como **cumplido** para ese periodo.
- Define en el plan las reglas exactas de "próximo a vencer" (ej. N días antes del fin de plazo) y deja los umbrales configurables.

### 5.3 Bitácora (historial)

**Qué se registra en cada movimiento:**

- **Quién:** usuario, su rol en ese momento y el municipio.
- **Qué acción:** subir, renombrar, reemplazar archivo, cambiar orden, cambiar periodo, ocultar, mandar a histórico, eliminar, restaurar, marcar o desmarcar leyenda, más los cambios de usuarios y roles.
- **Sobre qué:** documento, nodo (clave) y sujeto obligado.
- **Antes → después** de cada campo que cambió.
- **Cuándo:** timestamp con zona horaria (America/Mexico_City para mostrar).

**Reglas:**

1. **Solo se agregan registros (append-only).** Nadie puede editar ni borrar la bitácora, **ni siquiera el superadmin**. Aplícalo a nivel base de datos: el rol de Postgres que usa la app no tiene permisos de `UPDATE`/`DELETE`/`TRUNCATE` sobre la tabla, y un trigger rechaza cualquier intento.
2. Los registros los generan **triggers de Postgres**, no el código de la app, para que ningún cambio se escape. El usuario que actúa se pasa en cada transacción: **toda escritura** del panel pasa por **un único helper** (ej. `conUsuario(usuario, async (tx) => ...)`) que abre una transacción y ejecuta `SET LOCAL app.usuario_id = ...` y `SET LOCAL app.rol = ...`. Los triggers leen esos valores con `current_setting(...)`, y **si no existen, rechazan la escritura**. Así es imposible escribir sin dejar rastro.
3. **Eliminar = papelera** (soft delete). El documento sale del sitio público pero se puede restaurar.
4. **Reemplazar un archivo conserva la versión anterior** en el bucket y en una tabla de versiones, consultable desde el historial del documento.
5. Vistas: historial **por documento**, **por municipio** y **por usuario**.

### 5.4 Exportación completa

- Un ZIP por municipio con todos sus archivos, organizados por sujeto obligado / versión del índice / nodo, más un CSV o JSON con los metadatos y la bitácora.
- Es el seguro del cliente de que su información no queda secuestrada y la base del "kit de entrega-recepción" para el cambio de administración de 2027.
- Puede generarse en segundo plano y notificarse por correo cuando esté listo.

### 5.5 Sitios de los municipios — una app por municipio (`apps/sitio-<municipio>`)

- Cada municipio tiene **su propia app** con **su propio dominio** y **su propio diseño**: portada, menú, páginas institucionales (directorio, turismo, contacto, aviso de privacidad...). Cada administración quiere que su sitio "se vea suyo", muchas veces con los colores de su partido.
- La sección de **transparencia** NO se programa en cada app: se **monta** desde el paquete compartido `@plataforma/transparencia` (rutas `/85a`, `/85`, `/dif/85a`, `/dif`, `/d/<id>`, variantes y redirecciones). Toma los colores y tipografía del tema del municipio, pero conserva la **misma estructura** en todos los municipios: es lo más delicado, debe ser fácil de usar para el ciudadano y el supervisor, y no quiero mantener 30 versiones distintas.
- Las páginas de transparencia deben ser rápidas, accesibles y funcionar en celular (ver sección 8). Cada página de nodo muestra: breadcrumb del árbol, título del nodo, documentos ordenados (con ícono de tipo, periodo y fecha), leyenda si aplica y botón para compartir.
- SEO y tarjetas al compartir en cada app según la sección 10.
- Las apps de municipio **no tienen login** ni escriben en la base de datos: solo leen datos públicos con un **rol de Postgres de solo lectura** (`lector_publico`) que únicamente puede ver documentos publicados de su municipio (vistas o RLS).

**Niveles de personalización del diseño:**

| Nivel                 | Qué cambia                                                                                                                    | Cómo se hace                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Identidad**      | Colores, tipografía, escudo, logo de la administración, imágenes de portada (las redes sociales se gestionan aparte, ver 5.7) | Configuración guardada en la base de datos (editable desde el panel) que se convierte en variables CSS / tokens de Tailwind. Cambia sin redeploy |
| **2. Plantilla base** | Estructura completa (tipo de menú, portada, pie, estilo de tarjetas)                                                          | El generador crea la app a partir de una de las 3 plantillas base (`templates/`, ver 8.3)                                                        |
| **3. Secciones**      | Qué bloques lleva la portada y en qué orden (noticias, directorio, turismo, avisos, banners)                                  | Bloques reutilizables del paquete `@plataforma/ui-sitio`, configurables                                                                          |
| **4. A la medida**    | Diseño 100% único                                                                                                             | Se modifica libremente el código de esa app. Se cobra aparte                                                                                     |

- **Control de contraste automático:** si los colores elegidos no cumplen contraste mínimo de accesibilidad, el panel lo advierte y la transparencia usa una variante legible.
- **Cambio de administración:** cuando entra un partido nuevo, cambiar colores, logo y portada debe tomar minutos (niveles 1 y 3) sin tocar documentos ni enlaces.

### 5.6 Modo veda electoral (fase 2)

- Por las reglas de propaganda gubernamental (artículo 134 constitucional), en periodo de veda los sitios oficiales deben retirar propaganda. Las elecciones municipales de Jalisco son en junio de 2027.
- Un interruptor por municipio en el panel (con fecha de inicio y fin programables) que **oculta** banners, logos de la administración, noticias y bloques marcados como "propaganda", y deja intacta la información obligatoria y **toda la transparencia**.
- Cada bloque de contenido tiene un atributo `ocultar_en_veda`. Qué debe ocultarse exactamente lo validaremos con un especialista; el sistema solo debe permitirlo de forma configurable.
- El cambio se registra en la bitácora.

### 5.7 Redes sociales (autogestionadas por el municipio)

Cada municipio agrega **las redes sociales que tenga y necesite**, con sus propios enlaces, **sin pedírmelo a mí**.

**Quién las gestiona:** el **admin municipal** (y el superadmin). Capturistas y supervisor no, porque es configuración del municipio. Cada cambio queda en la **bitácora**.

**Funcionamiento en el panel (pantalla "Redes sociales"):**

- Lista de enlaces donde se puede **agregar, editar, reordenar (arrastrar), ocultar y eliminar**, sin límite fijo de cantidad.
- **Detección automática de la red:** la persona pega el enlace y el sistema reconoce la red por el dominio y pone su ícono (ej. pega `https://facebook.com/ayuntamientotuxcacuesco` → Facebook). También puede elegirla de una lista.
- **Catálogo de redes** mantenible en un solo lugar (paquete compartido): Facebook, Instagram, X, TikTok, YouTube, WhatsApp, Threads, Telegram, LinkedIn, Spotify, sitio web y **"Otra"** (ícono genérico de enlace + nombre que escriba el municipio). Agregar una red nueva al catálogo debe ser trivial.
- **WhatsApp:** permite escribir solo el número (10 dígitos) y el sistema genera el enlace `https://wa.me/52XXXXXXXXXX`, con un mensaje inicial opcional.
- **Texto opcional** por enlace (ej. "Facebook del DIF", "WhatsApp de Protección Civil"), por si tienen varias cuentas de la misma red.
- **Validación amable:** que el enlace sea válido y con `https`. Si el dominio no corresponde a la red elegida, advertir ("Este enlace no parece de Instagram, ¿es correcto?") sin bloquear. Botón **"Probar enlace"** que lo abre en otra pestaña.
- **Vista previa** de cómo se verán los íconos en su sitio antes de guardar.

**Por sujeto obligado:** el Ayuntamiento y el **DIF** (y cualquier otro sujeto obligado) pueden tener **redes distintas**. Las del DIF se muestran en su sección (`/dif`), y las del Ayuntamiento en el resto del sitio.

**Dónde se muestran en los sitios:**

- **Encabezado y/o pie de página** (según la plantilla) y la página de **contacto**, con íconos en el color del tema y texto accesible (`aria-label` "Facebook del H. Ayuntamiento de Tuxcacuesco").
- Abren en pestaña nueva con `rel="noopener noreferrer"`.
- **SEO:** se incluyen en el JSON-LD del municipio como `sameAs` (ayuda a que Google relacione el sitio con sus redes oficiales).
- Guardar cambios revalida el sitio del municipio al momento (ver 7.2).
- **Modo veda:** cada enlace tiene la opción "ocultar en veda", para el caso de cuentas que se usen para promoción (ver 5.6).

### 5.8 Tipos de archivo, íconos y videos

**Tipos permitidos** (lista configurable en un solo lugar del paquete compartido):

| Tipo       | Extensiones                           | Ícono / color sugerido         | Acción en el sitio               |
| ---------- | ------------------------------------- | ------------------------------ | -------------------------------- |
| PDF        | `.pdf`                                | Documento, rojo                | "Ver PDF" (abre en el navegador) |
| Word       | `.doc`, `.docx`                       | Documento, azul                | "Descargar Word"                 |
| Excel      | `.xls`, `.xlsx`, `.csv`               | Hoja de cálculo, verde         | "Descargar Excel"                |
| PowerPoint | `.ppt`, `.pptx`                       | Presentación, naranja          | "Descargar PowerPoint"           |
| Comprimido | `.zip`                                | Archivo comprimido, gris/ámbar | "Descargar ZIP"                  |
| Video      | `.mp4` (recomendado), `.webm`, `.mov` | Video, morado                  | "Ver video" (reproductor)        |
| Imagen     | `.jpg`, `.png`, `.webp`               | Imagen, verde azulado          | "Ver imagen"                     |

**Íconos en el sitio público y en el panel:**

- **Cada documento muestra al inicio un ícono del tipo de archivo**, para que la persona sepa qué va a abrir o descargar antes de hacer clic.
- Junto al nombre, una etiqueta pequeña con **tipo y tamaño** (ej. "PDF · 2.3 MB", "Video · 45 min"). Es información útil para quien tiene datos móviles limitados y además da accesibilidad (el ícono no es la única pista: el texto también lo dice).
- Los colores del ícono son **fijos por tipo** (no cambian con el tema del municipio), para que sean reconocibles en todos los sitios, y deben cumplir contraste.
- Íconos de una sola librería coherente (ej. los de Lucide que usa shadcn, o un set de íconos de archivo propio en SVG), centralizados en el paquete compartido.
- El tipo se determina por el **tipo real del archivo** detectado al subir (ver 9.3), guardado en la base de datos, no solo por la extensión del nombre.

**Videos (ej. grabaciones de sesiones de cabildo):**

- **Fase 1: videos en Cloudflare R2** y reproducción con el reproductor nativo del navegador (`<video>` con soporte de _range requests_, que R2 ya ofrece). Es la opción más simple y no cobra por reproducciones.
- Subida **multipart reanudable** directo a R2 (los videos pesan cientos de MB o varios GB). Límite de tamaño para videos configurable aparte de los documentos (ej. 2 GB) con un mensaje claro si se excede.
- **Formato:** MP4 (H.264/AAC) es el que reproducen todos los navegadores. Si suben `.mov` u otro formato que quizá no se reproduzca en todos los navegadores, el panel avisa de forma amable y recomienda MP4. El archivo se publica igual, con opción de descarga.
- **Miniatura (portada) del video:** generada **en el navegador al subir** (capturando un fotograma con `<canvas>`), sin costo de servidor, con opción de que la persona suba su propia portada. Se usa en la lista, en el reproductor y en la tarjeta al compartir.
- Se guarda la **duración** del video para mostrarla.
- **`/d/<id>` de un video** no redirige al archivo: muestra una **página con el reproductor**, el nombre, el periodo, el inciso al que pertenece y un botón "Descargar". Los documentos PDF y demás siguen redirigiendo al archivo como se definió en la sección 3.
- **Enlaces externos de video:** muchos municipios ya suben sus sesiones a YouTube o Facebook. Permite registrar un documento de tipo **"Video externo"** pegando la URL (YouTube/Facebook) en vez de subir el archivo; el sitio lo muestra incrustado. Tiene su ícono de video y aparece igual en la lista.
- **Fase 2/3 (solo si hace falta):** si los videos crecen en número o hay quejas de que se traban en conexiones lentas, migrar la reproducción a **Cloudflare Stream** (convierte el video a varias calidades y se adapta a la conexión). Tiene costo por minuto almacenado y reproducido, así que avísame con números antes de activarlo. Diseña el modelo de datos para que ese cambio no afecte a `/d/<id>`.

---

## 6. Índice de la ley y versiones (crítico)

**Situación legal (a octubre de 2026):**

- En marzo de 2025 se publicó una **nueva Ley General de Transparencia**. El INAI desapareció y sus funciones (incluida la Plataforma Nacional de Transparencia) pasaron a la Secretaría Anticorrupción y Buen Gobierno.
- En Jalisco desapareció el ITEI. En julio de 2026 el Congreso aprobó una **nueva Ley Estatal de Transparencia y Acceso a la Información de Jalisco**. La autoridad garante es la Contraloría del Estado, a través de una Agencia de Transparencia.
- La estructura de artículos, fracciones e incisos **probablemente cambió** respecto a la ley anterior (con la que está organizado Tuxcacuesco: artículo 8 "Información fundamental – General", artículo 15, armonización contable y artículo 8 del DIF).
- **Todavía no tengo el texto de la nueva ley.** Te lo daré después.

**Requisitos:**

1. El índice tiene **versiones**. Cada nodo pertenece a una versión. Cada documento queda ligado al nodo de la versión con la que se subió.
2. Al publicarse una nueva versión, los documentos viejos **siguen accesibles** bajo su versión (en el sitio público como "histórico" o con un selector de versión; propón la mejor UX).
3. Las claves cortas resuelven contra la **versión vigente**. Propón cómo acceder a nodos de versiones anteriores (ej. `/v1/85a` o similar) y cómo redirigir cuando exista una equivalencia conocida entre versiones (tabla opcional de equivalencias).
4. Para el piloto: la **versión 1** será la estructura de la ley anterior, extraída del sitio actual de Tuxcacuesco (ver 11), porque sus ~2,750 documentos están organizados así. La versión de la nueva ley se carga cuando tenga el texto.
5. El índice se carga desde un archivo estructurado (JSON o YAML en el repo, versionado en git) mediante un script de seed/migración con validaciones: claves únicas, jerarquía válida y periodicidad presente.
6. El índice es por **estado** (Jalisco ahora). Modela `estado` desde el inicio para no cerrar la puerta a otros estados, pero no construyas nada más para ellos.
7. Hay índices distintos por **tipo de sujeto obligado** (el del DIF no es idéntico al del Ayuntamiento). Modélalo.

---

## 7. Stack y arquitectura

### 7.1 Stack

| Capa                                | Tecnología                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo                            | **Turborepo + pnpm workspaces**                                                                                                                                                                           |
| Apps (panel y sitios de municipios) | **Next.js (App Router) + TypeScript**                                                                                                                                                                     |
| UI                                  | **Tailwind CSS + shadcn/ui**                                                                                                                                                                              |
| Base de datos                       | **Neon** (Postgres serverless). Ramas de base de datos para previews y pruebas. Restauración a un punto en el tiempo                                                                                      |
| ORM y migraciones                   | **Drizzle ORM + drizzle-kit** (migraciones versionadas en el repo; los triggers y políticas RLS van en migraciones SQL)                                                                                   |
| Autenticación                       | **Better Auth** con plugins de organizaciones, 2FA (TOTP) y admin. Sus tablas viven en la misma base de Neon                                                                                              |
| Archivos                            | **Cloudflare R2** (compatible con S3, sin cobro por descargas) con dominio propio para archivos (ej. `archivos.<plataforma>.mx`). Acceso vía SDK de S3 (`@aws-sdk/client-s3`) para no atarse al proveedor |
| Hosting                             | **Vercel Pro**: un proyecto de Vercel por app (panel + uno por municipio), todos conectados al mismo repo con su _root directory_. Cada proyecto con su dominio y SSL automático                          |
| Correos                             | **Resend** (invitaciones, recuperación, avisos, exportaciones listas)                                                                                                                                     |
| Monitoreo                           | **Sentry** (errores) + monitoreo de disponibilidad                                                                                                                                                        |
| Pruebas                             | **Vitest** (unitarias: claves, permisos, semáforo) + **Playwright** (punta a punta)                                                                                                                       |

No uses Angular. No uses un CMS genérico (Payload, Strapi): el panel es el producto y debe ser muy simple para personal no técnico.

### 7.2 Decisiones técnicas obligatorias

1. **Un municipio = una app:** cada app de municipio sabe qué municipio es por una variable de entorno (`MUNICIPIO_SLUG`). No hace falta resolver el tenant por `host`. Una sola base de datos Neon para todos.
2. **Subidas directas al bucket** con URLs firmadas (presigned) que genera el servidor tras validar permisos. Nunca pases archivos por las funciones de Vercel (límite de ~4.5 MB por request; los estados financieros pesan más).
3. **Validación de archivos:** solo los tipos permitidos de la sección 5.8 (configurables), con tamaño máximo configurable por tipo (documentos vs. videos). Valida el tipo en servidor, no solo por extensión.
4. **Caché del sitio público:** páginas estáticas/ISR con invalidación por etiqueta. Como el panel y los sitios son apps distintas, al crear, editar, reordenar o eliminar documentos el panel llama a un **endpoint de revalidación protegido** (con secreto compartido) en la app del municipio afectado, que ejecuta `revalidateTag`/`revalidatePath` solo para las páginas afectadas. El sitio público casi no debe pegarle a la base de datos. La URL de revalidación de cada app se guarda en la base de datos junto al municipio.
5. **Archivos ordenados en carpetas legibles** (ver 7.5). Las versiones anteriores nunca se borran.
6. **Bitácora por triggers** de Postgres y append-only (ver 5.3).
7. **Autorización en dos capas:** (a) capa central de permisos en el servidor del panel, basada en las membresías de Better Auth; (b) **RLS en Postgres** en las tablas con datos de municipios, usando los valores `app.usuario_id` / `app.municipios_permitidos` que fija el helper de transacción. Escribe pruebas que verifiquen que un usuario del municipio A no puede leer ni escribir nada del municipio B, y que un supervisor solo ve sus municipios asignados. Usa ramas de Neon para correr estas pruebas contra Postgres real.
8. **Seguridad de cuentas:** verificación en dos pasos (TOTP) obligatoria para superadmin, supervisor y admin municipal; opcional para capturistas. Baja de usuarios inmediata (revoca sesiones).
9. **Respaldos:** configurar la ventana de restauración de Neon según el plan y, adicionalmente, un respaldo lógico periódico (`pg_dump`) guardado en R2. Documenta cómo se restaura.
10. **Zona horaria:** guardar en UTC y mostrar en America/Mexico_City.
11. **Idioma:** toda la interfaz en español de México.

### 7.3 Estructura del monorepo

```
plataforma-transparencia/
├── apps/
│   ├── panel/                    → panel.<plataforma>.mx (superadmin, supervisor, municipios)
│   ├── sitio-tuxcacuesco/        → tuxcacuesco.gob.mx
│   ├── sitio-san-sebastian/      → (futuro) sansebastiandeloeste.gob.mx
│   └── sitio-mascota/            → (futuro) mascota.gob.mx
├── packages/
│   ├── db/                       → esquema Drizzle, migraciones, triggers/RLS en SQL, helper de transacción
│   ├── auth/                     → configuración de Better Auth (organizaciones, 2FA, admin) y permisos
│   ├── archivos/                 → cliente R2, generación de rutas (7.5), URLs firmadas, mover/copiar
│   ├── indice/                   → archivos del índice de la ley, generación y validación de claves
│   ├── transparencia/            → rutas, páginas y componentes públicos de transparencia
│   │                               (/85a, /85, /dif/85a, /dif, /d/<id>, redirecciones, revalidación)
│   ├── ui/                       → componentes shadcn compartidos (panel y sitios)
│   ├── ui-sitio/                 → bloques reutilizables para sitios (hero, noticias, directorio, footer...)
│   ├── tema/                     → tokens de diseño, carga de identidad desde la BD, validación de contraste
│   └── config/                   → TypeScript, ESLint, Tailwind compartidos
└── templates/
    ├── institucional-clasica/    → plantillas base desde las que se generan apps de municipio (ver 8.3)
    ├── moderna-minimalista/
    └── ciudadana-servicios/
```

**Reglas del monorepo:**

- **Toda la lógica de transparencia vive en `packages/`**, nunca copiada en las apps. Las apps de municipio solo "montan" las rutas del paquete (ej. un catch-all que delega en `@plataforma/transparencia`). Corregir un error o agregar una función a la transparencia se hace **una vez** y llega a todos los municipios.
- Las apps de municipio solo contienen lo que es propio de ese municipio: diseño, páginas institucionales y contenido.
- Al hacer push a `main`, Vercel + Turborepo reconstruyen **solo las apps afectadas** por los cambios (configura `turbo-ignore` o equivalente).
- Define y documenta qué rutas son **reservadas** por el paquete de transparencia para que ninguna app de municipio las pise.

### 7.4 Generador de apps de municipio

- Un comando (ej. `pnpm nuevo-municipio`, con `turbo gen` o un script propio) que:
  1. Pregunta el slug, nombre, plantilla base y dominio.
  2. Crea `apps/sitio-<slug>` a partir de la plantilla elegida, con la transparencia ya montada.
  3. Crea o actualiza el registro del municipio y sus sujetos obligados en la base de datos.
  4. Opcional (fase 2): crea el proyecto en Vercel y asigna el dominio vía API.
- Meta: de cero a un sitio de municipio funcionando (con su transparencia) en **minutos**.

### 7.5 Organización de archivos en R2

Quiero que los archivos estén **muy bien ordenados en carpetas** y sean fáciles de encontrar navegando el bucket (panel de Cloudflare, Cyberduck, rclone), no solo desde el panel. R2 no tiene carpetas reales, pero los prefijos con `/` se muestran como carpetas.

**Estructura de rutas:**

```
<municipio>/<sujeto-obligado>/<version-indice>/art-<NN>/fr-<NN>/inc-<x>/<periodo>/<nombre-slug>__<id-corto>.<ext>
```

Ejemplos:

```
tuxcacuesco/ayuntamiento/ley-2026/art-08/fr-05/inc-a/2026-03/estado-financiero-marzo-2026__k7x9q2.pdf
tuxcacuesco/dif/ley-2026/art-08/fr-01/inc-a/permanente/reglamento-interno-dif__p3m8z1.pdf
tuxcacuesco/ayuntamiento/ley-anterior/art-15/fr-11/sin-inciso/2024/acta-cabildo-12__a9c4d0.pdf
```

**Reglas:**

- Todo en minúsculas, sin acentos, sin espacios ni caracteres especiales (slug).
- Números con **ceros a la izquierda** (`fr-05`, `fr-12`) para que se ordenen bien alfabéticamente.
- Niveles que no aplican usan un valor fijo (`sin-inciso`, `permanente`).
- El **ID corto** del documento al final garantiza que no haya choques aunque dos documentos se llamen igual, y permite encontrar un archivo desde la base de datos y viceversa.
- **Versiones anteriores** (al reemplazar un archivo) se mueven a una subcarpeta `_versiones/` dentro de la misma carpeta, con sufijo `__v1`, `__v2`... para que la carpeta principal solo muestre el archivo vigente.
- **Renombrar** un documento o cambiar su periodo **mueve** el archivo a su nueva ruta (R2 no renombra: copiar + borrar, en segundo plano). Como el sitio público siempre usa `/d/<id>`, nada se rompe. La ruta actual se guarda en `documento_versiones`.
- **Papelera:** el archivo se queda en su lugar y el estado vive en la base de datos (no lo muevas, para poder restaurar sin efectos secundarios).
- La generación de rutas vive en **una sola función** del paquete `archivos`, con pruebas unitarias.
- El bucket es **privado**; los archivos se sirven a través de `/d/<id>` (redirección a URL firmada o al dominio público de archivos; propón la mejor opción considerando caché y costo).
- La **migración de Tuxcacuesco** copia los archivos actuales de DigitalOcean Spaces a esta estructura en R2.

### 7.6 Modelo de datos (orientativo, valídalo y mejóralo en tu plan)

- `estados` — Jalisco, etc.
- `indice_versiones` — estado, nombre (ej. "Ley anterior", "Ley 2026"), fecha de vigencia, estatus (borrador, vigente, histórica).
- `tipos_sujeto_obligado` — ayuntamiento, dif, agua, ...
- `indice_nodos` — versión, tipo de sujeto obligado, padre, nivel (artículo/fracción/inciso/...), número, texto oficial, **clave** (única por versión + tipo), periodicidad, orden.
- `indice_equivalencias` (opcional) — nodo de versión anterior → nodo de versión nueva.
- `municipios` — nombre, slug, estado, estatus (activo, panel suspendido), URL de revalidación de su app.
- `municipio_dominios` — municipio, host, principal sí/no.
- `municipio_tema` — colores, tipografía, escudo, logo de la administración, imágenes.
- `redes_sociales` — municipio, sujeto obligado, red (del catálogo u "otra"), URL, texto opcional, orden, visible, `ocultar_en_veda`.
- `municipio_veda` — activo sí/no, fecha inicio, fecha fin.
- `bloques_contenido` — municipio, tipo de bloque, orden, datos (JSON), `ocultar_en_veda`.
- `sujetos_obligados` — municipio, tipo, nombre visible, **prefijo de ruta** (vacío = raíz para el Ayuntamiento).
- Tablas de **Better Auth** (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `twoFactor`). La organización de Better Auth se relaciona 1:1 con `municipios`.
- `alcances_miembro` — restricción opcional de un miembro a ciertos sujetos obligados o nodos (complementa el rol de `member`).
- `documentos` — municipio, sujeto obligado, nodo, nombre visible, periodo, orden, estado (publicado, oculto, histórico, papelera), versión de archivo actual, creado por, fechas.
- `documento_versiones` — documento, número de versión, ruta actual en R2, nombre original del archivo, tipo MIME, **tipo de archivo** (pdf, word, excel, powerpoint, zip, video, imagen), tamaño, hash, duración (videos), ruta de la miniatura (videos), subido por, fecha.
- Los documentos de tipo **"video externo"** guardan la URL externa (YouTube/Facebook) en lugar de un archivo.
- `leyendas_sin_informacion` — municipio, sujeto obligado, nodo, periodo, texto, autor.
- `bitacora` — append-only: actor, rol, municipio, entidad, id, acción, cambios (JSON antes/después), fecha.
- `exportaciones` — municipio, solicitante, estado, URL del ZIP, fecha.

---

## 8. Facilidad de uso y diseño responsivo (crítico)

Muchas de las personas que van a usar el panel **no son diestras con la tecnología**: personal de ayuntamientos pequeños, a veces con computadoras viejas, conexiones lentas o solo un celular Android de gama baja. **Si el panel no es extremadamente fácil, me van a seguir mandando los archivos por WhatsApp y la plataforma fracasa.** La facilidad de uso es un requisito, no un detalle.

**Meta medible:** una persona que nunca ha usado la plataforma debe poder **subir su primer documento y copiar su enlace en menos de 2 minutos, sin ayuda**. Lo validaremos con personal real del municipio piloto.

### 8.1 Principios del panel

- **El flujo principal en 3 pasos:** (1) ¿dónde va? → (2) arrastrar o elegir el archivo → (3) confirmar el nombre. Todo lo demás es secundario.
- **Encontrar el lugar correcto sin conocer la ley de memoria:** buscador del árbol por clave (`85a`) **o por palabras** ("estados financieros", "actas de cabildo"), más una sección de **"Recientes"** y otra de **"Lo que te falta subir"** (pendientes del semáforo) en la pantalla de inicio.
- **Nombre sugerido automáticamente:** a partir del nombre del archivo, limpio (sin guiones bajos, sin extensión, con mayúsculas correctas) y, si se puede detectar, con el periodo sugerido. La persona solo confirma o corrige.
- **Lenguaje simple, sin jerga técnica.** Nada de "slug", "nodo", "bucket", "tenant", "revalidar". Di "Subir documento", "Copiar enlace", "Mandar a la papelera".
- **Botones con texto, no solo íconos.** Ícono + palabra.
- **Mensajes de error que dicen qué hacer:** no "Error 413", sino "Este archivo pesa 60 MB y el máximo es 50 MB. Intenta comprimirlo o dividirlo".
- **Deshacer en lugar de confirmar:** tras eliminar o mover, mostrar un aviso con botón **"Deshacer"** durante unos segundos. Pedir confirmación explícita solo en acciones realmente delicadas.
- **Progreso visible en las subidas,** con porcentaje, y **reintentos automáticos** en conexiones lentas. Usa subida _multipart_ reanudable para archivos grandes.
- **Cada pantalla tiene sus 4 estados diseñados:** vacío (con instrucción de qué hacer), cargando, error y éxito.
- **"Copiar enlace" siempre a la vista** y con confirmación clara ("¡Enlace copiado!").
- **Letra grande y áreas de clic grandes** (mínimo 44×44 px), buen contraste y uso completo con teclado.
- **Primera vez:** un recorrido corto opcional (3–4 pasos) y un botón **"¿Cómo se hace?"** en cada pantalla con un video corto o una guía con imágenes.
- **Nada de pantallas sobrecargadas:** las opciones avanzadas (reordenar, versiones, historial) se muestran solo cuando se necesitan.

### 8.2 Diseño responsivo

- **Todo funciona en celular, tablet y computadora,** tanto el panel como los sitios de los municipios. Los sitios públicos se diseñan **mobile-first** (la mayoría de los ciudadanos entra desde el celular, muchas veces desde un enlace de WhatsApp o Facebook).
- **El panel debe permitir subir documentos desde el celular** (elegir un PDF del teléfono y subirlo).
- Las tablas del panel (documentos, bitácora, tablero del supervisor) se convierten en **tarjetas** en pantallas pequeñas; nada de scroll horizontal.
- **Rendimiento en equipos modestos:** sitios públicos con Lighthouse ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en móvil. Core Web Vitals en verde. Imágenes optimizadas (`next/image`), fuentes optimizadas y el mínimo de JavaScript en el cliente.
- **Accesibilidad WCAG 2.2 nivel AA** en el panel y los sitios: HTML semántico, etiquetas en formularios, foco visible, textos alternativos, `lang="es-MX"`.
- **Pruebas:** Playwright corre los flujos principales en viewports de **celular, tablet y escritorio**, e incluye revisiones automáticas de accesibilidad (axe).

### 8.3 Apariencia visual (look & feel)

**Panel de administración:**

- **Toma los colores del municipio en el que se está trabajando** (color de acento en botones, encabezado, elementos activos y escudo del municipio visible), para que cada municipio sienta el panel como "suyo".
- La **base es neutra y limpia** (fondos blancos o grises, tipografía clara, mucho aire) y el color del municipio se usa solo como **acento**. Así ningún color de partido vuelve el panel ilegible o cansado.
- **Control de contraste obligatorio:** si el color del municipio no cumple contraste con texto blanco o negro, se calcula automáticamente una variante legible (más oscura o más clara) para botones y textos. Nunca se sacrifica la legibilidad por el color.
- En las vistas **globales** (superadmin, tablero del supervisor con varios municipios, selector de municipio, inicio de sesión) se usa el **color propio de la plataforma**.
- Al cambiar de municipio en el selector, el acento cambia de inmediato. Esto también ayuda al supervisor a no confundirse de municipio al subir documentos.
- **Modo claro y oscuro** en el panel, según la preferencia del sistema y con un interruptor manual. El color del municipio necesita su variante para modo oscuro, también validada en contraste.

**Marca de la plataforma:**

- El **panel lleva la marca de la plataforma**: nombre y logo en la pantalla de inicio de sesión, en el encabezado (junto al escudo del municipio activo) y en los correos (invitaciones, avisos).
- Los **sitios de los municipios son discretos**: solo un pequeño "Desarrollado por <plataforma>" con enlace en el pie de página. El protagonista siempre es el gobierno.
- El nombre y logo de la plataforma son configurables (todavía no están definidos; usa un placeholder).

**Sitios de los municipios:**

- **Solo modo claro.**
- **Tres plantillas base** (`templates/`):
  1. **Institucional clásica:** formal y ordenada, escudo protagonista, menú completo, mucha información a la vista. Es la que esperan los gobiernos tradicionales. **Es la del MVP (Tuxcacuesco).**
  2. **Moderna y minimalista:** mucho espacio en blanco, tipografía grande, pocas secciones en portada. Se ve actual y rápida.
  3. **Ciudadana / de servicios:** portada centrada en trámites, teléfonos, avisos y "¿qué necesitas hacer hoy?". Muy práctica.
- Las tres comparten los mismos bloques del paquete `ui-sitio` y la misma sección de transparencia; cambia la composición y el estilo, no la funcionalidad.
- Calidad visual de nivel profesional: es lo primero que ve el presidente municipal al que le estoy vendiendo. Nada de aspecto "plantilla genérica de Bootstrap".

---

## 9. Ciberseguridad (crítico)

Los sitios de gobierno son blanco frecuente de ataques (desfiguración del sitio, robo de cuentas, archivos maliciosos). Un incidente en un municipio daña mi reputación con todos. El objetivo es **reducir al mínimo la superficie de ataque** y, si algo pasa, **detectarlo rápido y poder revertirlo**.

### 9.1 Cuentas y acceso

- **Verificación en dos pasos obligatoria** para superadmin, supervisor y admin municipal (recomendada para capturistas).
- **Contraseñas:** longitud mínima de 12 caracteres y rechazo de contraseñas filtradas (plugin `haveIBeenPwned` de Better Auth o equivalente).
- **Límite de intentos de inicio de sesión** con bloqueo progresivo y aviso por correo al usuario cuando haya intentos fallidos repetidos o un inicio de sesión desde un dispositivo nuevo.
- **Sesiones** con expiración razonable en el panel y **revocación inmediata** al dar de baja a un usuario o cambiar su contraseña.
- **Una cuenta por persona.** Nada de cuentas compartidas ("transparencia@municipio"): la bitácora pierde sentido.
- **Principio de mínimo privilegio** en todo: roles de Postgres separados (`app_panel`, `lector_publico`, `migraciones`), tokens de R2 limitados al bucket y a los permisos necesarios, y las apps de municipio sin credenciales de escritura.

### 9.2 Aplicación

- **Denegar por defecto:** toda acción del panel verifica permisos en el servidor; si no está explícitamente permitida, se rechaza.
- **Validación de toda entrada** con Zod en el servidor. Nunca concatenar SQL; todo vía Drizzle con consultas parametrizadas.
- **IDs no adivinables** (UUID o nanoid) en todo lo expuesto, incluido `/d/<id>`. Nada de IDs secuenciales.
- **Protección CSRF** y cookies `HttpOnly`, `Secure`, `SameSite`.
- **Cabeceras de seguridad** en todas las apps: Content-Security-Policy estricta, HSTS, `frame-ancestors 'none'` (o equivalente), `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`.
- **Límites de uso (rate limiting)** en inicio de sesión, invitaciones, generación de URLs firmadas y endpoints del panel. Vercel Firewall/WAF para mitigar abuso y DDoS en las apps, y Cloudflare delante del dominio de archivos.
- **Endpoint de revalidación** protegido con secreto y comparación en tiempo constante.
- **Sin información sensible en errores** mostrados al usuario; el detalle va a Sentry.

### 9.3 Archivos subidos

- **Validar el tipo real** del archivo (firma de bytes / _magic bytes_), no solo la extensión ni el `Content-Type` que manda el navegador.
- **Tamaño máximo** configurable por tipo y aplicado también en la URL firmada.
- Los **ZIP** no se descomprimen ni se procesan en el servidor (se sirven tal cual, como descarga). Quedan incluidos en el escaneo antivirus de fase 2.
- **Nombre del archivo saneado** (el original solo se guarda como metadato).
- Servir los archivos desde un **dominio separado** (ej. `archivos.<plataforma>.mx`), nunca desde el dominio del panel, con `Content-Type` correcto y `Content-Disposition` adecuado, para evitar ataques de contenido.
- Fase 2: **escaneo antivirus** de archivos subidos (ej. ClamAV en un proceso aparte) antes de publicarlos.

### 9.4 Detección y recuperación

- **Alertas automáticas al superadmin** ante comportamientos anómalos: muchas eliminaciones o reemplazos en poco tiempo (ej. más de 20 en 10 minutos, umbral configurable), muchos inicios de sesión fallidos, accesos desde ubicaciones inusuales. Una cuenta robada se nota así.
- **Nada se borra de verdad** (papelera + versiones + bitácora inmutable): cualquier daño se puede revertir.
- **Respaldos probados:** documenta y ensaya al menos una restauración completa (base de datos + archivos) antes del lanzamiento.
- **Monitoreo** con Sentry y de disponibilidad de cada sitio.

### 9.5 Mantenimiento y buenas prácticas

- **Secretos** solo en variables de entorno (nunca en el repo), con `.env.example` documentado. Plan de rotación.
- **Dependencias:** Renovate o Dependabot, `pnpm audit` en CI y lockfile siempre comprometido.
- **Revisión de seguridad antes de lanzar** contra el **OWASP Top 10** (entrégame un checklist con el estado de cada punto).
- Archivo **`/.well-known/security.txt`** en cada sitio con un correo de contacto para reportar vulnerabilidades.
- Cuando controle los dominios: **DNSSEC** y registros **CAA**.
- **Datos personales mínimos** de los usuarios del panel (nombre, correo, cargo). Aviso de privacidad de la plataforma.

---

## 10. SEO

Los ciudadanos buscan en Google cosas como "transparencia Tuxcacuesco", "presidente municipal de Tuxcacuesco" o "teléfono del registro civil Tuxcacuesco". Los sitios de los municipios deben aparecer primero en esas búsquedas. Además, los enlaces se comparten mucho por **WhatsApp y Facebook**, así que la vista previa al compartir importa tanto como Google.

### 10.1 Técnico (en el paquete compartido, para todas las apps de municipio)

- **HTML renderizado en servidor o estático** (nada que dependa de JavaScript del cliente para mostrar contenido).
- **Metadatos por página** generados automáticamente con la API de metadata de Next.js:
  - Título con patrón claro, ej.: `Art. 8, fracc. V, inciso a — Transparencia | H. Ayuntamiento de Tuxcacuesco`.
  - Descripción a partir del texto oficial del inciso.
- **URLs canónicas:** la canónica es `/85a`; todas las variantes (`/85A`, `/8.5a`, `/8-5-a`) redirigen con **301** y la página declara `<link rel="canonical">`.
- **`sitemap.xml` dinámico por app**, generado desde la base de datos con todas las páginas institucionales y todos los nodos de transparencia (con `lastmod` según el último documento).
- **`robots.txt`** por app. El **panel** completo con `noindex` y bloqueado en su `robots.txt`.
- **Datos estructurados (JSON-LD):** `GovernmentOrganization` para el ayuntamiento (nombre, dirección, teléfono, logo y redes sociales como `sameAs`), `BreadcrumbList` en las páginas de transparencia y `WebSite`.
- **Tarjetas al compartir (Open Graph):** ver 10.3.
- **PDFs:** el `Content-Disposition` usa un nombre de archivo legible. Las versiones anteriores y documentos en papelera o históricos se sirven con `X-Robots-Tag: noindex`.
- **Encabezados semánticos** (un solo `h1` por página, jerarquía correcta), `lang="es-MX"`.
- **Página 404 útil,** con buscador y enlaces a las secciones principales (y sugerencia de clave si escribieron algo parecido, ej. `/85` → "¿Buscabas 8.5a?").
- **Rendimiento** (ver 8.2): Google lo toma en cuenta.

### 10.2 Contenido y operación

- Cada app de municipio debe tener páginas institucionales con **contenido real y útil** (directorio con cargos y teléfonos, trámites, ubicación, horarios). Es lo que la gente busca.
- **Checklist al dar de alta un municipio** (documentado en el README, fuera de la app): verificar el dominio en **Google Search Console**, enviar el sitemap, revisar o crear el **Perfil de Negocio de Google** del ayuntamiento y probar la vista previa en WhatsApp.

### 10.3 Tarjetas elegantes al compartir (WhatsApp, Facebook, X, Telegram...)

Cuando alguien comparta **cualquier** enlace de la plataforma (una página del sitio, un inciso como `/85a` o un documento `/d/<id>`), debe aparecer una **tarjeta de vista previa elegante y profesional**, con la identidad del municipio. Es la cara de la plataforma en los grupos de WhatsApp y en Facebook, y es parte de la venta.

**Contenido de la tarjeta:**

| Elemento                       | Página de inciso (`/85a`)                                          | Documento (`/d/<id>`)                                                                         | Páginas institucionales               |
| ------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| Título (`og:title`)            | "Art. 8, fracc. V, inciso a — Transparencia"                       | Nombre visible del documento                                                                  | Título de la página                   |
| Descripción (`og:description`) | Texto oficial del inciso (recortado) + "N documentos"              | "Documento de transparencia · Art. 8, fracc. V, inciso a · Periodo · Publicado el dd/mm/aaaa" | Resumen de la página                  |
| Sitio (`og:site_name`)         | "H. Ayuntamiento de Tuxcacuesco" (o DIF, según el sujeto obligado) | Igual                                                                                         | Igual                                 |
| Imagen                         | Generada (ver abajo)                                               | Generada (ver abajo)                                                                          | Generada o imagen propia de la página |

**Imagen de la tarjeta (generada automáticamente con `next/og`):**

- Tamaño **1200×630**, diseño cuidado, con: **escudo** del municipio, **nombre** del municipio, **colores del tema** del municipio (ver 5.5), el **título** (documento o inciso), la **clave** visible (ej. "8.5a"), el **periodo** si aplica y el ícono del tipo de archivo (ver 5.8) en las de documento. En los **videos**, la tarjeta usa la **miniatura del video** con un ícono de "reproducir" encima.
- **Una plantilla de diseño compartida** en el paquete `@plataforma/transparencia` (o `tema`), que se adapta a los colores de cada municipio y respeta el contraste (si un color no se lee, usa la variante legible).
- **Peso ligero** (idealmente < 300 KB; WhatsApp ignora imágenes pesadas), formato PNG o JPG, URL absoluta con HTTPS.
- La URL de la imagen incluye una **versión** (ej. hash de título + tema) para que, si cambia el nombre del documento o los colores del municipio, la tarjeta se regenere y no se quede la vieja en caché. Las imágenes se sirven con caché larga (`immutable`).
- Si un municipio cambia su identidad (cambio de administración), todas sus tarjetas se ven con el nuevo diseño sin hacer nada.

**El caso de los documentos (`/d/<id>`):**

- `/d/<id>` normalmente **redirige al PDF**, y un PDF no genera tarjeta. Solución: si quien pide `/d/<id>` es el **robot de vista previa** de una red social o mensajería (WhatsApp, `facebookexternalhit`, Facebot, Twitterbot, TelegramBot, LinkedInBot, Slackbot, Discordbot; lista mantenible en un solo lugar), se responde una **página HTML ligera con las etiquetas Open Graph** del documento. A las personas se les sigue redirigiendo al archivo como siempre.
- **No** se trata distinto a Googlebot ni a otros buscadores (eso sería _cloaking_ y penaliza el SEO). Solo los robots de vista previa.
- Propón en el plan si conviene, además, una página pública del documento (con vista previa, datos y botón "Descargar") a la que lleguen las personas en vez de ir directo al PDF, y sus pros y contras para los enlaces pegados en la Plataforma Nacional de Transparencia.

**Etiquetas obligatorias en todas las páginas:** `og:title`, `og:description`, `og:image` (con `og:image:width`, `og:image:height` y `og:image:alt`), `og:url` (canónica), `og:type`, `og:site_name`, `og:locale` = `es_MX`, `twitter:card` = `summary_large_image`.

**Pruebas:**

- Pruebas automáticas (Playwright) que verifican que las páginas de inciso, documento e institucionales tienen todas las etiquetas, que la imagen responde 200 y que pesa menos del límite, y que `/d/<id>` responde HTML a un _user-agent_ de WhatsApp y redirige a un navegador normal.
- Checklist manual al dar de alta un municipio: probar un enlace en WhatsApp real y en el depurador de Facebook (Sharing Debugger).

---

## 11. Migración del piloto: Tuxcacuesco

- Repo actual (Angular 13, **solo lectura, no se modifica**): `/Users/brangarciaramos/Proyectos/imSoft/sitios-web/Municipios/Tuxcacuesco/Tuxcacuesco`
- Componentes con los enlaces:
  - `src/app/pages/transparencia/articulo-ocho/articulo-ocho.component.html` (~2,163 enlaces)
  - `src/app/pages/transparencia/articulo-quince/articulo-quince.component.html` (~206)
  - `src/app/pages/transparencia/armonizacion-contable/armonizacion-contable.component.html` (~97)
  - `src/app/pages/transparencia-dif/articulo-ocho-dif/articulo-ocho-dif.component.html` (~281)
  - Subpáginas de estados financieros 2020–2024 en `src/app/pages/transparencia/articulo-ocho/estados-financieros-*`
- Estructura del HTML: acordeones de Bootstrap anidados con ids regulares (ej. `articuloOchoFraccionUno`, `articuloOchoFraccionUnoIncisoA`). Cada `<a href>` apunta a un PDF y su texto (pasado por el pipe `titlecase`) es el nombre visible actual.
- Los archivos están en DigitalOcean Spaces, bucket `documentos-transparencia`, región `sfo3`, con rutas tipo `Tuxcacuesco/art. 8/Fracc. I/a)/<archivo>.pdf`. Hay URLs mezcladas con y sin CDN (`sfo3.cdn.digitaloceanspaces.com` y `sfo3.digitaloceanspaces.com`).
- Algunos nombres tienen caracteres rotos por codificación (ej. "Informaciขn Pฃblica").

**Script de migración (herramienta reutilizable, no un one-off):**

1. Parsear el HTML y extraer, por cada enlace: ruta en el árbol (artículo, fracción, inciso, sub-niveles), texto visible y URL.
2. Generar con eso la **versión 1 del índice** (ley anterior) para Ayuntamiento y DIF.
3. Crear los documentos ligados a sus nodos y **copiar** cada archivo de DigitalOcean Spaces a Cloudflare R2 con la estructura de carpetas de 7.5. Spaces no se borra hasta validar la migración completa.
4. Normalizar las URLs (con y sin CDN) y **reportar** enlaces rotos (HEAD request) y nombres con caracteres sospechosos para revisión manual.
5. Ser idempotente (se puede correr varias veces sin duplicar).

**Importación masiva general (para municipios nuevos):**

- Desde **Excel/CSV** con columnas (sujeto obligado, clave, nombre visible, periodo, URL o ruta de archivo).
- Desde un **ZIP** organizado por carpetas que correspondan a las claves.
- Con vista previa y reporte de errores antes de confirmar.

---

## 12. Alcance por fases

### Fase 1 — MVP (lo único necesario para cobrarle al segundo municipio)

- Monorepo (Turborepo) con `apps/panel`, `apps/sitio-tuxcacuesco` y los paquetes compartidos.
- Panel central con login por invitación y 2FA.
- Plantilla base **Institucional clásica** + identidad por municipio (nivel 1) + generador de apps de municipio (sin la parte de Vercel por API).
- Panel con acento de color del municipio, control de contraste y modo claro/oscuro (ver 8.3).
- Redes sociales autogestionadas por el admin municipal (ver 5.7).
- Todos los tipos de archivo con su ícono, videos en R2 con reproductor, miniatura y página propia, y videos externos de YouTube/Facebook (ver 5.8).
- Roles con Better Auth: superadmin, supervisor, admin municipal, capturista; permisos en servidor + RLS.
- Índice versionado + carga desde archivo + validación de claves.
- Panel: árbol, subir (directo a R2, en carpetas ordenadas), renombrar, periodo, reordenar, reemplazar, ocultar, papelera/restaurar, leyenda "sin información", copiar enlace.
- Bitácora append-only por triggers + historial por documento.
- Sitio público: `/85a`, `/85`, artículo completo, `/dif/85a`, `/dif`, `/d/<id>`, variantes y redirecciones.
- Caché con invalidación por etiqueta.
- Migración de Tuxcacuesco.
- Exportación completa por municipio.
- Pruebas: Vitest (claves, permisos, semáforo) + Playwright (flujo subir → copiar enlace → ver página pública) en celular, tablet y escritorio, con revisión de accesibilidad.
- Facilidad de uso según la sección 8 (flujo en 3 pasos, buscador del árbol, nombre sugerido, deshacer, progreso de subida).
- Seguridad de las secciones 9.1, 9.2, 9.3 (excepto antivirus) y 9.4, más el checklist OWASP antes de lanzar.
- SEO técnico de la sección 10.1 y tarjetas al compartir de la sección 10.3 en el paquete compartido.

### Fase 2 — Para escalar

- Tablero del supervisor con semáforo y reportes exportables.
- Bitácora por municipio y por usuario con filtros.
- Importación masiva por Excel/CSV y ZIP.
- Generador completo: crea también el proyecto de Vercel y asigna el dominio por API.
- Plantillas **Moderna y minimalista** y **Ciudadana / de servicios**, y bloques de portada configurables (niveles 2 y 3).
- Modo veda electoral (antes de la veda de 2027).
- Escaneo antivirus de archivos subidos.
- Evaluar Cloudflare Stream para videos si el uso lo justifica (ver 5.8).
- Recorrido de primera vez, videos cortos y guía de ayuda dentro del panel.
- Suspensión del panel por falta de pago, sin tocar el sitio público.

### Fase 3 — Después (no construir ahora)

- Exportar enlaces organizados por formato para la Plataforma Nacional de Transparencia.
- Buscador público y estadísticas de descargas.
- Correo semanal automático de pendientes a cada admin municipal.
- Editor de páginas institucionales desde el panel (hoy el contenido institucional se edita en el código de cada app o en bloques).
- Otros estados.

---

## 13. Fuera de alcance (por ahora)

- Registro público o autoservicio de municipios.
- Pagos en línea dentro de la plataforma (la cobranza es por factura, fuera del sistema).
- Revisar el contenido de los documentos: el **municipio es responsable** de lo que publica (versiones públicas, datos personales testados). La plataforma solo es la herramienta.
- App móvil.

---

## 14. Pendientes conocidos (no bloquean el inicio)

- **DNS de los dominios `.gob.mx`:** hoy los controla un tercero; estoy en proceso de obtenerlos. Desarrolla en local (cada app en su puerto) y con los dominios de prueba de Vercel. Conectar el dominio real será solo configuración del proyecto de Vercel.
- **Texto de la nueva Ley Estatal de Transparencia de Jalisco (2026):** lo conseguiré con el supervisor. Hasta entonces, solo existe la versión 1 del índice (la ley anterior, desde la migración).
- **Nombre y dominio de la plataforma:** por definir. Usa un placeholder en configuración (`NEXT_PUBLIC_PLATFORM_NAME`, `PANEL_DOMAIN`).

---

## 15. Cómo trabajo (convenciones)

- **Gestor de paquetes: solo pnpm.** Nada de npm, Yarn ni Bun, ni para instalar, ni para correr scripts, ni en ejemplos, README o CI (usa `pnpm`, `pnpm dlx` en lugar de `npx`, y `pnpm --filter` para apps y paquetes). Para garantizarlo:
  - Campo `packageManager` con la versión de pnpm en el `package.json` raíz (Corepack).
  - Script `preinstall` con `npx only-allow pnpm` para bloquear instalaciones con otros gestores.
  - Solo existe `pnpm-lock.yaml`. Nunca se crean ni se suben `package-lock.json`, `yarn.lock` ni `bun.lockb` (agrégalos al `.gitignore`).
  - `engines` en el `package.json` raíz con las versiones mínimas de Node y pnpm.
  - Vercel y el CI instalan con pnpm (`pnpm install --frozen-lockfile`).
- **Versiones: siempre la última versión estable de todo** al momento de crear el proyecto (Node LTS activo, pnpm, Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Turborepo, Drizzle, Better Auth, Zod, Vitest, Playwright, SDK de S3, etc.). Reglas:
  - **No te fíes de tu memoria para las versiones:** verifica la versión actual de cada paquete con `pnpm view <paquete> version` y revisa su documentación oficial y guía de instalación vigente antes de configurarlo. Si tu conocimiento y la documentación no coinciden, manda la documentación.
  - Solo versiones **estables**: nada de canary, beta, rc ni experimental, salvo que te lo autorice.
  - **Nada de APIs ni patrones obsoletos o en desuso:** usa las formas actuales recomendadas por cada herramienta (ej. App Router y Server Components en Next.js, nada de Pages Router; la configuración vigente de Tailwind, ESLint y TypeScript; los comandos actuales de shadcn/ui). Si una librería está abandonada o deprecada, propón su reemplazo moderno.
  - TypeScript en modo `strict` y ESM en todo el monorepo.
  - Al presentar el plan, incluye una tabla con **cada dependencia principal y la versión exacta** que vas a usar.
  - Mantenimiento: Renovate o Dependabot mantienen las dependencias al día después del arranque (ver 9.5).
- Commits directos a `main`. Sin ramas por feature ni PRs.
- **Las pruebas son parte del entregable:** cada funcionalidad viene con sus pruebas.
- Entrégame el código listo, sin explicar lo evidente. Guarda las palabras para decisiones de arquitectura con trade-offs reales, riesgos de seguridad o de costo, o cosas que puedan romper otra parte del sistema.
- Migraciones de base de datos versionadas en el repo (drizzle-kit + SQL para triggers y RLS). Nada de cambios manuales en la consola de Neon.
- Variables de entorno documentadas en `.env.example`.
- **Desarrollo local 100% con Docker, sin cuentas en la nube.** Todavía no tengo creadas las cuentas de Neon, Cloudflare, Vercel ni Resend; quiero poder construir y probar todo el MVP mientras las creo. Un `docker-compose.yml` en la raíz que levante:
  - **Postgres** (misma versión mayor que use Neon) en lugar de Neon.
  - **MinIO** (compatible con S3) en lugar de Cloudflare R2, con el bucket creado automáticamente al iniciar.
  - **Mailpit** en lugar de Resend, para ver los correos de invitación y recuperación en el navegador.
  - Todo se cambia de local a producción **solo con variables de entorno** (`.env.local` vs. variables de Vercel). El cliente de base de datos funciona con Postgres normal en local y con el driver de Neon en producción, detrás de una sola interfaz en `packages/db`. El cliente de archivos usa el SDK de S3, que sirve igual para MinIO y R2.
  - Un comando de arranque (ej. `pnpm setup`) que levante Docker, corra migraciones, cargue el índice de prueba y cree datos semilla: Tuxcacuesco de ejemplo, un usuario de cada rol y algunos documentos de muestra.
  - Las pruebas (Vitest y Playwright) corren contra este entorno de Docker, y el CI usa el mismo `docker-compose`.
  - Las apps (panel y sitios) corren con `pnpm dev` fuera de Docker (cada una en su puerto); Docker solo es para los servicios. En producción no se usa Docker: las apps van en Vercel.
- Un `README.md` con cómo levantar el proyecto en local (Docker + `pnpm setup` + `pnpm dev`), cómo pasar a producción (qué cuentas crear y qué variables configurar) y un `CLAUDE.md` con las convenciones del proyecto.
- Costo de infraestructura objetivo: ~40–50 USD/mes (Vercel Pro + Neon + Cloudflare R2; Better Auth es una librería sin costo). Vercel Pro cobra por miembro del equipo, no por proyecto, así que tener un proyecto por municipio no debería multiplicar el costo base; verifica los límites vigentes del plan (proyectos, dominios, minutos de build) y avísame si algo cambia ese supuesto. Avísame antes de agregar cualquier servicio con costo.

---

## 16. Primer entregable que espero de ti

1. Plan por fases con estimación aproximada de esfuerzo por bloque, y la tabla de dependencias principales con su versión estable actual verificada (ver sección 15).
2. Esquema de base de datos (tablas Drizzle, relaciones, índices, políticas RLS principales, triggers de bitácora, helper de transacción) y cómo se integra con las tablas de Better Auth.
3. Estructura del monorepo (apps, paquetes, plantillas) y qué va en cada uno.
4. Diseño de rutas (públicas y del panel), incluido cómo el paquete de transparencia se monta en cada app de municipio y resuelve sujeto obligado (prefijo) y clave.
5. Cómo funcionan el sistema de temas (identidad desde la BD → tokens CSS) y el generador de apps de municipio.
6. Cómo el panel invalida la caché de la app del municipio afectado.
7. Formato del archivo del índice (JSON/YAML) con un ejemplo pequeño.
8. Wireframes en texto (o descripción pantalla por pantalla) del flujo principal del panel: inicio → encontrar el lugar → subir → confirmar nombre → copiar enlace, en celular y escritorio.
9. Plan de seguridad: cómo cubres cada punto de la sección 9 y en qué fase.
10. Diseño propuesto (descrito) de la imagen de las tarjetas al compartir y cómo resuelves el caso de `/d/<id>`.
11. Riesgos o dudas que veas en este documento.

No escribas código hasta que apruebe el plan.
