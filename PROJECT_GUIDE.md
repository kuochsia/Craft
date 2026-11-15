# Guide du projet

Ce document donne aux personnes et aux assistants IA une carte du projet, de ses modules et de leurs contrats. Il évite d’avoir à relire tous les scripts pour comprendre où intervenir.

> **Règle de maintenance :** tout changement structurel doit mettre ce guide à jour dans la même modification. La consigne est également dans [`AGENTS.md`](AGENTS.md), le fichier d’instructions à lire en premier par un agent de code.

## Vue d’ensemble

Le projet est une expérience Minecraft en 3D, exécutée dans le navigateur avec Three.js. Il n’y a actuellement ni bundler, ni gestionnaire de dépendances, ni suite de tests automatisés dans le dépôt. Les pages HTML chargent des scripts classiques qui exposent leurs API sur `window`.

La page principale est [`index.html`](index.html). [`end.html`](end.html) est une scène séparée pour l’End. Les éditeurs de blocs, d’herbe et d’armes sont des pages autonomes.

Pour lancer localement, servir la racine du dépôt avec un serveur HTTP statique et ouvrir `index.html`. Les scripts, textures dessinées sur canvas et liens entre pages utilisent des chemins relatifs.

## Carte des fichiers

| Chemin | Responsabilité |
| --- | --- |
| [`index.html`](index.html) | Scène principale, interface et menus, création des personnages et du décor, monde fini, caméra, boucle d’animation et commandes propres à cette page. Une grande partie de l’orchestration est en JavaScript inline. |
| [`end.html`](end.html) | Scène de l’End, îles/blocs, rencontre avec le dragon, caméra, chute de 2 secondes et réapparition des joueurs. Sa boucle de jeu est indépendante de celle d’`index.html`. |
| [`blocks/blocks.js`](blocks/blocks.js) | Registre `MinecraftBlocks`, création de matériaux, textures, meshes et icônes, blocs personnalisés et persistance des blocs de l’éditeur. |
| [`blocks/block-world.js`](blocks/block-world.js) | Monde de blocs : placement, minage, ciblage, durabilité, collisions du terrain, chunks, végétation minable, arbres, collines, maison du villageois, feu, TNT et interactions de personnages. |
| `blocks/<id>.js` | Définition et enregistrement d’un bloc. Les définitions chargées par une page doivent précéder `blocks/block-world.js` dans le HTML. |
| [`blocks/dirt.js`](blocks/dirt.js) | Définition procédurale du bloc de terre, requise par le terrain minable d’`index.html`. |
| [`blocks/block-editor.html`](blocks/block-editor.html) | Éditeur visuel de blocs. Utilise le registre et la sauvegarde de `blocks/blocks.js`. |
| [`characters/character-model.js`](characters/character-model.js) | Modèle commun Alex/Steve, armes, saut, gravité, collisions et déplacement. Expose `MinecraftCharacterModel`. |
| `characters/alex.js`, `characters/steve.js` | Apparences/configurations d’Alex et Steve ; exposent leurs constructeurs sous `MinecraftCharacters`. |
| [`characters/villager.js`](characters/villager.js) | Modèle et comportement du villageois. |
| [`characters/chicken.js`](characters/chicken.js) | Modèle, déplacement aléatoire, suivi et collisions propres aux poulets. |
| [`characters/ender-dragon.js`](characters/ender-dragon.js) | Modèle de l’Ender dragon utilisé dans l’End. |
| [`shared/character-camera-controls.js`](shared/character-camera-controls.js) | Contrôles de caméra et conversion des touches en déplacement. Expose `MinecraftCharacterCameraControls`. |
| [`weapons/inventory.js`](weapons/inventory.js) | Inventaires, sélection arme/bloc, modèle en main et routage des actions vers `MinecraftBlockWorld`. |
| `weapons/<id>.js`, `weapons/weapon-motion.js` | Modèles et animations des armes. Ils enregistrent leurs définitions dans `MinecraftWeapons`. |
| [`vegetation/grass.js`](vegetation/grass.js) | Herbe décorative à deux panneaux croisés, instances groupées, cibles minables reliées aux instances et preset éditable, sauvegardé dans `localStorage`. |
| [`vegetation/grass-editor.html`](vegetation/grass-editor.html) | Éditeur de preset de l’herbe décorative. |
| [`world/world-design.js`](world/world-design.js) | Génération déterministe de l’île finie : plaine centrale, collines, crêtes montagneuses, lac, niveau de l’océan et limites de terrain. |

## Chargement des scripts

Les balises `<script>` sont des scripts classiques : leur ordre est une dépendance d’exécution, pas seulement un classement.

Dans `index.html`, l’ordre important est :

1. Three.js (`r128`) et les utilitaires d’armes.
2. `characters/character-model.js`, puis Alex, Steve, villageois et poulets.
3. `vegetation/grass.js` et `world/world-design.js` avant l’initialisation inline de la scène.
4. `blocks/blocks.js`, puis les définitions de blocs, dont `grass.js` et `dirt.js`.
5. `blocks/block-world.js` après toutes les définitions de blocs.
6. `weapons/inventory.js` après le monde de blocs, puis `shared/character-camera-controls.js`.
7. Le script inline qui construit la scène et démarre la boucle.

`end.html` partage les scripts des personnages, armes et blocs, mais construit sa propre scène et sa propre boucle. Il ne crée pas le terrain infini minable de la page principale. Si une nouvelle page appelle `createMineableTerrain`, elle doit charger les définitions `grass` et `dirt` avant `blocks/block-world.js`.

## API globales principales

| API | Définie par | Usage |
| --- | --- | --- |
| `window.MinecraftBlocks` | `blocks/blocks.js` | `get(id)`, `getAll()`, `register(def)`, `createBlockMesh(THREE, def, options)` et sauvegarde des blocs personnalisés. |
| `window.MinecraftBlockWorld` | `blocks/block-world.js` | `spawnBlock`, `createMineableTerrain`, `registerMineableVegetation`, `getTerrainFloorHeight`, `collidesWithTerrain`, `buildVillagerHouse`, `buildDecorativeStructures`, `setupBlockInteraction`, `triggerAction`, `update` et accès à `placedBlocks`. `createMineableTerrain` expose aussi la zone de construction plate et le clamp des positions aux limites. |
| `window.MinecraftCharacterModel` | `characters/character-model.js` | `build`, `startJump`, `stopJump`, `updateJump`, `moveWithCollisions`, armes et animations. |
| `window.MinecraftCharacters` | fichiers `characters/*.js` | Constructeurs Alex, Steve, villageois et poulet. |
| `window.MinecraftCharacterCameraControls` | `shared/character-camera-controls.js` | Contrôles configurables par personnage, déplacement et caméras séparées. |
| `window.MinecraftWeapons` | fichiers `weapons/*.js` | Définitions et constructeurs des armes. |
| `window.MinecraftWeaponsInventory` | `weapons/inventory.js` | Branchement des personnages et sélection d’inventaire. |
| `window.MinecraftVegetation` | `vegetation/grass.js` | Preset, texture, matériau et création du champ d’herbe instancié. |
| `window.MinecraftWorldDesign` | `world/world-design.js` | `createIsland()` fournit les hauteurs, le lac, les limites circulaires et une surface d’eau instanciée qui s’étend vers les colonnes creusées connectées à la mare. |

Les noms et signatures exposés sont utilisés directement par les pages HTML. Toute modification d’une API publique doit mettre à jour ses appelants et ce tableau.

## Terrain minable et blocs

### Terrain naturel de `index.html`

`index.html` crée une île finie via `MinecraftWorldDesign.createIsland()`, puis appelle `MinecraftBlockWorld.createMineableTerrain(...)` avec des chunks statiques de 24×24 cellules. Tous les chunks qui intersectent le disque de l’île sont créés une fois au démarrage et ne sont pas déplacés ni recyclés lorsque les joueurs avancent. Les chunks vides aux coins sont omis, et le frustum de la caméra écarte les chunks hors champ. La carte a une plaine centrale au niveau 0 pour le village et la maison, un lac avec un lit creusable, des collines et des crêtes vers l’extérieur. Chaque colonne est générée jusqu’à sa hauteur de surface et sa profondeur minimale. La capacité des meshes de terre augmente à la demande. L’eau est limitée à la mare initiale et se propage en surface vers les colonnes excavées assez bas lorsqu’elles sont connectées à celle-ci ; aucun plan d’eau global ne recouvre le dessous du terrain.

L’herbe décorative garde un seul mesh instancié pour le rendu. `index.html` enregistre ses proxies minables avec `registerMineableVegetation`; le proxy référence la position et l’instance de chaque touffe. Lors d’un minage ou d’une explosion, l’instance est masquée sans convertir toutes les touffes en meshes indépendants.

Le terrain ne met pas chaque cube dans `collisionObstacles`. `block-world.js` fournit plutôt des requêtes ciblées :

- `getTerrainFloorHeight(x, z, radius, currentY)` pour la hauteur d’appui ;
- `collidesWithTerrain(x, z, radius, height, feetY)` pour les faces latérales ;
- `updateCenter(x, z)` et `setBounds(bounds)` pour le centre et les limites du terrain. Dans le monde fini actuel, `staticWorld: true` garde les chunks en place après leur génération initiale.

`characters/character-model.js` consulte ces requêtes pendant le saut et les déplacements. Les déplacements horizontaux sont balayés par petits pas sur chaque axe, puis affinés à la limite du contact : un mouvement rapide ne peut donc pas traverser un flanc de bloc et le personnage conserve le glissement le long du mur. Les collisions utilisent le rayon et la hauteur du personnage lorsqu’ils sont définis, avec une tolérance verticale réduite pour ne pas autoriser le passage à travers le haut d’un mur.

### Creusement et mémoire des trous

- Chaque colonne commence avec un bloc d’herbe en surface et des blocs de terre jusqu’au niveau minimal défini par le relief (le lac a un lit plus bas).
- Casser un bloc de terrain marque son voxel `(x,y,z)` comme miné. Cette position exacte ne doit pas être recréée.
- Une couche de soutien 3×3 est recherchée un niveau sous le bloc cassé. Elle est créée uniquement aux positions qui ne contiennent pas déjà un bloc et qui n’ont pas été minées à ce niveau.
- `storedColumnBlocks` mémorise exactement les blocs restants lors du déchargement/rechargement d’un chunk. Une colonne vide doit rester vide.
- La capacité du mesh de terre peut augmenter pendant le creusement.

Ne pas remplacer ce suivi par un simple niveau de surface ou un indicateur « colonne minée » : le premier reboucherait des trous au rechargement ; le second empêcherait de générer les couches plus profondes nécessaires. Préserver la distinction entre coordonnées de voxel minées et blocs qui restent dans la colonne.

### Coordonnées des blocs

Le terrain stocke `block.position` au centre du cube. `spawnBlock(THREE, ..., x, y, z)` reçoit au contraire le niveau de base `y` et place le centre à `y + 0.5`. Pour obtenir le niveau de base d’un mesh, le code utilise `Math.round(block.position.y - 0.5)`. Cette différence est importante pour le minage, le placement, les collisions et les niveaux négatifs.

### Placement, minage, briquet et TNT

`weapons/inventory.js` appelle `MinecraftBlockWorld.triggerAction(character)` pour les actions d’Alex/Steve. `performCharacterAction` route l’action selon l’objet tenu :

- bloc en main → `attemptPlaceBlock` ;
- briquet → `attemptIgniteBlock` ;
- arme ou mains nues → attaque de personnage ou minage.

La pose cherche un vide vertical soutenu dans la colonne devant le joueur, sous puis au niveau/au-dessus du joueur. Si elle n’en trouve pas, elle empile au-dessus du bloc le plus haut. Le niveau d’empilement doit prendre en charge les coordonnées négatives.

Le briquet filtre ses cibles vers TNT et blocs inflammables ; ne pas le faire choisir le sol non inflammable. La TNT utilise les mêmes listes de blocs posés et la mise à jour `MinecraftBlockWorld.update` pour son compte à rebours et sa détonation.

## Personnages, déplacement et caméra

- `character-model.js` gère la physique commune des joueurs : position des pieds, saut, gravité, interactions avec les obstacles et collisions terrain.
- `shared/character-camera-controls.js` transmet le déplacement à `moveWithCollisions`. Les bindings de touches de la page principale sont dans `index.html`.
- La page principale utilise les touches Z/Q/S/D ou flèches pour Alex, O/K/L/M pour Steve ; V/N pour sauter, R/U pour sélectionner, A/I pour l’action. L’inventaire est décrit dans `weapons/inventory.js`.
- Les poulets ont leur propre IA et physique dans `characters/chicken.js`. Si une modification de collision doit concerner les poulets, elle ne sera pas automatiquement appliquée par le déplacement commun des joueurs.
- Le villageois utilise son propre modèle ; `block-world.js` applique sa gravité et le fait sauter automatiquement pour sortir d’un trou quand le rebord est à portée de saut. Son suivi/relocation est aussi coordonné par `block-world.js`.
- La maison du villageois est suivie bloc par bloc et suit la hauteur locale du terrain. Après incendie ou TNT, si ses blocs inflammables ont tous disparu, `replaceBurnedVillagerHouse` cherche un plateau plat dans la plaine, puis y place la maison et guide le villageois vers la porte. Les positions du villageois sont bornées au disque de l’île, y compris pendant le recul après un coup.
- `end.html` a sa propre animation de chute de 2 secondes et son propre respawn. Les changements de déplacement ou de cycle de vie des joueurs doivent être vérifiés sur les deux pages si leur comportement partagé est visé.
- Dans `index.html`, franchir le bord circulaire de l’île lance une chute de 2 secondes ; Alex et Steve réapparaissent à leurs positions initiales, au centre de la plaine. Les poulets restent contenus dans leur zone de déplacement.

## Rendu et performance

- Terrain : meshes instanciés par chunk et par matériau ; ne pas créer un `Mesh` indépendant pour chaque cube naturel.
- Herbe décorative : panneaux croisés dans un `InstancedMesh` partagé, sans ombres portées.
- Les blocs décoratifs/posés restent des meshes indépendants car ils ont des interactions individuelles (collisions, dégâts, feu, TNT).
- `index.html` limite son rendu principal à environ 30 images par seconde et évite la boucle lorsque le document est masqué.
- Éviter les scans complets de `placedBlocks` dans les boucles de déplacement ou de rendu. Garder les recherches locales pour la physique ; les scans ponctuels d’attaque/placement sont acceptables tant que leur coût reste raisonnable.

## Éditeurs et données persistées

- L’éditeur de blocs enregistre les définitions personnalisées par le registre `MinecraftBlocks` et `localStorage`.
- L’éditeur d’herbe sauvegarde un preset dans `localStorage` via `vegetation/grass.js`.
- L’éditeur d’armes travaille avec les définitions de `MinecraftWeapons` et génère/enregistre les fichiers d’armes selon son flux existant.
- Pour ajouter un bloc : créer sa définition, la faire enregistrer par `MinecraftBlocks.register`, ajouter sa balise `<script>` avant `block-world.js` sur les pages concernées, puis ajouter le choix d’inventaire si le joueur doit pouvoir le sélectionner.

## Vérification

Il n’y a pas de commande de build ou de tests automatisés configurée dans le dépôt à ce jour. Pour une modification JavaScript, vérifier au minimum la syntaxe des fichiers modifiés (`node --check fichier.js`) et `git diff --check`. Le JavaScript inline d’`index.html` doit être extrait avant `node --check`.

Pour les changements de gameplay, faire ensuite une vérification manuelle dans la page concernée. Points utiles : déplacement normal et saut, marche contre une face de bloc, entrée/sortie d’un trou, minage aux niveaux négatifs, pose dans un trou et sur une pile, briquet/TNT, rechargement d’un chunk creusé, plaine/lac/relief, bord de l’île et chute/respawn de 2 secondes. Pour les systèmes partagés, vérifier aussi `end.html`.

## Mise à jour de ce guide

Mettre à jour `PROJECT_GUIDE.md` dans la même modification si un changement :

- ajoute, supprime ou déplace un module ou une page ;
- change l’ordre de chargement des scripts ;
- ajoute ou modifie une API globale ou le flux entre systèmes ;
- change le modèle de coordonnées, de collisions, de terrain, de streaming ou de persistance ;
- change les contrôles, le lancement du projet ou les outils de vérification.

Pour une modification locale sans effet sur l’architecture, ne pas ajouter de journal de changements ici. Garder le guide orienté vers l’état actuel du code, avec des chemins et contrats vérifiables.
