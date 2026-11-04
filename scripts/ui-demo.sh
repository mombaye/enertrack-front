#!/usr/bin/env bash
# Tout-en-un : lance le backend de DÉMO (données synthétiques, SQLite) + l'interface. Aucune donnée réelle, rien n'est modifié en production.
# Prérequis : dépôt enertrack-back à côté de celui-ci (../enertrack-back) avec ses dépendances Python installées.
# Ouvrir http://localhost:5173/modules/suivi-carburant/consommations  — connexion : demo / demo-egrid-123 — Arrêt : Ctrl+C
set -euo pipefail
cd "$(dirname "$0")/.."
BACK="${BACK_DIR:-../enertrack-back}"
[ -x "$BACK/scripts/demo_ui.sh" ] || { echo "Backend introuvable : $BACK/scripts/demo_ui.sh (définir BACK_DIR=chemin)"; exit 1; }
[ -d node_modules ] || npm ci
"$BACK/scripts/demo_ui.sh" "$@" & API=$!
trap 'kill $API 2>/dev/null || true' EXIT INT TERM
VITE_API_URL=http://localhost:8000/api npm run dev -- --host 127.0.0.1 --port 5173
