# Déploiement du frontend

```bash
./deploy.sh            # branche master
```

- Reconstruit l'image et redémarre le service ; l'identifiant de version du build est publié dans `/version.json` (jamais mis en cache).
- Les navigateurs déjà ouverts détectent la nouvelle version (toutes les minutes et au retour sur l'onglet), affichent « Mettre à jour »
  et se rechargent seuls au prochain changement de page : aucun Ctrl+Maj+R n'est nécessaire.
- `index.html` n'est jamais mis en cache ; les fichiers générés (`/assets/`) le sont durablement, et un fichier absent renvoie une 404
  (jamais la page d'accueil à la place d'un script) : plus d'écran blanc après une mise à jour.
