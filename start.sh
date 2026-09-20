#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo 'Falta .env. Ejecuta: cp .env.example .env'; exit 1; }
exec npm start
