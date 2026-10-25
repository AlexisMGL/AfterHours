# Malagasy Adventure — architecture

Malagasy Adventure est la quatrième expérience du dépôt Afterhours. Elle utilise le TypeScript strict, le DOM natif et Vite déjà présents. Elle ne dépend ni de Phaser, ni d’un service externe, ni d’un compte. Les trois jeux existants conservent leurs routes et leurs modules.

## Modules et responsabilités

| Fichier | Responsabilité |
| --- | --- |
| `src/main.ts` | Sélection de route et import dynamique de l’expérience. |
| `src/arcade.ts`, `src/arcade.css` | Catalogue partagé et carte de lancement. |
| `src/malagasy/main.ts`, `style.css` | Navigation interne, vues, session d’apprentissage et événements DOM. |
| `src/malagasy/types.ts` | Contrats des mondes, unités, leçons, exercices, concepts, sources, audio et sauvegardes. |
| `src/malagasy/worlds.ts` | Métadonnées des 20 destinations et progression envisagée. |
| `src/malagasy/content.ts` | Registre de contenu consultable par les moteurs et les vues. |
| `src/malagasy/engine.ts` | Réponses acceptées, déblocage, mélange, maîtrise, révisions, XP et validation du contenu. |
| `src/malagasy/storage.ts` | Chargement, sérialisation et validation du schéma de sauvegarde. |
| `src/malagasy/exercise-view.ts` | Registre des rendus d’exercices, brouillon de réponse et échappement HTML. |
| `src/malagasy/audio.ts` | Audio linguistique vérifié et effets de réponse synthétisés localement. |
| `src/malagasy/art.ts` | Illustrations SVG locales. |

Le contenu peut être subdivisé en fichiers de données sans modifier le contrat `Content`. Les références utilisent des identifiants persistants, jamais la position d’un élément dans un tableau.

## Flux d’apprentissage

1. La vue demande au moteur si les prérequis de la leçon sont satisfaits.
2. Les notes présentent les nouveaux concepts. `introduceLesson` ouvre ces concepts à l’entraînement sans les déclarer maîtrisés.
3. Les exercices authored et les révisions éligibles sont affichés par le registre de rendus.
4. Le validateur renvoie un résultat ; la vue affiche l’explication préparée dans le contenu.
5. `recordAnswer` produit un nouvel état, actualise la maîtrise et planifie une révision.
6. `completeLesson` valide le bilan et ouvre le prochain contenu lorsque le seuil requis est atteint.
7. La couche de stockage enregistre automatiquement l’état. L’export JSON fournit une sauvegarde portable.

`worldAvailable` vérifie la publication du monde et la fin de ses mondes prérequis. `worldCompleted` exige toutes les unités du monde, disponibles et terminées. Les neuf unités encore prévues empêchent donc de déclarer le monde 1 entièrement terminé après les trois unités de cette édition.

Les fonctions des moteurs ne dépendent pas du DOM, de `localStorage` ou de l’heure globale lorsque le paramètre de date est fourni. Cela permet des tests reproductibles. La session en cours et le brouillon d’un exercice sont de l’état d’interface ; ils ne sont pas des identifiants persistants.

## Sauvegarde et sécurité d’import

Le format courant est `schemaVersion: 1`. Il contient les paramètres, XP, leçons terminées, récompenses déjà accordées, concepts, dates d’activité, succès et historique borné. La clé locale est `afterhours.malagasy.progress.v1` ; aucun autre jeu ne partage cet état.

`parseSave` refuse les versions inconnues, les objets mal formés, les clés de prototype, les dates invalides, les valeurs numériques incohérentes et les références absentes du contenu courant. L’objet final est reconstruit. Le stockage est derrière l’interface `SaveStorage` (`getItem`/`setItem`) pour permettre plus tard un autre adaptateur.

Si la sauvegarde locale est illisible, `loadProgress` conserve son texte original dans `afterhours.malagasy.progress.v1.recovery` avant de proposer un état neuf en mémoire. Cette copie, limitée à 2 millions de caractères, reste disponible via `loadRecovery` et n’est jamais remplacée automatiquement par une erreur ultérieure. Si le stockage est inaccessible ou saturé, l’application signale sa limite ; le fichier original reste intact tant qu’aucune nouvelle sauvegarde ne réussit.

La validation du contenu vérifie chaque leçon contre la fermeture de ses propres prérequis, indépendamment du parcours global : une notion apprise dans une branche facultative ne peut pas être présumée connue dans une autre branche.

Il n’existe pas encore de migration entre deux versions, puisque seul le schéma v1 existe. Ajouter une migration explicite avant d’accepter un ancien schéma. La sauvegarde locale n’est pas un mécanisme anti-triche et ne remplace pas un futur compte synchronisé.

Si le document local est illisible, sa première copie brute est conservée séparément sous `afterhours.malagasy.progress.v1.recovery` avant toute nouvelle sauvegarde, lorsque le stockage et sa taille le permettent. La vue de sauvegarde permet de la télécharger pour examen. Cette copie n’est pas automatiquement réparée ni présentée comme importable.

## Extensions

- **Nouvelle unité/monde** : ajouter les données et les sources, vérifier les prérequis, puis passer `implemented` à vrai. Voir [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
- **Nouveau type d’exercice** : étendre `ExerciseType`, enregistrer son validateur dans `exerciseValidators` et son rendu dans `EXERCISE_RENDERERS`, ajouter la validation de configuration et un test comportemental.
- **Enregistrement linguistique** : ajouter une entrée `AudioAsset` documentée, puis une référence `audioId`. Un exercice d’écoute exige `status: 'verified'`.
- **Compte distant** : implémenter un adaptateur de stockage et une stratégie de conflit ; ne pas confondre les identifiants de contenu et ceux d’un utilisateur.

## Construction et hébergement

`npm run build` exécute TypeScript puis Vite et produit `dist/`. Les fichiers statiques restent compatibles avec `netlify.toml` et `public/_redirects`. Aucun serveur applicatif, secret ou appel d’IA n’est requis à l’exécution. Les liens de sources s’ouvrent seulement à la demande du lecteur. Aucun déploiement n’est impliqué par une simple modification locale du dépôt.

Les contrôles dédiés se trouvent dans `tests/malagasy-engine.test.ts` et les tests navigateur de `e2e/`. Vérifier leur résultat à chaque extension au lieu de considérer ce document comme une attestation de tests passés.
