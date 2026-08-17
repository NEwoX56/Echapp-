# ÉCHAPPÉE

Jeu de cyclisme 3D dans le navigateur : carrière, grands tours à étapes,
gestion de l'effort et du ravitaillement, classements et maillots distinctifs.

Three.js + TypeScript + Vite. Aucun asset externe : tout le rendu
(coureurs, vélos, terrain, textures) est généré par le code.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # génère dist/ (déployable tel quel)
```

Le dossier `dist/` se dépose directement sur Netlify (glisser-déposer).

## Contrôles

### Clavier

| Touche | Action |
|---|---|
| ↑ / Z | augmenter l'allure |
| ↓ / S | ralentir (récupération d'énergie sous ~50 % d'effort) |
| ← → / Q D | placement latéral sur la route |
| Espace / Maj | sprint et attaque — le coureur passe en danseuse |
| B | boire un bidon (+26 énergie, absorbée progressivement) |
| G | avaler un gel (+16 énergie immédiate) |
| C | changer d'angle de caméra (poursuite, cintre, moto TV, drone) |

### Manette

Branche une manette Xbox ou PlayStation et appuie sur un bouton : elle est
reconnue automatiquement, sans configuration. Les navigateurs normalisent les
deux vers le mapping « standard », donc une DualSense et une manette Xbox se
comportent exactement pareil.

| Xbox | PlayStation | Action |
|---|---|---|
| RT | R2 | accélérer |
| LT | L2 | ralentir, récupérer |
| Stick gauche ou croix | idem | placement sur la route |
| A | Croix | sprint et danseuse — et valider dans les menus |
| X, ou LB | Carré, ou L1 | boire un bidon |
| Y, ou RB | Triangle, ou R1 | avaler un gel |
| Select | Share | changer d'angle de caméra |
| Start | Options | plein écran |
| LB / RB | L1 / R1 | changer d'onglet dans le menu |

Les libellés du HUD et du menu basculent automatiquement entre clavier et
manette. Le débranchement est détecté même quand le navigateur n'émet pas
d'événement (batterie vide, dongle retiré) : `Input.poll()` vérifie à chaque
frame qu'une manette répond encore.

## Bandeau de retransmission

Le haut de l'écran reprend la grammaire des incrustations télévisées :
l'emblème du grand tour, la tête de course avec les kilomètres restants et la
distance au prochain sommet, puis les groupes suivants avec leur effectif et
leur retard.

`RaceGroups.ts` découpe le peloton en paquets. Le critère est celui de la
route : deux coureurs séparés de plus de 34 unités appartiennent à des
groupes distincts. Trop bas, le champ se fragmente en une dizaine de paquets
qui n'apprennent rien ; trop haut, une échappée nette passe inaperçue.

Seuls trois groupes sont affichés, choisis par priorité : la tête, celui du
maillot jaune, celui du joueur, puis les plus fournis. Les groupes sont
recalculés trois fois par seconde et le bandeau n'est réécrit que lorsque son
contenu change — sans cette signature, le texte scintillerait.

Les emblèmes des quatre tours sont des SVG dessinés dans le code, donc nets à
toute taille : un sommet pour le Tour des Cimes, une vague pour la Ronde du
Littoral, une chaîne traversée pour la Grande Traversée, une couronne pour La
Couronne.

## Progression au-delà de 99

Une fois monté à 99 partout, les points d'amélioration s'accumulaient sans
usage. Quatre systèmes prennent le relais, reliés par une monnaie unique — les
points de carrière — pour éviter quatre compteurs séparés.

Règle tenue partout : **aucun bonus ne donne de vitesse pure**. Sinon on ne
fait que déplacer le curseur et le palier de difficulté suivant redevient
l'ancien. Les spécialités réduisent un coût, allongent une durée ou ouvrent
une option.

**Badges** (`progression.ts`) — douze récompenses de bronze à or, attribuées au
bilan d'étape. Elles créditent des points, ce qui en fait le moteur de la
progression une fois les caractéristiques au plafond.

**Spécialités** — huit, achetables 8 points, équipables selon le nombre
d'emplacements (2 au départ, 3e à 40 points, 4e à 120). Le nombre limité
d'emplacements est le cœur du système : on ne prend pas les meilleures, on
prend celles qui vont avec le profil du jour.

**Contrats d'étape** — le directeur propose un objectif adapté au profil et au
niveau du coureur. Accepté et réussi, il rapporte ; accepté et manqué, il
coûte. C'est ce qui donne un but à une étape qu'on ne peut pas gagner.

**Forme du jour** — variation de −7 à +8 sur toutes les caractéristiques,
connue avant le départ, relançable contre 3 points. Elle ne rend pas plus fort
en moyenne mais oblige à adapter ses ambitions.

`BriefingEtape.ts` réunit les quatre sur un écran d'avant-course : sans lui,
ils existeraient sans jamais dialoguer.

## Écran d'accueil

Mise en page calquée sur une maquette fournie : engrenage des réglages en haut
à gauche, marque en italique lourd, navigation verticale avec icônes et entrée
active encadrée, nom du joueur avec niveau et points en haut à droite, photo
occupant la moitié droite.

Au centre, une carte en verre dépoli présente la course en cours : nom du
grand tour, numéro d'étape, distance et type, profil altimétrique avec repères
(départ, sommets catégorisés, arrivée en damier), les cinq premiers du général
avec maillot, sigle d'équipe et écarts, puis deux actions — voir l'étape ou le
classement complet.

Le sigle d'équipe demande un peu de soin : prendre l'initiale de chaque mot
donnerait une seule lettre pour une équipe au nom d'un seul tenant. On combine
donc selon le nombre de mots.

Le voile CSS assombrit franchement la moitié gauche et laisse la droite
dégagée : sans lui la photo passerait sous le texte, avec un voile uniforme
elle disparaîtrait.

La carte centrale est en verre dépoli — fond à 40 % d'opacité seulement, pour
que l'image reste nettement visible au travers, compensé par un flou de 22 px
sans lequel la photo rendrait le texte illisible. Les libellés portent une
ombre portée légère pour la même raison.

Les Paramètres ne figurent pas dans la navigation : seul l'engrenage du coin
supérieur gauche y mène. Il porte l'état actif quand on s'y trouve, faute de
quoi aucun élément de navigation n'était marqué et le changement d'onglet à la
manette n'avait plus de point de départ.

L'image de fond est fournie par le joueur, dans `public/menu/`.

`HeroPanel.ts` fait défiler les affiches et **extrait la couleur d'accent de
l'image affichée**, propagée à toute l'interface par une variable CSS.

L'extraction se fait sur une miniature de 32 pixels : analyser l'image à sa
taille réelle coûterait des centaines de milliers de lectures de pixels pour un
résultat identique. Les pixels très sombres, très clairs ou grisâtres sont
écartés — ce sont le ciel, l'asphalte et les ombres, qui donneraient une teinte
terne. Les pixels restants sont regroupés par teinte plutôt que moyennés : une
moyenne de rouge et de bleu donne du gris, alors qu'on cherche la couleur qui
revient le plus souvent.

Les cinq affiches livrées sont dessinées par `generer-visuels.mjs` — des
compositions originales, aucune photo n'étant redistribuable.

## Difficulté

Six paliers : Facile, Normal, Difficile, Expert, Champion, Légende.

Le premier système se contentait de multiplier les statistiques des
adversaires en les plafonnant à 100. Face à un coureur monté à 99 partout,
cela ne servait plus à rien : les meilleures IA butaient sur le même plafond.
Les paliers élevés lèvent ce plafond — jusqu'à 138 en Légende — et agissent
sur trois autres leviers qui pèsent autant que les chiffres bruts : la réserve
d'énergie (jusqu'à 148 contre 100 pour le joueur), le rubber-banding supprimé
dès Champion, et la vigueur de la chasse du peloton.

**Un déséquilibre de fond découvert au passage.** Les adversaires disposaient
des mêmes bidons et gels que le joueur, mais aucune ligne ne leur disait de
s'en servir : celui-ci arrivait au sprint avec plus de cent points d'énergie
gagnés simplement en buvant. Aucun réglage de difficulté ne pouvait compenser
un tel écart de règles. Les IA se ravitaillent désormais, avec un seuil qui
suit le palier — maladroit en Facile, optimal en Légende — et la zone de
ravitaillement profite à tout le monde.

Un troisième détail bloquait encore : la condition « énergie déjà pleine »
était figée à 99 alors que les IA des hauts paliers ont une réserve de 130 ou
148. Elle suit maintenant la réserve du coureur.

Mesuré sur trois étapes par palier, avec un pilotage soigné :

| Palier | Coureur à 99 | Coureur à 72 |
|---|---|---|
| Facile | — | 2,3e |
| Normal | 1er, 3 victoires | 4,3e |
| Difficile | 1er, 3 victoires | 6,3e |
| Expert | 1,7e, 1 victoire | — |
| Champion | 3,7e, aucune victoire | — |
| Légende | 4,7e, aucune victoire | — |

Effet de bord assumé : l'échappée solitaire est devenue plus dure, un coureur
élite qui attaque au départ passant de la victoire à la 4e place. Une
échappée en solitaire ne devrait pas être une recette gagnante.

## Séquence d'arrivée

Le jeu construisait une tension pendant plusieurs minutes et la laissait
retomber sur un fondu vers un tableau de chiffres. Trois phases s'enchaînent
désormais.

Dans les cent dix derniers mètres, la caméra glisse en avant du coureur et le
prend de trois quarts face. Si un adversaire se trouve à moins de neuf unités,
le temps s'étire — le photo-finish est précisément ce que l'on veut voir.

Au franchissement, la caméra tourne lentement autour du coureur, la clameur
monte et la musique bascule. Le vainqueur lève les bras : le buste se
redresse, la tête se relève, les épaules s'ouvrent, avec un léger frémissement.
Le geste se superpose au pédalage, puisqu'un vainqueur continue de rouler. Un
podium du top 3 se contente de se relever, les autres restent en position.

L'écran de résultats attend la fin de la séquence, et les indicateurs de
course — énergie, allure, ravitaillement — s'effacent : ils n'ont plus d'objet
une fois la ligne franchie et encombraient le moment que l'on veut voir.

**Le trou qu'il a fallu combler d'abord.** `pose()` bornait toute distance à la
longueur du parcours : au-delà de la ligne, tout s'écrasait sur le dernier
point. La caméra d'arrivée se retrouvait collée au coureur, les voitures de
tête s'empilaient sur la ligne, et le vainqueur restait planté sur place
pendant que la caméra continuait. La courbe se prolonge désormais en ligne
droite dans l'axe, la route et le terrain sont construits sur cent cinquante
unités supplémentaires, et les coureurs roulent sur leur élan dans ce
dégagement.

## Angles de caméra

Quatre angles, cyclés à la touche **C** (Select à la manette) pendant le
roulage normal — l'arrivée et le décompte de départ gardent leur propre mise
en scène, décrite ci-dessus, que le mode choisi ne modifie pas.

| Angle | Vue |
|---|---|
| Poursuite | par défaut : derrière le coureur, recule légèrement avec la vitesse |
| Cintre | à hauteur d'œil, collé au guidon, regard loin devant — la position du coureur sur la route |
| Moto TV | de profil, calée sur le flanc, comme une moto de retransmission |
| Drone | haute et reculée, pour juger le peloton et le tracé d'ensemble |

La caméra cintre est positionnée en avant du point de pose du coureur : trop
proche, elle se retrouvait à l'intérieur de son propre casque.

## Véhicules de course

`Caravane.ts` place une voiture de direction devant les échappés, une moto de
prise de vues au niveau du premier, la voiture d'équipe derrière le joueur et
une voiture-balai en queue. Elles ne sont pas simulées : elles se calent sur
des coureurs de référence avec un décalage lissé, sans quoi un changement de
leader les ferait sauter.

Leur intérêt dépasse le décor : elles donnent une échelle aux distances, ce
qui manquait pour juger un écart d'un coup d'œil.

Les pièces de chaque véhicule sont fusionnées par matériau. Montés en une
dizaine de boîtes, quatre véhicules ajoutaient près de quarante appels de
rendu. Les roues perdent leur rotation propre au passage — à la vitesse d'une
course, elle n'était pas lisible.

## Paysages traversés

Une étape se déroulait dans un décor unique du départ à l'arrivée. `Decor.ts`
découpe désormais le parcours en zones tirées selon le profil : campagne,
village, ville, forêt, rivière, haute montagne. Le tirage dépend de la graine
de l'étape, si bien qu'une même étape offre toujours le même paysage et que
deux étapes n'en offrent jamais le même. L'arrivée se juge toujours en
agglomération, ce qui donne un repère fort dans le final.

Chaque zone reçoit son mobilier : immeubles à fenêtres éclairées et
lampadaires en ville, maisons à toit pentu au village, bosquets denses en
forêt, bottes de foin et clôtures en campagne. Les rivières sont franchies sur
un pont avec parapets, tablier et piles à avant-bec.

**Foule animée.** Recalculer la matrice de trois mille spectateurs à chaque
image coûterait plus cher que tout le reste de la scène réunie. L'animation
est donc confiée au shader : chaque instance reçoit une phase et une ferveur
tirées au sort, le sommet est déplacé sur la carte graphique, et le processeur
n'a qu'un nombre à mettre à jour — le temps. Un tiers de la foule reste calme
et les phases sont toutes différentes : une assemblée qui bougerait à
l'unisson ferait chorégraphie.

Il faut une clé de cache de programme sur le matériau, sans quoi Three
réutilise le programme d'un matériau standard ordinaire et l'animation ne
s'applique jamais.

**Quatre essences d'arbres** au lieu d'une : épicéa, cyprès effilé, feuillu
composé de deux masses rondes décalées, et arbuste. Leur proportion suit
l'altitude — les conifères prennent le dessus en hauteur, les feuillus
dominent en plaine.

**Deux nouveaux paysages.** Les vignes alignent leurs rangs perpendiculairement
à la route jusqu'à l'horizon ; le littoral apporte palmiers et rochers de bord
de mer. La haute montagne reçoit désormais éboulis, blocs et névés.

S'y ajoutent le mobilier de course : panneaux publicitaires inclinés vers les
coureurs — posés parallèlement à la route, on n'en voyait que la tranche —,
bornes des derniers kilomètres et flèches jaunes de signalisation. Tous les
panneaux partagent une seule texture dont chaque instance prélève une bande.

Un ou deux monuments par étape complètent le décor — château, cathédrale,
phare ou arche sous laquelle on passe — placés à mi-course et dans le dernier
kilomètre, là où le regard se porte.

**Deux corrections notables.** Les arches de pont, dessinées en tores centrés
sur l'axe de la route, avaient un rayon supérieur à la hauteur disponible :
elles traversaient la chaussée et bouchaient la vue. Remplacées par un tablier
plein et des piles franchement sous le niveau de la route.

Et surtout, chaque zone produisait ses propres lots d'instances : avec dix
zones et deux ponts, on passait de trente à cent treize appels de rendu. Les
placements sont maintenant rassemblés pour tout le parcours et envoyés en un
lot par type d'objet, ce qui ramène à cinquante-cinq appels — pour 1 131
objets ajoutés à la scène.

## L'échappée

Le peloton ne roule plus d'un bloc. `RaceTactics.ts` tient un second niveau de
décision, au-dessus de l'effort individuel : qui part devant, et qui accepte
de rouler pour les reprendre.

**Formation.** Après quelques dizaines de secondes, deux à quatre coureurs
tentent leur chance. La sélection croise le tempérament — un rouleur part
volontiers, un sprinteur presque jamais — et le retard au général : un
coureur relégué est laissé libre, un homme dangereux ne le serait pas. C'est
la vraie raison pour laquelle les équipes laissent filer certaines échappées.

**Régulation.** Le peloton ne cherche pas à rattraper, mais à rattraper *au
bon moment*. Il vise un écart décroissant vers un point de jonction et corrige
son allure en continu, comme un thermostat. Le point de jonction dépend de
l'étape : tard mais sûrement en plaine, où les équipes de sprinteurs veulent
l'emballage final ; parfois jamais en montagne, où personne n'a intérêt à
rouler pour un sprint qui n'aura pas lieu.

**Consigne, pas télécommande.** La tactique transmet un effort suggéré que
chaque coureur pondère par son tempérament et sa réserve. Un fuyard épuisé ne
tient pas l'allure demandée, un grimpeur durcit au-delà dans un col.

Le coût du vent a dû être ajouté au passage. L'abri faisait économiser 45 %,
mais rouler seul ne coûtait rien de plus : il n'y avait qu'un bonus, jamais de
malus. Un coureur bien noté partait donc seul sans jamais payer le prix du
vent. Une surcharge s'applique désormais à l'effort soutenu sans abri — c'est
ce qui rend une échappée coûteuse et qui fait qu'un groupe qui se relaie va
plus vite qu'un homme seul.

Mesuré sur une étape de plaine, en attaquant dès le départ :

| Coureur | Résultat |
|---|---|
| Débutant (55) | 7e — l'attaque ne paie pas |
| Confirmé (72) | 5e |
| Élite (92) | 1er en solitaire |

## Mécaniques

**Énergie.** Au-dessus de ~55 % d'effort tu puises dans tes réserves, en
dessous de 50 % tu récupères. Les montées et les sprints coûtent cher.

**Fringale.** À zéro d'énergie, les jambes se coupent : effort plafonné,
vitesse réduite de 20 %, récupération ralentie. Tu n'en sors qu'en remontant
au-dessus de 12 % d'énergie. Rouler à fond sans gérer coûte plus cher que
lever le pied au bon moment.

**Aspiration.** Colle-toi 2 à 9 m derrière un coureur, bien aligné : la
dépense chute de 45 % et tu gagnes un peu de vitesse. Badge au HUD.

**Ravitaillement.** Tu pars avec 4 bidons et 3 gels — pas de bonus à ramasser
sur la route. La zone de ravitaillement à mi-étape (banderole verte) refait
tes bidons et donne un gel.

**Danseuse.** Déclenchée au sprint ou sur un gros effort en forte pente. Le
bassin se lève, le buste se redresse, le vélo bascule sous le coureur.

## Classements et maillots

| Maillot | Classement | Attribution |
|---|---|---|
| Jaune | Général | temps cumulé le plus faible |
| Vert | Points | sprints intermédiaires + places à l'arrivée |
| À pois | Montagne | passages en tête aux sommets (hors catégorie à 4e) |
| Blanc | Meilleur jeune | meilleur temps général parmi les 25 ans et moins |

Comme dans une vraie course, un coureur qui mène plusieurs classements ne
porte que le plus prestigieux (général > montagne > points > jeune) ; les
autres maillots descendent au suivant. Les porteurs sont visibles en course.

## Grands tours

| Tour | Étapes | Déblocage |
|---|---|---|
| Tour des Cimes | 5 | disponible |
| Ronde du Littoral | 6 | niveau 3, ou terminer le Tour des Cimes |
| Grande Traversée | 8 | niveau 6, ou terminer la Ronde du Littoral |
| La Couronne | 10 | niveau 10, ou terminer la Grande Traversée |

29 étapes au total. Chaque étape dure 3 à 6 minutes ; ajustable via
`worldLength` dans `src/data/tours.ts`.

## Équipe et équipiers

Le joueur appartient à une équipe (Mistral Sud par défaut). Ses coéquipiers
du peloton adoptent un comportement dédié : ils se maintiennent 6 m devant
lui pour lui offrir l'aspiration, se calent sur sa trajectoire, puisent plus
bas dans leurs réserves que les autres, et le lancent à fond dans le dernier
kilomètre. Ils apparaissent en bleu clair sur la mini-carte.

Mesuré en test : à pilotage identique, la présence des équipiers fait gagner
environ cinq places sur une étape.

## Mini-carte et oreillette

La mini-carte en haut à droite superpose au profil altimétrique la position
de **tous** les coureurs : losange jaune pour le joueur, cercles pour les
autres, contour rouge pour ceux qui menacent ton classement général, contour
bleu pour tes équipiers. Les traits verticaux marquent les cols (rouge) et
les sprints (vert). Sous la carte, l'écart en secondes avec les trois
coureurs les plus proches.

L'**oreillette du directeur sportif** analyse la situation en continu et
n'intervient que quand c'est utile. Elle hiérarchise ses messages : une
menace directe au général passe avant un conseil d'allure, et elle ne
reparle pas du même coureur avant trente secondes.

Exemples réels produits en test :

> Kenji Okada est parti devant, 4 s. Il est à 18 s de toi au général — ne le laisse pas filer.

> Duval est devant mais il est 14e à 9 min au général. Laisse filer, il ne menace rien.

> Col de Nimbus, hors catégorie, dans 1.4 km. Tu es juste en énergie, monte à ton rythme.

> Tu roules dans le vent pour rien. Remonte dans la roue devant toi.

## Atelier de personnalisation

Aperçu 3D en direct, rotation à la souris.

- **Coureur** : nom, âge, couleur de peau, casque, cuissard
- **Maillot** : deux couleurs, 8 motifs, sponsor imprimé poitrine et dos
- **Vélo** : cadre, décoration, 3 styles de roues

## Architecture

```
src/
  core/       Game (états, boucle), Input, AssetLoader
  data/       types, tours (3 grands tours), roster (17 IA), appearance
  models/     RiderModel — coureur + vélo procéduraux, LOD, IK des jambes
  race/       Track (terrain, foule, banderoles), Rider (physique),
              AIController (archétypes), Race (orchestration, points)
  career/     Career — sauvegarde, XP, classements, maillots
  ui/         Menu, HUD, Results, RiderPreview, util
```

**Son**

Toute la bande-son est synthétisée à l'exécution : aucun fichier audio n'est
téléchargé, ce qui garde le jeu léger sur une connexion de console et écarte
toute question de licence.

`Music.ts` compose en direct à partir d'une grille d'accords et de voix
synthétisées (basse filtrée, nappe désaccordée, arpège pincé, batterie). Cinq
ambiances s'enchaînent selon la situation :

| Ambiance | Déclenchement | Tempo |
|---|---|---|
| menu | hors course | 76 |
| course | roulage normal | 132 |
| tension | pente > 5 % ou rival dangereux à moins de 60 m | 144 |
| finale | dernier kilomètre | 156 |
| victoire | première place à l'arrivée | 108 |

L'intensité varie en continu (effort, énergie basse, adversaires proches,
approche de la ligne) et ouvre progressivement les voix aiguës et la batterie,
sans coupure ni raccord audible.

Le séquenceur programme les notes à l'avance sur l'horloge audio, indépendante
du taux de rafraîchissement. La fenêtre d'anticipation est volontairement
large — 0,7 s au lieu des 0,1 s habituels — parce que sur une machine chargée
`setInterval` est déprogrammé et saute plusieurs centaines de millisecondes,
ce qui produisait des trous audibles. Le séquenceur est en outre appelé depuis
la boucle de jeu en renfort de son minuteur. Mesuré : 1 % de silence, plus
long trou 20 ms sur 8 secondes d'écoute continue.

**Musique fournie par le joueur**

Deux voies, la première ne demandant aucun outil : importer ses morceaux
directement depuis Paramètres → Son, ambiance par ambiance. Les fichiers sont
conservés dans IndexedDB et restent sur la machine du joueur.

Le choix d'IndexedDB plutôt que localStorage est contraint : localStorage
plafonne à environ 5 Mo et ne stocke que du texte, ce qui obligerait à encoder
l'audio en base64 — un tiers de poids en plus pour un seul morceau qui
saturerait déjà le quota.

Seconde voie, pour qui compile : des fichiers déposés dans `public/audio/`
nommés `menu`, `course`, `tension`, `finale`, `victoire`. Les morceaux importés
depuis le jeu ont la priorité sur ceux du dossier.

L'arbitrage est fait ambiance par ambiance — on peut ne fournir qu'un thème de
course et garder le procédural pour le reste.

Les morceaux sont lus par des éléments `<audio>` routés dans le bus musique
via `createMediaElementSource`, plutôt que décodés en mémoire : un morceau de
trois minutes décodé occupe une trentaine de mégaoctets, intenable dans le
navigateur d'une console. L'élément diffuse en continu et ne garde qu'un
tampon.

Le passage d'une ambiance à l'autre se fait en fondu enchaîné de 1,6 s. Les
mises en pause sont différées de la durée du fondu et protégées par un jeton :
sans lui, une pause programmée par un changement précédent venait couper une
piste relancée entre-temps — un bug bien réel repéré au test.

`AudioEngine.ts` fournit l'ambiance et les effets : vent dont la coupure suit
la vitesse, roulement des pneus, rumeur de foule qui enfle à l'approche des
barrières, bips de décompte, cloche du dernier kilomètre, gorgée de bidon,
sachet de gel, acclamations aux sprints et aux sommets.

Le son ne peut démarrer que sur un geste utilisateur : le contexte est ouvert
au clic de départ d'étape. Volumes et coupure sont réglables dans Paramètres.

**Qualité graphique et compatibilité**

Le jeu tourne aussi dans le navigateur d'une console (Edge sur Xbox) ou sur
une machine modeste. Ces plateformes échouent parfois *silencieusement* —
écran blanc, aucune erreur JavaScript — quand on leur demande une génération
PMREM pour les reflets d'environnement, qui s'appuie sur des cibles de rendu
flottantes.

`Quality.ts` détecte donc les capacités réelles (`OES_texture_float_linear`,
taille de texture maximale, user-agent console) et choisit un preset :

| Niveau | Ombres | AA | Reflets | Foule | LOD | Ratio | Terrain |
|---|---|---|---|---|---|---|---|
| Élevée | 1024, douces | oui | oui | 100 % | 34 m | 2 | 9 m |
| Moyenne | 512, joueur seul | non | non | 60 % | 20 m | 1,15 | 15 m |
| Basse | non | non | non | 30 % | 12 m | 0,85 | 24 m |

Deux réglages étaient définis mais jamais appliqués : l'antialiasing, fixé à
la construction du contexte WebGL et donc décidé à partir de la plateforme
avant toute détection fine, et la distance de LOD, jusque-là codée en dur à
34 m. Les corriger a fait passer la qualité moyenne de 190 000 à 110 000
triangles rendus.

Faire projeter une ombre aux dix-huit coureurs coûtait 342 meshes dans la
passe d'ombres pour un gain visuel faible : en qualité réduite, seul le joueur
en projette une, soit 19 meshes. La carte d'ombres n'est par ailleurs
recalculée qu'une frame sur deux ou trois.

Un moniteur de framerate descend automatiquement d'un cran — reflets, puis
ombres, puis résolution — si le jeu reste sous 24 images par seconde pendant
quatre secondes en qualité automatique.

Le mode `auto` retient *Moyenne* sur console et sur mobile. Les reflets sont
désactivés d'office si les textures flottantes filtrables manquent, quel que
soit le preset. Le ciel photographique, lui, est conservé : seuls les reflets
sautent.

Trois filets de sécurité complètent le dispositif : `safeRender()` dégrade
automatiquement après trois échecs de rendu consécutifs, les événements
`webglcontextlost` / `webglcontextrestored` sont gérés, et le joueur peut
forcer un niveau depuis Paramètres → Affichage.

**Navigation des menus à la manette**

`GamepadNav.ts` rend tous les menus pilotables sans clavier ni souris :
pastilles de couleur, motifs, curseurs, champs de texte, fiches de coureurs.

Le curseur se déplace dans l'espace plutôt que dans l'ordre du document. On
cherche l'élément le plus proche dans la direction demandée, en pondérant
l'écart latéral par deux pour privilégier l'alignement. C'est indispensable
ici : l'atelier présente des grilles de seize pastilles par rangée, qu'un
parcours séquentiel obligerait à traverser entièrement pour descendre d'une
ligne.

Chaque type d'élément réagit à sa manière au bouton A : un bouton se
déclenche, une case bascule, un champ texte prend le focus — ce qui fait
apparaître le clavier virtuel de la console. Les curseurs se règlent avec
gauche et droite, sans validation. Tant que le curseur n'est pas sorti, A
déclenche l'action principale de l'écran, de sorte qu'on lance une étape d'un
seul appui.

Après chaque reconstruction du menu, le curseur retrouve l'élément équivalent
grâce à une signature calculée sur ses attributs : sans cela il repartirait du
haut à chaque modification.

La manette est interrogée à 60 Hz par un minuteur indépendant du rendu. Sur
une machine qui tombe à quelques images par seconde, un appui bref commencé et
relâché entre deux images ne serait autrement jamais vu.

**Noms des coureurs en course**

`NameTags.ts` affiche le nom au-dessus des coureurs, activable dans
Paramètres → En course. Les étiquettes sont des éléments HTML positionnés par
projection de la position 3D vers l'écran, plutôt que des sprites : le texte
reste net à toute distance, aucune texture n'est générée par coureur et le
coût GPU est nul.

Seuls les neuf coureurs les plus proches et situés devant la caméra sont
étiquetés, l'opacité et la taille décroissant avec la distance. Le conteneur
est placé à côté du HUD et non dedans, ce dernier reconstruisant tout son
contenu au départ de chaque étape.

**Compte de synchronisation**

Un identifiant et un code personnel permettent de retrouver sa partie sur un
autre appareil : peloton modifié, réglages, carrière et musique importée.

Il faut être clair sur un point : cela suppose bien un serveur, deux appareils
ne pouvant rien s'échanger sans point commun. Ce qu'on évite, c'est une base
de données à administrer et un compte chez un tiers. `netlify/functions/sync.mts`
s'appuie sur Netlify Blobs, un stockage clé-valeur fourni avec l'hébergement.
Le fichier `netlify.toml` accompagne le dossier déposé, sans quoi le dépôt
manuel ne publierait pas la fonction.

Le modèle est minimal et assumé : l'identifiant sert de clé, le code protège
l'écriture. Ce n'est pas de l'authentification — il s'agit de retrouver ses
réglages sur un autre écran, pas de garder un secret. Le code ne transite
qu'en entête et n'est jamais renvoyé par le serveur.

La musique est encodée en base64, ce qui l'alourdit d'un tiers ; le client
s'arrête avant le plafond plutôt que d'échouer à l'envoi, préférant
synchroniser trois morceaux sur cinq que rien du tout. Si la fonction n'est
pas disponible sur l'hébergement, l'interface le dit et renvoie vers la
sauvegarde par fichier.

`synctest.mjs` valide l'ensemble avec deux contextes de navigateur réellement
séparés — stockage local et IndexedDB distincts — reliés par un serveur qui
reproduit le contrat de la fonction.

**Plein écran**

Sur le navigateur d'une console, les boutons de la manette pilotent aussi
l'interface du navigateur : Y ouvre un menu et n'atteint jamais la page. Le
plein écran retire cette interface et rend la manette au jeu. Il est demandé
automatiquement au départ d'une étape — le clic sur le bouton de départ
fournit le geste utilisateur exigé par l'API — et reste basculable par la
touche **F** ou le bouton **Start**, ou désactivable dans les paramètres.

En complément, chaque action de course dispose d'un bouton de secours parmi
ceux que les navigateurs ne réservent jamais : **LB** pour le bidon, **RB**
pour le gel, en plus de X et Y.

**Ciel**

Trois panoramas équirectangulaires issus de photos réelles (Poly Haven, CC0)
servent de fond et d'environnement d'éclairage : ciel dégagé en plaine et sur
les chronos, lumière chaude sur les étapes vallonnées, ciel chargé en
montagne. Ils sont aussi utilisés comme `scene.environment`, si bien que les
lunettes du coureur, les jantes et les parties métalliques du vélo reflètent
réellement le ciel.

Les fichiers sources sont des HDR 2k convertis en JPEG 2048×1024 par un tone
mapping Reinhard étendu (le JPEG livré par Poly Haven pèse 22 Mo ; la
conversion maison donne 60 à 138 Ko sans perte visible sur les nuages).

Les nuages dérivent par rotation lente du fond. La vitesse a demandé un
réglage : à un tour en 20 minutes le ciel pivotait de 65° sur une étape, ce
qui se voyait immédiatement. Calé sur 100 minutes, il avance d'environ 14°
par étape — le paysage vit sans distraire. La brume de scène est teintée
pour s'accorder à chaque ciel, et les sommets lointains s'y fondent au lieu
de se découper sur la photo.

**Rendu**

Ombres portées activées (shadow map 1024 dont la caméra suit le coureur, ce
qui donne des ombres nettes sans coût mémoire), tone mapping ACES Filmic et
espace colorimétrique sRGB. Sans l'ombre de contact, les coureurs semblaient
flotter au-dessus de la chaussée — c'était le principal défaut visuel.

**Textures**

Terrain, écorce et feuillage reçoivent des textures procédurales générées sur
canvas (touffes, cailloux, plaques d'ombre pour le sol ; fibres verticales
pour l'écorce ; amas irréguliers pour le feuillage). Les UV du terrain sont
en coordonnées monde, si bien que l'échelle reste constante sans étirement là
où le maillage s'élargit au loin. Trois textures de 64 à 256 px suffisent :
la mémoire vidéo compte sur le navigateur d'une console.

Les coureurs portent un dossard épinglé dans le bas du dos, numéroté selon la
place au classement général — imprimé dans la texture du maillot, donc gratuit
en polygones.

**Bras à cinématique inverse**

Les bras étaient posés à des angles fixes : les mains flottaient à côté du
guidon et s'en écartaient dès que le buste bougeait. Ils suivent désormais le
même principe que les jambes — la main est un point fixe sur la cocotte, on
calcule l'angle d'épaule et de coude qui l'y amènent.

Le calcul se fait dans le plan vertical du buste plutôt que par les matrices
monde : le pivot du buste ne subit qu'une rotation autour de X, donc le
changement de repère se réduit à une translation suivie d'une rotation plane,
bien moins coûteuse répétée pour dix-huit coureurs à chaque image.

Trois erreurs ont jalonné la mise au point. Une inversion de Y et Z dans le
changement de repère plaçait d'abord la main à quatre-vingts centimètres du
guidon, alors que le cintre n'est qu'à quarante-six centimètres de l'épaule.

Restait le choix de la solution : un triangle bras-avant-bras admet deux
positions de coude, l'une au-dessus de la ligne épaule-main, l'autre en
dessous. La première donne un bras tendu à l'horizontale, coude pointé en
l'air — personne ne roule ainsi. Un cycliste a le coude bas et fléchi, sous
cette ligne. C'est la seconde qu'il fallait retenir, et l'atteindre a demandé
de corriger d'abord le repère : tant qu'il était faux, aucune des deux
branches ne donnait quelque chose de crédible.

Mesuré : trois millimètres d'écart entre la main et le cintre en position
assise, un centimètre et demi en danseuse.

**Buste à sections elliptiques**

Le torse était une surface de révolution : sa section était un cercle parfait
et le coureur avait l'épaisseur d'un tube. Un thorax humain fait trente-six
centimètres de large pour vingt-deux de profondeur, et se creuse à la taille
avant de s'élargir aux épaules. On empile donc des anneaux elliptiques dont la
demi-largeur et la demi-profondeur évoluent séparément, avec un dos plus bombé
que la poitrine. Les coordonnées de texture reprennent celles d'un tour de
révolution, si bien que le maillot s'y applique sans retouche.

Le casque était par ailleurs aussi large que la cage thoracique. Une tête
humaine mesure vingt-deux centimètres pour un buste de cinquante : les
proportions ont été reprises et la coque ne dépasse plus le crâne que de son
épaisseur. Un deltoïde raccorde enfin le bras au buste — sans lui, le bras
sortait du torse par une arête franche, ce qui trahit un personnage assemblé
en morceaux.

**Anatomie du coureur**

Le torse est une surface de révolution (`LatheGeometry`) au dos arrondi et
aux épaules larges, aplatie de profil comme un dos en position de course.
La tête a un cou incliné, un crâne allongé, une mâchoire, un casque à
calotte + pointe aéro avec trois aérations et des sangles, et des lunettes
enveloppantes en matériau réfléchissant. Les membres montrent la coupure
manche/biceps et cuissard/quadriceps, un mollet galbé, une cheville fine et
une chaussette haute.

**Points techniques notables**

- *Terrain* : maillage continu généré par bruit fractal, exprimé en
  coordonnées route (distance, offset latéral). Le relief monte des deux
  côtés avec une vallée au centre ; coloration par altitude jusqu'à la neige.
  La bande centrale est **décaissée de 0,55 unité sous la chaussée** : le
  terrain étant échantillonné moins finement que le ruban d'asphalte, une
  interpolation linéaire pouvait sinon passer au-dessus de la route dans les
  virages en devers (l'herbe « coupait » la route en montagne).
  `Track.groundAt()` donne la hauteur réelle du sol visible et sert à poser
  arbres, spectateurs et barrières exactement sur la surface.
- *Coureur* : géométries fusionnées par matériau (`mergeGeometries`) pour
  limiter les draw calls, et LOD à deux niveaux (détaillé sous 34 m,
  silhouette au-delà).
- *Jambes* : cinématique inverse analytique à deux segments — le pied suit
  réellement la pédale, le genou se plie en conséquence.
- *Maillot* : texture canvas générée à la volée, mappée sur un cylindre
  (u fait le tour du torse, sponsor à u=0.25 et u=0.75).

## Tests

```bash
node smoke5.mjs     # logique de course, danseuse, points, maillots
node smoke6.mjs     # un grand tour complet de bout en bout
node smoke7.mjs     # mini-carte, oreillette, équipiers
node balance.mjs    # comparaison de trois styles de pilotage
node progress.mjs   # courbe de progression du coureur
node roadcheck.mjs  # contrôle que le terrain ne perce pas la chaussée
node padtest.mjs    # manette Xbox : détection, commandes, zone morte, menus
node padps.mjs      # manette PlayStation et débranchement
node skytest.mjs    # ciel : chargement, reflets, vitesse de dérive
node xboxtest.mjs   # conditions console : détection, dégradation, secours manette
node musictest.mjs  # les 5 ambiances et tous les effets, mesurés au signal
node audiotest.mjs  # séquenceur, ambiances adaptatives, réglages de volume
node usermusictest.mjs   # musique du dossier : détection, arbitrage, fondu
node musicimporttest.mjs # import depuis le jeu, persistance, suppression
node editortest.mjs      # éditeur de peloton : édition, ajout, retrait, export
node navtest.mjs         # navigation manette : cibles atteignables, A, curseurs
node tagstest.mjs        # noms au-dessus des coureurs, option activable
node echappeetest.mjs    # échappée : formation, écart, chasse, attaque du joueur
node decotest.mjs        # paysages : zones, monuments, instanciation
node fouletest.mjs       # foule : attributs d'animation, phases, horloge
node arriveetest.mjs     # arrivée : phases, bras levés, caméra, défaite
node tvtest.mjs          # bandeau : groupes, écarts, emblèmes, distance au sommet
node difftest.mjs        # six paliers, conseil adapté, ravitaillement des IA
node diffmax.mjs         # courbe de difficulté, moyennée sur trois étapes
node progtest.mjs        # points, badges, spécialités, contrats, forme du jour
node briefnav.mjs        # écran d'avant-course entièrement pilotable à la manette
node perfmenu.mjs        # nouvelle interface en conditions console
node synctest.mjs        # compte : deux appareils simulés, transfert complet
node perfcompare.mjs     # coût comparé des trois niveaux de qualité
```

`musictest.mjs` mesure le signal réellement produit par un `AnalyserNode`,
hors course : pendant une course en headless le rendu bloque le fil principal
et fausse l'échantillonnage.

`xboxtest.mjs` simule une Xbox en forçant un user-agent console et en
supprimant les extensions de textures flottantes, ce qui reproduit la cause
la plus probable de l'écran blanc.

`padtest.mjs` et `padps.mjs` injectent une manette virtuelle en remplaçant
`navigator.getGamepads`, ce qui permet de tester sans matériel.

`roadcheck.mjs` mesure par analyse de pixels la proportion d'herbe dans le
couloir de la route sur une étape de montagne : elle doit rester nulle.

Les tests pilotent la simulation directement (`race.update(dt)` en boucle),
ce qui les rend indépendants du framerate d'affichage.

## Modifier le peloton depuis le jeu

Onglet **Peloton** du menu. Tout se fait dans le navigateur, sans recompiler
et sans rien installer : renommer un coureur, renommer une équipe entière d'un
coup, changer le type de coureur, l'âge, la couleur du maillot et les quatre
caractéristiques au curseur. On peut aussi ajouter des coureurs et en retirer,
le retrait restant réversible.

Un bouton exporte l'ensemble dans un fichier `.json` et un autre le recharge —
utile pour sauvegarder son travail ou le transporter sur une autre machine,
puisque le stockage du navigateur peut être effacé.

Techniquement, `rosterStore.ts` conserve des *différences* par rapport au
peloton livré plutôt qu'une copie complète : les champs non modifiés
bénéficient ainsi des corrections d'une future version du jeu. Le peloton
d'origine reste dans `src/data/roster.ts` pour qui préfère éditer le code.

Les caractéristiques vont de 1 à 99 et pilotent réellement la course : `climb`
sur les pentes, `sprint` dans le final, `flat` au train, `endurance` pour la
récupération. Le type de coureur détermine la tactique de l'IA.

Ton équipe est nommée dans `src/career/Career.ts` (`team: 'Mistral Sud'`) : les
coureurs qui portent la même équipe deviennent tes équipiers.

## Décor 3D optionnel

Le décor (arbres, rochers, barrières, spectateurs) peut être remplacé par des
modèles GLB déposés dans `public/models/scenery/`, sans toucher au code. Voir
`public/models/scenery/LISEZMOI.txt` pour les noms de fichiers attendus et les
sources CC0 recommandées (Kenney Nature Kit et Racing Kit, KayKit Forest,
Quaternius).

`SceneryAssets` aplatit chaque GLB en une géométrie unique réutilisable par
`InstancedMesh` : c'est ce qui permet d'afficher plusieurs milliers d'arbres et
de spectateurs en quelques appels de rendu. Un GLB cloné mille fois serait
injouable. L'échelle et le centrage sont corrigés automatiquement — un modèle
livré en centimètres et décentré est ramené à la bonne taille, posé au sol.
En contrepartie les textures sont perdues, seules les couleurs de matériaux
sont conservées dans les couleurs de sommets.

Les montagnes font exception : le relief est calculé pour épouser le tracé de
la route, qui change à chaque étape, donc aucun modèle figé ne peut convenir.
Une chaîne de sommets lointains ferme l'horizon (`buildDistantRange`) ; elle
suit le coureur comme un décor de fond, sans quoi il finirait par la traverser.

## Remplacer le coureur par un modèle 3D externe

Dépose `public/models/rider.glb` : `AssetLoader` le détecte et remplace le
modèle procédural. Le fichier doit être orienté vers +Z, mesurer environ
1,8 unité de haut, sol à y=0. Un matériau nommé `Jersey` est recoloré
automatiquement. L'`AnimationMixer` reste à brancher dans
`AssetLoader.createRider` si le GLB embarque une animation de pédalage.
