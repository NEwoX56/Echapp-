# ScanFood

Application web mobile-first pour scanner un produit alimentaire, lire son
score de santé, et départager deux références en **combat** ou plusieurs en
**tournoi**. Données produits : [OpenFoodFacts](https://world.openfoodfacts.org).
Visuels animés : [Higgsfield](https://higgsfield.ai).

Interface entièrement en français.

---

## Démarrage rapide

```bash
npm install
cp .env.example .env.local          # rien n'est obligatoire pour démarrer
npm run higgsfield:prefetch         # optionnel : rapatrie les vidéos/photos en local
npm run dev                         # http://localhost:3000
```

L'application démarre **sans base de données, sans Redis et sans clé
Higgsfield** : elle bascule alors sur un magasin JSON local (`.data/`), un
cache fichier, et les assets Higgsfield pré-générés livrés avec le dépôt.
Chaque service se branche indépendamment en renseignant sa variable
d'environnement.

Pour développer sans accès réseau à OpenFoodFacts, ajoute
`SCANFOOD_DEMO_DATA=1` : une douzaine de produits de démonstration
(`lib/data/fixtures.ts`) prennent le relais.

---

## Variables d'environnement

| Variable | Obligatoire | Effet si absente |
| --- | --- | --- |
| `SESSION_SECRET` | En production | Secret de développement (rejeté en production) |
| `DATABASE_URL` | Non | Magasin JSON local dans `.data/store.json` |
| `HIGGSFIELD_API_KEY` | Non | Assets pré-générés servis, aucune génération live |
| `HIGGSFIELD_API_SECRET` | Non | En-tête `hf-secret` omis |
| `HIGGSFIELD_API_BASE` | Non | `https://platform.higgsfield.ai` |
| `HIGGSFIELD_VIDEO_MODEL` | Non | `seedance_2_5` |
| `HIGGSFIELD_IMAGE_MODEL` | Non | `soul_2` |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Non | Cache fichier dans `.data/higgsfield-cache.json` |
| `SCANFOOD_DEMO_DATA` | Non | OpenFoodFacts en direct |
| `SCANFOOD_DATA_DIR` | Non | `./.data` |

Génère le secret de session avec `openssl rand -base64 32`.

---

## Base de données

Le schéma Prisma (`prisma/schema.prisma`) décrit cinq tables — `User`,
`ScanHistory`, `Favorite`, `Battle`, `Tournament` — toutes reliées à
`User` et **systématiquement filtrées par `userId`** dans `lib/store.ts` :
aucune fonction exportée ne renvoie de données sans scope utilisateur.

```bash
export DATABASE_URL="postgres://…"   # Neon, Supabase, Vercel Postgres…
npm run db:generate
npm run db:push
```

Dès que `DATABASE_URL` est défini, `lib/store.ts` passe sur Prisma ; sinon
il conserve le magasin fichier. Le reste de l'application ne voit pas la
différence.

### Authentification

`lib/auth.ts` implémente une session par cookie signé (HMAC-SHA256,
`httpOnly`, `sameSite=lax`) : l'utilisateur saisit son e-mail, on crée ou
retrouve son compte, on pose le cookie. Pas de mot de passe, pas de page de
login compliquée.

Pour passer à **Supabase Auth** ou **Clerk**, il suffit de réécrire
`currentUser()` avec le helper du fournisseur — le reste du code ne connaît
que `UserRecord.id`. Si tu utilises Supabase, active en plus les politiques
RLS sur les cinq tables (`user_id = auth.uid()`), le filtre Prisma devenant
alors une seconde ligne de défense.

---

## Assets Higgsfield

Neuf médias sont générés et livrés avec le dépôt (manifeste :
`lib/higgsfield/assets.ts`) :

| Asset | Usage |
| --- | --- |
| `intro.mp4` | Générique de lancement, 9:16 |
| `victory.mp4` | Vidéo de victoire de combat (repli) |
| `coronation.mp4` | Vidéo de couronnement de tournoi (repli) |
| 6 photos éditoriales | Arrière-plans de la home, des états vides et de l'écran de connexion |

Ils sont référencés par leur URL CDN Higgsfield. **`npm run
higgsfield:prefetch`** les télécharge dans `public/higgsfield/` ;
`resolveCurated()` préfère alors la copie locale. Lance-le une fois après le
clone — c'est ce qui met l'application à l'abri d'une expiration des URL CDN.

### Chaîne de résolution d'un média

Toute demande de vidéo ou de photo suit le même chemin, dans `lib/higgsfield/client.ts` :

1. **cache** — Redis Upstash si configuré, sinon fichier. Clé = hash SHA-256
   du prompt et de ses paramètres, donc un même gagnant n'est jamais
   régénéré deux fois ;
2. **génération live** — seulement si `HIGGSFIELD_API_KEY` est définie ;
3. **asset pré-généré** — toujours disponible.

Conséquence : aucun écran ne peut casser faute de clé API ou de réseau.

### Routes API

Toutes sont en `runtime: 'nodejs'`, vérifient la session, et n'exposent
jamais la clé au client.

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/higgsfield/battle-victory` | POST | Vidéo 4 s 9:16 du gagnant d'un combat |
| `/api/higgsfield/tournament-coronation` | POST | Vidéo 6 s 9:16 du champion d'un tournoi |
| `/api/higgsfield/product-image` | GET | Photo éditoriale pour un produit sans image |
| `/api/higgsfield/intro` | GET | URL du générique (ne génère jamais à la demande) |

Un **rate-limit** de 10 générations par utilisateur et par heure
(`rateLimitOk`) protège les trois premières ; au-delà, l'asset de repli est
renvoyé avec `limited: true` plutôt qu'une erreur.

### Ajouter un cas d'usage Higgsfield

1. Écris le prompt dans `lib/higgsfield/client.ts`, à côté de
   `battleVictoryPrompt` / `coronationPrompt`. Garde le vocabulaire
   éditorial : *premium editorial, dark moody background, side lighting,
   muted palette, no text, no people*.
2. Ajoute un asset de repli dans `CURATED` (`lib/higgsfield/assets.ts`) —
   c'est ce qui garantit que l'écran fonctionne sans clé.
3. Crée la route sous `app/api/higgsfield/<cas>/route.ts` en copiant
   `battle-victory` : vérification de session, `rateLimitOk`, puis
   `generateVideo` / `generateProductImage` avec un `kind` distinct (il
   entre dans la clé de cache).
4. Côté écran, réutilise `<VictoryOverlay>` pour un moment fort ou
   `<VideoThumb>` pour une miniature — les deux gèrent déjà le placeholder
   crème et le fondu.

---

## Architecture

```
app/
  page.tsx                    Home — salutation, raccourcis, 5 derniers scans
  signin/                     Connexion par e-mail
  scanner/                    Recherche · photo · saisie manuelle
  product/[barcode]/          Fiche produit complète
  combat/                     Duel : slots, animation VS, vidéo, comparatif
  tournament/                 Tournoi : sélection, couronnement, classement
  history/                    Onglets Scans / Combats / Tournois
  favorites/                  Produits mis de côté
  profile/                    Stats, champion, galerie de victoires
  api/                        Routes serveur (données + Higgsfield)
components/                   Score, ProductCard, NutritionTable, VictoryOverlay…
lib/
  foodApi.ts                  Parsing, score de santé, helpers d'affichage
  off.ts                      Accès OpenFoodFacts (serveur)
  store.ts                    Persistance Prisma ou fichier, scopée par userId
  auth.ts                     Session par cookie signé
  higgsfield/                 Client, cache, rate-limit, manifeste d'assets
```

### Score de santé

`calculateHealthScore` (`lib/foodApi.ts`) part d'une base de 50 puis
applique, dans l'ordre : Nutri-Score (±20), groupe NOVA (+10 à −15), sucres,
sel, graisses saturées, protéines, fibres, nombre d'additifs (+5 à −12) et
Eco-Score (±5). Le résultat est borné à 0–100 et arrondi.
`getScoreReasons` restitue les mêmes critères en puces lisibles.

### Scan par code-barres

Pas de flux vidéo dans le navigateur : `<input type="file" accept="image/*"
capture="environment">` ouvre l'appareil photo natif, puis
`@zxing/browser` décode le code depuis la photo
(`BrowserMultiFormatReader.decodeFromImageUrl`). Le décodage se fait sur
l'appareil, l'image n'est jamais envoyée au serveur. En cas de succès, le
code est traité exactement comme une saisie manuelle.

`@zxing/browser` est importé dynamiquement : il ne pèse sur le bundle que
lorsque l'utilisateur choisit réellement le mode photo.

---

## Design

Direction éditoriale, à rebours de l'esthétique « app IA » : fond crème,
titres en serif, chiffres en grand format, séparateurs par filets fins
plutôt que par cartes ombrées.

| Token | Valeur | Emploi |
| --- | --- | --- |
| `cream` | `#FAF8F4` | Fond général |
| `ink` | `#1A1A1A` | Texte principal |
| `forest` | `#1F3D2B` | Accent unique — bons scores, actions |
| `terracotta` | `#C2683B` | Alertes, scores faibles |
| `rule` | `#DED8CC` | Filets de séparation |

Typographie : **Fraunces** (serif éditoriale) pour les titres et les
chiffres, **Inter** pour le texte courant. Icônes Lucide en 1,25 px de
stroke. Animations Framer Motion : fondu + glissement court sur les
transitions courantes, séquences chorégraphiées (parallaxe, révélation au
masque, trait qui se dessine) sur les moments forts. La préférence système
« mouvement réduit » est respectée.

---

## PWA

`public/manifest.webmanifest` + icônes SVG rendent l'application
installable depuis Safari iOS et Chrome Android (`display: standalone`,
orientation portrait, thème crème). Les zones sûres des encoches sont gérées
par les utilitaires `safe-t` / `safe-b`.

---

## Déploiement sur Vercel

```bash
npm i -g vercel
vercel link
vercel env add SESSION_SECRET production
vercel env add DATABASE_URL production        # optionnel
vercel env add HIGGSFIELD_API_KEY production  # optionnel
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel --prod
```

Le magasin fichier et le cache fichier écrivent sur le disque local : sur
Vercel, dont le système de fichiers est éphémère, configure **`DATABASE_URL`
et Upstash** pour que les données et le cache survivent aux redéploiements.

Si tu utilises Prisma, ajoute `prisma generate` au build :

```json
{ "scripts": { "build": "prisma generate && next build" } }
```

---

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | ESLint (config `next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` / `db:push` | Prisma |
| `npm run higgsfield:prefetch` | Télécharge les assets dans `public/higgsfield/` |
