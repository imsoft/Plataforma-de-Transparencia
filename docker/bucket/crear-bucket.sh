#!/bin/sh
# Crea el bucket local y su CORS (subidas directas desde el navegador: PUT firmado y multipart con ETag expuesto).
set -e
aws --endpoint-url "$ENDPOINT" s3api head-bucket --bucket "$BUCKET" 2>/dev/null || aws --endpoint-url "$ENDPOINT" s3api create-bucket --bucket "$BUCKET" >/dev/null
cat > /tmp/cors.json <<'JSON'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON
aws --endpoint-url "$ENDPOINT" s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/cors.json 2>/dev/null || echo "aviso: no se pudo configurar CORS (el servidor puede permitir todos los orígenes por defecto)"
echo "Bucket '$BUCKET' listo en $ENDPOINT"
