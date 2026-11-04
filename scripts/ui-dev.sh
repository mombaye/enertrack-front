#!/usr/bin/env bash
# Interface en mode développement (rechargement instantané à chaque modification du code), branchée sur l'API de votre choix.
#   ./scripts/ui-dev.sh                       → API locale http://localhost:8000/api
#   ./scripts/ui-dev.sh https://api.mon-serveur/api → API de préproduction/production (lecture, connexion avec vos identifiants)
# Aucun fichier .env n'est modifié. Ouvrir : http://localhost:5173
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci
VITE_API_URL="${1:-http://localhost:8000/api}" exec npm run dev -- --host 127.0.0.1 --port 5173
