# TennisBot

Bot Discord qui réserve automatiquement des courts Paris Tennis à l'ouverture des créneaux (8h00).
La spécification complète est dans [`docs/specification.md`](docs/specification.md).

> État actuel : squelette déployable (connexion Discord, commande `/ping`, chargement de `config.yaml`,
> Chromium headless disponible pour Playwright). Les fonctionnalités arrivent jalon par jalon (section 8 de la spécification).

## Déploiement avec Docker Compose

Prérequis : Docker et le plugin Docker Compose sur la machine hôte (VPS ou machine personnelle).

1. Créer une application et un bot sur le [Discord Developer Portal](https://discord.com/developers/applications),
   puis l'inviter sur le serveur avec les scopes `bot` et `applications.commands`.
2. Copier le fichier d'environnement et le remplir :

   ```sh
   cp .env.example .env
   openssl rand -base64 32   # à coller dans VAULT_KEY
   ```

3. Ajuster `config.yaml` si besoin (monté en lecture seule dans le conteneur, pas besoin de reconstruire l'image).
4. Lancer :

   ```sh
   docker compose up -d --build
   docker compose logs -f tennisbot
   ```

Dans Discord, `/ping` doit répondre `pong`.

### Commandes utiles

| Action | Commande |
| --- | --- |
| Mettre à jour après un `git pull` | `docker compose up -d --build` |
| Redémarrer après modification de `config.yaml` | `docker compose restart tennisbot` |
| État de santé | `docker compose ps` (colonne `STATUS` : `healthy`) |
| Arrêter | `docker compose down` (les données du volume sont conservées) |
| Sauvegarder les données | `docker run --rm -v tennis-bot_tennisbot-data:/data -v "$PWD":/backup alpine tar czf /backup/tennisbot-data.tgz -C /data .` |

### Détails de l'image

- Basée sur l'image officielle `mcr.microsoft.com/playwright` (Node.js + Chromium et ses dépendances).
  Sa version doit rester alignée sur celle du paquet npm `playwright` (`ARG PLAYWRIGHT_VERSION` dans le `Dockerfile`).
- Fuseau `Europe/Paris` ; le processus tourne sous l'utilisateur non-root `pwuser`.
- Les données (SQLite à venir, captures de débogage, battement de santé) sont dans le volume `tennisbot-data` monté sur `/app/data`.
- `shm_size: 1gb` évite les plantages de Chromium liés au `/dev/shm` de 64 Mo par défaut.
- Le `HEALTHCHECK` vérifie que le bot, une fois connecté à Discord, a écrit son battement il y a moins de 90 s.

### Horloge

Un conteneur utilise l'horloge de l'hôte : la synchronisation NTP (chrony) se configure **sur l'hôte**, pas dans le conteneur.

```sh
sudo apt install chrony && chronyc tracking
```

## Développement local (sans Docker)

```sh
npm install
npx playwright install chromium
cp .env.example .env   # puis le remplir
npm run build && node --env-file=.env dist/index.js
```
