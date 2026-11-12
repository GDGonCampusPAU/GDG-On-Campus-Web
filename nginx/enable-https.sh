#!/bin/sh
# nginx image entrypoint hook (/docker-entrypoint.d): enable the HTTPS virtual
# hosts only when a certificate is mounted, so HTTP-only setups keep working.
set -eu
if [ -s /etc/nginx/certs/origin.pem ] && [ -s /etc/nginx/certs/origin.key ]; then
  cp /etc/nginx/https.conf /etc/nginx/conf.d/https.conf
  echo "enable-https: certificate found, HTTPS virtual hosts enabled"
else
  rm -f /etc/nginx/conf.d/https.conf
  echo "enable-https: no certificate in /etc/nginx/certs, serving HTTP only"
fi
