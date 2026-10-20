#!/bin/sh
set -e
mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing "local/$BUCKET"
# CORS para subidas directas desde el navegador (panel en localhost)
cat > /tmp/cors.json <<'JSON'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON
mc cors set "local/$BUCKET" /tmp/cors.json 2>/dev/null || echo "aviso: mc cors no disponible en esta versión, continuar"
echo "Bucket '$BUCKET' listo"
