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
| `src/malagasy/dialogue-content.ts` | Scènes d’introduction et échanges associés aux activités. |
| `src/malagasy/engine.ts` | Réponses acceptées, déblocage, mélange, maîtrise, révisions, XP et validation du contenu. |
| `src/malagasy/storage.ts` | Chargement, sérialisation et validation du schéma de sauvegarde. |
| `src/malagasy/exercise-view.ts` | Registre des rendus d’exercices, brouillon de réponse et échappement HTML. |
| `src/malagasy/audio.ts` | Audio linguistique vérifié et effets de réponse synthétisés localement. |
| `src/malagasy/dialogue-audio.ts` | File de lecture des répliques, relecture, annulation, muet et gestion des politiques audio du navigateur. |
| `src/malagasy/voice-bank.ts`, `voice-recordings.ts` | Correspondance exacte des répliques et références humaines ; la banque numérique reste distincte de leur validation linguistique. |
| `src/malagasy/synthetic-voices.ts`, `public/malagasy/voices/mms/` | Registre des 52 énoncés numériques (dialogues et sélections malgaches) et WAV locaux avec manifeste de provenance. |
| `src/malagasy/voice-profiles.ts`, `scripts/generate-malagasy-profiles.mjs` | Timbre Mia relevé hors ligne, tempo inchangé, manifeste des dérivés. |
| `src/malagasy/spoken-selections.ts` | Sélections explicitement malgaches ; les choix français ne sont pas lus. |
| `scripts/generate-malagasy-mms.mjs` | Génération auteur locale depuis les dialogues, sans clé ni moteur TTS dans le navigateur. |
| `src/malagasy/recording-references.json`, `public/malagasy/voices/` | Métadonnées de provenance, licences et fichiers originaux distribués localement. |
| `src/malagasy/voice-plan.json`, `scripts/malagasy-voices.mjs` | Inventaire des phrases à enregistrer et outil hors ligne facultatif ; les brouillons restent `pending`. |
| `src/malagasy/art.ts` | Illustrations SVG locales. |
| `src/malagasy/characters.ts`, `dialogue-view.ts`, `dialogue.css` | Personnages expressifs, bulles, traductions facultatives et réactions courtes. |
| `src/malagasy/session.ts`, `lesson-view.ts`, `learning.css` | État transitoire, dialogues progressifs, repères unité/partie, quiz et clôture d’unité. |
| `src/malagasy/map.ts`, `map.css`, `madagascar-coast.json` | Littoral Natural Earth simplifié, projection commune et escales accessibles. |
| `src/malagasy/map-sources.ts` | Métadonnées géographiques pures, séparées de la géométrie pour les imports du contenu et des tests Node. |
| `src/malagasy/AGENTS.md` | Vision initiale et consignes produit conservées pour les futurs agents. |

Le contenu peut être subdivisé en fichiers de données sans modifier le contrat `Content`. Les références utilisent des identifiants persistants, jamais la position d’un élément dans un tableau.

## Flux d’apprentissage

1. La vue demande au moteur si les prérequis de la leçon sont satisfaits.
2. Les expressions sont découvertes dans les scènes de Lova et Mia, tour par tour. Les traductions et les notes grammaticales sont facultatives. Les concepts sont réellement ouverts à l’entraînement lors du passage à la pratique, après cette découverte ; quitter une introduction ne doit pas ajouter toute sa banque aux révisions.
3. Les six activités rédigées de la partie conservent leur ordre conversationnel, puis jusqu’à deux rappels antérieurs éligibles sont ajoutés. Le Centre de révision utilise le sélecteur générique ; les quiz utilisent leurs douze activités dédiées.
4. Le validateur renvoie un résultat ; la vue affiche l’explication préparée dans le contenu.
5. `recordAnswer` produit un nouvel état, actualise la maîtrise et planifie une révision.
6. `completeLesson` valide la partie ou le quiz lorsque le seuil est atteint. La fin d’une partie et la clôture d’une unité ont des écrans distincts ; le résultat d’une nouvelle tentative reste indépendant d’une validation historique conservée.
7. La couche de stockage enregistre automatiquement l’état. L’export JSON fournit une sauvegarde portable.

`worldAvailable` vérifie la publication du monde et la fin de ses mondes prérequis. `worldCompleted` exige toutes les unités du monde, disponibles et terminées. Les neuf unités encore prévues empêchent donc de déclarer le monde 1 entièrement terminé après les trois unités de cette édition.

Les fonctions des moteurs ne dépendent pas du DOM, de `localStorage` ou de l’heure globale lorsque le paramètre de date est fourni. Cela permet des tests reproductibles. La session en cours et le brouillon d’un exercice sont de l’état d’interface ; ils ne sont pas des identifiants persistants.

## Lecture des voix de dialogue

`recordingForTurn` relie un tour à un fichier `AudioAsset` uniquement lorsque la transcription correspond à l’énoncé complet. Les huit expressions humaines restent des références et un repli documenté, sans découpage ni collage de mots pour fabriquer d’autres phrases. Le personnage `any` permet de partager une référence pour Lova et Mia sans prétendre fournir deux genres de voix.

La demande du 27 octobre donne la priorité à une banque de **phrases synthétisées en malgache**, préparées hors ligne puis servies statiquement. La banque MMS actuelle contient 52 énoncés distincts issus des dialogues et des sélections malgaches, soit 2 165 232 octets de WAV mono 16 kHz. Le modèle reste monolocuteur. À la demande explicite de l’utilisateur, 51 variantes relèvent le timbre de Mia de deux demi-tons à tempo inchangé, sans revendiquer une seconde voix féminine native. Azafady seul privilégie la référence humaine intacte pour corriger la synthèse signalée comme fautive. La génération n’est pas un appel TTS payant à chaque visite et n’impose aucun compte Cloud au joueur.

`scripts/generate-malagasy-mms.mjs` charge un runtime auteur isolé dans `.tools/mms-runtime`, garde les poids FP32 dans `.tools/mms-cache`, extrait les phrases complètes et écrit le manifeste public ainsi que le registre TypeScript. Les fichiers existants sont conservés si leurs transcriptions et empreintes correspondent ; un changement de texte doit être suivi d’une régénération et des tests de couverture. Les ellipses de réponse ne sont pas prononcées comme une phrase remplie.

`DialogueAudioPlayer` garde une seule lecture active. Sa synchronisation mémorise les tours déjà visibles pour éviter les reprises dues aux rerendus ; une relecture manuelle annule la file précédente. Un changement de contexte, le muet ou la sortie d’une leçon arrête les fichiers. Le blocage de lecture automatique par le navigateur est distinct d’un fichier illisible et permet une reprise manuelle.

Les références `published-pronunciation` sont documentées par leur publication et leur transcription ; elles ne sont pas rebaptisées `native-speaker-reviewed` sans contrôle linguistique réalisé. Une sortie de modèle reste identifiée `synthetic` / `model-generated`, distincte d’un fichier validé pour une évaluation d’écoute. Le lecteur de dialogue ne met pas à jour la maîtrise orale. Les liens de licence, notamment la restriction non commerciale de MMS, et la couverture apparaissent seulement dans « Sources & crédits ».

La lecture utilise les fichiers locaux sans secret ni appel TTS à l’exécution. Le script Cloud reste un outil facultatif de préparation : ses sorties sont des brouillons `pending`. La banque numérique locale peut diffuser des sorties explicitement synthétiques sans les déclarer validées par un enseignant. Voir [MALAGASY_VOICES.md](MALAGASY_VOICES.md).

`spoken-selections.ts` expose les sélections explicitement marquées malgaches (`selectionLanguage` / `spokenSelections`). `recordingForSelection` recherche leur fichier entier ; le clic passe par le même lecteur interruptible que les dialogues. Un choix français reste silencieux ; une mauvaise sélection malgache est lue sans être validée automatiquement.

## Sauvegarde et sécurité d’import

Le format courant est `schemaVersion: 1`. Il contient les paramètres, XP, leçons terminées, récompenses déjà accordées, concepts, dates d’activité, succès et historique borné. La clé locale est `afterhours.malagasy.progress.v1` ; aucun autre jeu ne partage cet état.

`parseSave` refuse les versions inconnues, les objets mal formés, les clés de prototype, les dates invalides, les valeurs numériques incohérentes et les références absentes du contenu courant. L’objet final est reconstruit. Le stockage est derrière l’interface `SaveStorage` (`getItem`/`setItem`) pour permettre plus tard un autre adaptateur.

Si la sauvegarde locale est illisible, `loadProgress` conserve son texte original dans `afterhours.malagasy.progress.v1.recovery` avant de proposer un état neuf en mémoire. Cette copie, limitée à 2 millions de caractères, reste disponible via `loadRecovery` et n’est jamais remplacée automatiquement par une erreur ultérieure. Si le stockage est inaccessible ou saturé, l’application signale sa limite ; le fichier original reste intact tant qu’aucune nouvelle sauvegarde ne réussit.

La validation du contenu vérifie chaque leçon contre la fermeture de ses propres prérequis, indépendamment du parcours global : une notion apprise dans une branche facultative ne peut pas être présumée connue dans une autre branche.

Il n’existe pas encore de migration entre deux versions, puisque seul le schéma v1 existe. Ajouter une migration explicite avant d’accepter un ancien schéma. La sauvegarde locale n’est pas un mécanisme anti-triche et ne remplace pas un futur compte synchronisé.

La vue de sauvegarde permet de télécharger cette copie pour examen ; elle n’est pas automatiquement réparée ni présentée comme importable.

## Extensions

- **Nouvelle unité/monde** : seulement après nouvelle demande d’extension du périmètre actuel. Ajouter les dialogues, données et sources, vérifier les prérequis et le quiz, puis passer `implemented` à vrai. Voir [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
- **Nouveau type d’exercice** : étendre `ExerciseType`, enregistrer son validateur dans `exerciseValidators` et son rendu dans `EXERCISE_RENDERERS`, ajouter la validation de configuration et un test comportemental.
- **Enregistrement linguistique** : ajouter une entrée `AudioAsset` documentée, une transcription entière et son degré de contrôle linguistique, puis la référence d’une réplique. Vérifier la licence avant diffusion. Une écoute notée exige un fichier validé adapté et ne se déduit pas de la seule disponibilité d’une référence de dialogue.
- **Compte distant** : implémenter un adaptateur de stockage et une stratégie de conflit ; ne pas confondre les identifiants de contenu et ceux d’un utilisateur.

## Construction et hébergement

`npm run build` exécute TypeScript puis Vite et produit `dist/`. Les fichiers statiques restent compatibles avec `netlify.toml` et `public/_redirects`. Aucun serveur applicatif, secret ou appel d’IA n’est requis à l’exécution. Les liens de sources sont visibles uniquement dans « Sources & crédits », dont le registre est partagé avec le contenu. Aucun déploiement n’est impliqué par une simple modification locale du dépôt.

Les contrôles dédiés se trouvent dans `tests/malagasy-engine.test.ts` et les tests navigateur de `e2e/`. Vérifier leur résultat à chaque extension au lieu de considérer ce document comme une attestation de tests passés.
