# Entregable 11 — Riesgos y dudas del brief

Ordenados por impacto. Los que necesitan tu respuesta llevan ❓; los demás los resuelvo con el supuesto indicado.

1. ❓ **Calendario.** El MVP completo (~97 días) no cabe en media semana hasta febrero 2027. Supuesto: MVP recortado (~60 días) según el entregable 1, con los bloques pospuestos a una Fase 1.5 antes del segundo municipio. Confirma o dime con cuántos días por semana cuento.

2. ❓ **Armonización contable (y cualquier sección sin artículo).** Tuxcacuesco publica "Armonización contable" como sección aparte, y la regla dice que toda clave empieza con número. Supuesto: `indice_nodos.ruta_slug` para nodos raíz sin numeración legal (`/armonizacion-contable`, `/dif/armonizacion-contable`), tratado como palabra reservada. Sus hijos usan claves numéricas normales si las tienen, o `armonizacion-contable/<n>` si no. Dime si prefieres mapearla a un artículo real de la ley.

3. **Enlaces viejos de Tuxcacuesco en la PNT.** Hoy los formatos oficiales apuntan a `*.digitaloceanspaces.com/...`. Al migrar, esos enlaces siguen vivos mientras exista el bucket de Spaces; si lo borras, se rompen y no podemos redirigirlos (no es nuestro dominio). Supuesto: Spaces se queda ≥ 1 año y el script de migración produce un CSV "URL vieja → `/d/<id>`" para que el municipio actualice la PNT cuando le toque. También redirijo las rutas del sitio Angular (`/transparencia/articulo-8` → `/articulo-8`, etc.) desde la app nueva.

4. **Better Auth escribe fuera del helper de transacción.** Resuelto en el entregable 2 (trigger permisivo en `member`/`invitation` con actor derivado; cambios de rol y bajas se hacen por Drizzle dentro de `withUser`). Riesgo residual: una versión futura de Better Auth podría cambiar columnas; Renovate + pruebas lo detectan.

5. **TypeScript 7 vs tooling.** `typescript-eslint` aún no soporta TS 7. Supuesto: TS 6.0.3 ahora; cambio cuando el peer lo permita (es un cambio de una línea).

6. **Next 16 Cache Components.** Es el modelo de caché actual (`'use cache'`, `cacheTag`); es reciente y la documentación cambia. Si en la práctica da problemas con rutas dinámicas, el plan B es `unstable_cache` + `revalidateTag`, misma arquitectura de etiquetas.

7. **Transacciones con Neon.** El driver HTTP no soporta `SET LOCAL`; el panel debe usar el Pool por WebSocket. En Vercel funciona pero cada invocación abre conexión; con Fluid Compute y pooling de Neon es aceptable para este volumen. Lo mido en el piloto.

8. **Archivos de documentos en papelera siguen descargables si alguien guardó la URL directa** (el brief pide no moverlos). `/d/<id>` sí muestra la página de retirado. Si quieres que desaparezcan de verdad, en Fase 2 se mueven a `_papelera/` con restauración por copia inversa; lo dejo como opción, no lo asumo.

9. **MinIO vs R2 en multipart y CORS.** La subida directa desde el navegador necesita CORS en el bucket; en R2 se configura en el panel de Cloudflare, en MinIO lo hace el contenedor de inicialización. Las firmas V4 funcionan igual en ambos; lo cubren las pruebas E2E en local y un check manual en R2 al crear la cuenta.

10. **Ambigüedad teórica de claves** (`151b` = art. 15 fr. I inc. b o art. 1 fr. 51 inc. b). No afecta en runtime porque la clave se busca tal cual, pero si la ley nueva tiene artículos de 1 dígito con fracciones de 2 dígitos y artículos de 2 dígitos, la carga de la versión fallará por duplicado y habrá que definir una regla de desempate (ej. separador solo en ese caso). Lo sabremos al cargar la ley 2026.

11. **Periodicidad y "días de gracia" son contenido legal.** No los invento: el JSON v1 llevará la periodicidad que se infiera del sitio actual (mensual para estados financieros, etc.) marcada como `"porConfirmar": true`, y los umbrales del semáforo son configurables. El supervisor debe validarlos.

12. **Costo.** Base estimada: Vercel Pro 20 USD (1 miembro) + Neon Launch 19 USD + R2 ~1–3 USD (100 GB, sin egreso) + Resend gratis (3k correos/mes) + Sentry gratis + Upstash gratis si se usa ≈ **40–45 USD/mes**. Dentro de tu objetivo. Lo que lo movería: antivirus (~5 USD), Cloudflare Stream (por minuto; te aviso con números), más miembros en Vercel.

13. **Videos de varios GB en R2 por el navegador:** multipart funciona, pero en conexiones municipales lentas una sesión de 2 GB puede tardar horas; la subida reanudable guarda el `uploadId` en `localStorage` para continuar tras cerrar la pestaña. Queda en Fase 1.5 por el recorte; los videos externos (YouTube/Facebook) cubren el caso común desde el MVP.

14. **Nombre de la plataforma.** Placeholder `NEXT_PUBLIC_PLATFORM_NAME="Plataforma de Transparencia"`; el paquete npm interno se llama `@platform/*` y se renombra con un find-replace cuando lo definas (mejor antes del primer municipio nuevo, no después).
