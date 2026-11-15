# Instructions pour les agents de code

1. Lire [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) avant toute exploration large du dépôt. Il décrit les points d’entrée, l’ordre des scripts, les API et les invariants de gameplay.
2. Confirmer dans le code les détails qui peuvent avoir changé ; le guide sert de carte, pas de substitut à la vérification d’un comportement précis.
3. Mettre à jour [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) dans la même modification après tout changement structurel : nouveau module/page, API, ordre de scripts, flux entre systèmes, coordonnées, collisions, streaming, persistance, lancement ou vérification.
4. Documenter les contrats et l’état actuel, pas un historique de chaque correction. Ne pas recopier des blocs entiers de code.
5. Le projet utilise des scripts navigateur classiques et des API globales `window.*`. Respecter leur ordre de chargement dans les pages HTML.
6. Garder les textes d’interface destinés au joueur en français, sauf demande explicite contraire.
