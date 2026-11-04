#!/bin/sh
# Déploiement du frontend en une commande : récupère le code, reconstruit l'image et redémarre le service.
# Les navigateurs ouverts se mettent à jour seuls (version.json) : aucune action manuelle côté utilisateurs.
#   usage :  ./deploy.sh            (branche master)
set -e
BRANCH="${1:-master}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "Version déployée : $(git log --oneline -1)"
docker compose up -d --build frontend
echo "Attente du service…"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://localhost/version.json" >/dev/null 2>&1; then
    echo "OK — build en ligne : $(curl -fsS http://localhost/version.json)"
    exit 0
  fi
  sleep 2
done
echo "ATTENTION : le service ne répond pas sur http://localhost/version.json" >&2
exit 1
