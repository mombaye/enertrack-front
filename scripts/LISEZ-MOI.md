# Voir les changements d'interface en local

| Script | Usage |
|---|---|
| `./scripts/ui-demo.sh` | **Le plus simple** : backend de démo (données synthétiques, SQLite) + interface. Ouvrir http://localhost:5173/modules/suivi-carburant/consommations, connexion `demo` / `demo-egrid-123`. `--reset` repart d'une base neuve. |
| `./scripts/ui-dev.sh [URL_API]` | Interface seule en mode développement (rechargement instantané). Sans argument : API locale `http://localhost:8000/api`. Avec une URL : se branche sur ce serveur (ex. `https://…/api`). |
| `node scripts/ui-shots.cjs [dossier]` | Captures d'écran (page complète + détail d'un site) pour comparer avant/après. Demande Playwright (`npm i --no-save playwright && npx playwright install chromium`). |

Prérequis démo : dépôt `enertrack-back` à côté (`../enertrack-back`, ou `BACK_DIR=…`) avec `pip install -r requirements.txt`.
Aucun `.env` n'est lu ni modifié ; les données de démo sont fictives.
