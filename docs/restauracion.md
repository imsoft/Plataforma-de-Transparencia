# Respaldos y restauración

**Qué hay que proteger:** la base de datos (documentos, índice, bitácora, usuarios) y los archivos del bucket. Nada se borra de verdad en la aplicación (papelera + versiones + bitácora inmutable), así que la restauración completa solo hace falta ante un desastre (borrado de tablas, error de migración, bucket vaciado).

## Base de datos

1. **Neon PITR**: restaura a un punto en el tiempo creando una rama desde el historial (Neon → Branches → _Restore_). Apunta `DATABASE_URL`/`DATABASE_URL_PUBLIC` a la rama restaurada o promuévela. Ventana: 7 días (plan Launch).
2. **Respaldo lógico diario** (GitHub Actions, `.github/workflows/respaldo.yml`): `pg_dump --format=custom` con el rol `migrator` → se sube a R2 en `_respaldos/<fecha>.dump` (retención 90 días por regla de ciclo de vida del bucket).
   - Restaurar: `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL_MIGRATIONS" <fecha>.dump`
   - Después: `pnpm --filter @platform/db migrate` (por si el dump es anterior a una migración) y revisar que `select count(*) from audit_log` coincida con lo esperado.

## Archivos

- R2 no tiene versionado nativo; la aplicación conserva cada versión anterior en `_versiones/`. Para desastre: copia periódica del bucket con `rclone sync r2:transparencia b2:transparencia-respaldo` (o a otro bucket R2 en otra cuenta) desde el mismo workflow semanal.
- Restaurar: `rclone sync` en sentido inverso. Las rutas están en `documento_versiones.ruta_r2`, así que basta con que el objeto exista en la misma ruta.

## Ensayo (obligatorio antes del lanzamiento y cada 6 meses)

1. Crear rama de Neon desde un dump → correr migraciones → levantar el panel local contra la rama → abrir 3 documentos al azar y verificar que `/d/<id>` del sitio local sirva el archivo.
2. Anotar fecha, duración y problemas en este archivo.

| Fecha       | Quién | Duración | Resultado |
| ----------- | ----- | -------- | --------- |
| (pendiente) |       |          |           |
