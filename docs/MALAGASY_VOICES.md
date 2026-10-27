# Voix malgaches — banque locale et contrôle de prononciation

Le lecteur de dialogue utilise des fichiers de langue identifiés dans le manifeste de l’app. Il ne doit jamais remplacer un fichier manquant par une voix française/anglaise du navigateur, ni présenter une sortie de synthèse comme une prononciation certifiée.

La demande utilisateur du **27 octobre 2026** est de faire réciter les dialogues par une **voix numérique malgache**, afin de couvrir les phrases entières et de donner de la vie aux leçons. Elle remplace le choix intermédiaire de se limiter aux huit références humaines disponibles. Aucun modèle ne garantit ici que chaque syllabe, nom propre et intonation sera toujours correcte ; une relecture malgachophone reste nécessaire pour valider la prononciation.

Une voix masculine et une voix féminine sont souhaitables si le modèle fournit réellement deux voix de qualité. Le modèle MMS malgache expose un seul locuteur : ne pas modifier artificiellement sa hauteur ni annoncer deux voix distinctes sur cette base.

## Génération locale de phrases entières

La piste mise en œuvre pour ne pas demander de compte Cloud utilise le modèle malgache [facebook/mms-tts-mlg](https://huggingface.co/facebook/mms-tts-mlg), avec sa [conversion ONNX](https://huggingface.co/elloza/mms-tts-mlg-onnx). La [configuration originale](https://huggingface.co/facebook/mms-tts-mlg/raw/main/config.json) indique `num_speakers: 1` et un échantillonnage de 16 kHz. La conversion ne transforme pas ce modèle monolocuteur en une paire masculine/féminine.

La banque générée contient **35 énoncés complets distincts**, stockés dans `public/malagasy/voices/mms/` : 1 691 076 octets de WAV mono 16 kHz, avec métadonnées dans `manifest.json` et registre de lecture dans `src/malagasy/synthetic-voices.ts`. Les mêmes énoncés sont partagés entre les personnages sans dupliquer les fichiers. Ce lot est monolocuteur ; il ne constitue pas deux voix de genres différents.

Chaque phrase complète a été synthétisée pendant la préparation du contenu ; le manifeste conserve le modèle, sa révision, l’empreinte de ses poids, le texte, le volume appliqué et l’empreinte de chaque fichier. Le modèle n’a pas à être téléchargé par chaque joueur et aucune clé, session Cloud ou génération payante à la lecture n’est nécessaire. La même procédure peut régénérer la banque lorsque de nouvelles phrases sont rédigées.

Le modèle MMS est sous **CC BY-NC 4.0**, avec restriction d’usage commercial. Cette licence et la provenance de la conversion doivent être conservées dans les crédits et les métadonnées ; aucune permission commerciale n’est revendiquée. Les poids de génération restent dans les outils locaux, pas dans le bundle de navigation de l’app.

Une sortie diffusée comme `synthetic` avec la provenance `model-generated` est une voix générée, **pas une prononciation validée par un locuteur natif**. `pending` reste réservé aux brouillons non activés ; `native-speaker-reviewed` ne peut être attribué qu’après une relecture réellement réalisée. Les contrôles de décodage, d’amplitude et de durée ne suffisent pas à changer ce statut linguistique.

Les 35 fichiers ont été effectivement produits ; leur couverture et leur lecture restent à distinguer d’une validation linguistique. Les blancs d’exercice et les phrases à points de suspension ne sont pas synthétisés comme des réponses complétées. Les mots cités pour expliquer la grammaire conservent leurs guillemets dans la transcription de l’app ; le modèle prononce le mot sans lire ces marques typographiques, sans prétendre qu’un pronom isolé devient une réplique naturelle.

## Régénérer la banque MMS

Depuis la racine du dépôt :

```powershell
npm install --prefix .tools/mms-runtime @huggingface/transformers@3.8.1
node scripts/generate-malagasy-mms.mjs
```

Le runtime auteur est installé dans `.tools/`, ignoré par Git, sans ajouter de dépendance au site de production. Le modèle FP32 est téléchargé dans `.tools/mms-cache` et son empreinte est vérifiée. Le bundle Netlify ne contient pas ces poids ; il sert les petits fichiers WAV déjà générés.

Le générateur extrait l’inventaire des dialogues actuels depuis `CONTENT`, déduplique les transcriptions identiques et produit une phrase entière par fichier. Il garde les fichiers dont le texte et l’empreinte correspondent au manifeste précédent. `--force` demande leur régénération. Après une modification du contenu, régénérer puis exécuter les tests de couverture et de lecture ; ne pas déclarer les nouvelles phrases couvertes sur le seul fait qu’elles sont présentes dans un plan JSON.

## Lecture dans l’app

Le lecteur lance une nouvelle réplique couverte après une action du joueur et propose un bouton haut-parleur pour la rejouer, ainsi qu’une lecture lente. Le rerendu d’un choix, l’ouverture d’une traduction ou le retour du son ne doit pas provoquer de répétition automatique. Le muet et la sortie d’une scène annulent la lecture ; la relecture d’une bulle interrompt proprement la voix précédente.

La correspondance porte sur le texte complet. Aucun mot enregistré n’est découpé ou recollé pour fabriquer une phrase. Si le navigateur bloque l’autoplay, le bouton haut-parleur permet une nouvelle tentative explicite ; les exercices restent utilisables si la lecture échoue.

Les exercices écrits ne deviennent pas des évaluations d’écoute parce qu’une voix est jouée. Le moteur de maîtrise orale reste séparé de ce lecteur d’accompagnement.

## Références humaines conservées

Huit enregistrements originaux sont déjà intégrés : `Salama`, `Misaotra`, `Veloma`, `Azafady`, `Tonga soa`, `Tompoko`, `Eny` et `Tsia`. Leur provenance, leurs interprètes et leurs licences sont détaillés dans [MALAGASY_AUDIO_SOURCES.md](MALAGASY_AUDIO_SOURCES.md). Ils peuvent servir de références et de repli pour leur texte exact ; ils ne bornent plus l’ambition de couverture des dialogues.

Le statut `published-pronunciation` documente leur publication, pas une nouvelle validation linguistique réalisée pour ce projet. Aucun genre n’est déduit d’un pseudonyme et aucun couple de voix masculine/féminine n’est annoncé sur la base de ces fichiers.

## Inventaire des répliques

Le plan `src/malagasy/voice-plan.json` conserve un inventaire par personnage pour une séance d’enregistrement humain ou une préparation Cloud éventuelle. Il est distinct de l’inventaire MMS calculé directement depuis les dialogues : les ellipses et les citations métalinguistiques ne font pas partie de ce plan de répliques de personnages.

```json
{
  "schemaVersion": 1,
  "recordings": [
    {
      "id": "voice.lova.salama",
      "character": "lova",
      "text": "Salama!",
      "filename": "lova/salama.wav",
      "voice": "Puck"
    }
  ]
}
```

`voice` est facultatif. Pour la préparation Cloud, Lova utilise par défaut Puck et Mia utilise Kore. Cette attribution n’atteste ni l’accent ni la qualité malgache de la voix générée.

Depuis la racine, avec Node.js 22 ou plus récent :

```powershell
node scripts/malagasy-voices.mjs inventory
node scripts/malagasy-voices.mjs inventory --out-dir .tools/malagasy-recording-checklist
```

La première commande affiche l’inventaire sans réseau ni identifiant. La seconde crée un manifeste `pending` dans un dossier vide. Le script refuse les noms de fichier qui sortent du dossier prévu, les doublons et les répliques incomplètes.

## Piste de synthèse future, non activée

La [documentation officielle Cloud Text-to-Speech Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts), consultée le 26 octobre 2026, liste **mg-MG en Preview**, ainsi que les voix **Puck masculine** et **Kore féminine**. Le workflow utilise l’API Cloud Text-to-Speech, avec `gemini-2.5-pro-tts` par défaut. Il ne passe pas par une clé exposée dans la page web.

Les services et modèles ne sont pas interchangeables : la [page actuelle de l’API Gemini de synthèse](https://ai.google.dev/gemini-api/docs/speech-generation) décrit notamment Gemini 3.8 et une autre API, avec une liste de langues différente qui ne mentionnait pas le malgache lors de la consultation. Un ancien résultat de recherche annonçant `mg` ne suffit pas à vérifier le service réellement utilisé. Vérifier à nouveau la couverture avant de changer de modèle ou de fournisseur.

Le script suit la [requête REST Cloud `text:synthesize`](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize). L’API renvoie un fichier WAV pour l’encodage `LINEAR16` ; le script contrôle le conteneur, les données PCM mono 16 bits à 24 kHz et les limites de taille. Ces contrôles techniques ne valident pas la langue.

Ce workflow reste une alternative de préparation éventuelle pour une personne disposant déjà d’un compte adapté. Il n’est pas nécessaire à la génération locale MMS et n’est pas exécuté par le navigateur du joueur.

## Générer uniquement des brouillons

Il faut un projet Google Cloud configuré pour ce service, les droits requis et des identifiants locaux. La disponibilité, les quotas et les coûts sont ceux du compte Google utilisé ; aucun appel au fournisseur n’a été nécessaire pour tester l’inventaire ou le lecteur.

Exemple pour une personne disposant déjà d’un environnement Google Cloud authentifié :

```powershell
$env:GOOGLE_CLOUD_PROJECT = 'votre-projet-google-cloud'
$env:GOOGLE_CLOUD_ACCESS_TOKEN = (gcloud auth application-default print-access-token)
node scripts/malagasy-voices.mjs generate --provider google-cloud --out-dir .tools/malagasy-voice-drafts --limit 2
Remove-Item Env:GOOGLE_CLOUD_ACCESS_TOKEN
```

Ne jamais coller ce jeton dans une conversation, un fichier suivi par Git ou le frontend. Le script lit seulement les deux variables d’environnement et n’affiche ni jeton ni corps d’erreur du fournisseur.

Options disponibles :

- `--plan chemin.json` : choisir le plan ; celui de l’app est utilisé par défaut.
- `--id identifiant` : préparer une seule réplique.
- `--limit 2` : limiter le lot avant d’évaluer une voix.
- `--model gemini-2.5-flash-tts` : choisir l’un des modèles Cloud documentés dans le script.
- `--out-dir dossier-vide` : conserver les fichiers et le manifeste de brouillons séparément de `public/`.

La génération est séquentielle ; une limitation temporaire ou un HTTP 503 est réessayé une seule fois. Un dossier non vide est refusé pour préserver les fichiers déjà contrôlés. En cas d’arrêt, les fichiers déjà obtenus et leur manifeste restent disponibles pour examen.

**Tous les fichiers produits par cet outil Cloud restent `pending`.** Ce script facultatif ne modifie pas le manifeste de lecture de l’app, n’écrit pas dans `public/` par défaut et ne propose pas de commande qui transforme automatiquement un brouillon en fichier vérifié. Le champ `generated` indique seulement qu’un fichier a été reçu. Cette règle de brouillons Cloud est distincte de la banque MMS diffusée explicitement avec le statut `synthetic`.

## Relecture et activation d’une réplique

1. Comparer le texte exact du plan à l’enregistrement complet : aucun mot ajouté, omis ou traduit.
2. Faire contrôler les sons, l’accentuation, le rythme, la naturalité et les noms propres par une personne compétente en malgache standard. Corriger ou réenregistrer les fichiers incertains.
3. Pour une voix humaine, conserver le consentement de l’interprète et les droits de diffusion ; pour une synthèse, vérifier les conditions de son fournisseur. Une page accessible n’autorise pas automatiquement sa redistribution.
4. Conserver l’identité de la personne qui relit, la date, la transcription, la provenance et l’autorisation avec le fichier. Les empreintes SHA-256 du manifeste de brouillons permettent d’identifier le fichier réellement écouté.
5. Après une relecture linguistique effective, conserver son identité et son résultat avant d’attribuer `native-speaker-reviewed`. Une sortie synthétique peut être distribuée explicitement comme telle dans la banque numérique, avec ses contrôles techniques, sa provenance et ses limites ; elle ne devient pas pour autant une référence native vérifiée.

Ne pas assembler des enregistrements de mots isolés pour faire croire à une phrase native : rythme, liaisons et prosodie peuvent changer. Ne pas combler un fichier synthétique absent par une voix française/anglaise. L’objectif de couverture des dialogues doit être vérifié sur la banque générée et ses limites expliquées honnêtement dans les crédits.

Les références et attributions restent dans « Sources & crédits ». Les bulles de dialogue proposent seulement le lecteur et les informations nécessaires à son usage.

## Tests de l’outil

```powershell
node --test scripts/malagasy-voices.test.mjs
```

Ces tests couvrent l’inventaire en attente de contrôle, les fichiers et IDs invalides, le format WAV, la relance bornée et l’absence de fuite de jeton dans les erreurs. Le réseau est simulé : ils ne prétendent pas valider l’accent d’un fournisseur ni l’accès à un compte Cloud réel.

## Vérification finale du 27 octobre 2026

| Contrôle | Résultat |
| --- | --- |
| Banque effectivement produite | **35 fichiers WAV**, 1 691 076 octets, 52,798 secondes de voix numérique ; toutes les répliques complètes des scènes et activités sont couvertes. Les blancs et phrases incomplètes restent volontairement sans lecture. |
| `npm run test` | **331 tests réussis** dans 16 fichiers, dont les contrôles de lecture, d’annulation, de provenance et de couverture de la banque numérique. |
| `npm run test:e2e` | **59 tests Chromium réussis**, sans échec ni relance ; les six scénarios vocaux utilisent les vrais fichiers et le vrai lecteur du navigateur. |
| `node --test scripts/malagasy-voices.test.mjs` | **5 tests réussis** pour l’outil Cloud facultatif ; aucun appel payant réel. |
| `npm run build` | **Réussi**, TypeScript strict puis Vite ; sortie statique Netlify dans `dist/`. |
| Build servi par HTTP | Lecture numérique automatique, haut-parleur de replay et décodage réel vérifiés ; mobile 390 px sans débordement ; aucune erreur console ; aucun téléchargement de modèle ou appel Cloud pendant la lecture. |

Les tests navigateur couvrent également lecture lente à 0,75×, file sans chevauchement, arrêt à la navigation et au muet, absence de répétition au rerendu, erreur de fichier récupérable et reprise manuelle après refus d’autoplay. Les trois autres expériences, les neuf leçons, les quiz et les sauvegardes restent testés.

Ces contrôles établissent le fonctionnement et la couverture technique, **pas une validation native de la prononciation**. Les fichiers restent `synthetic` / `model-generated`, avec une seule voix et les restrictions non commerciales du modèle. Aucun déploiement public ou push Git n’a été effectué.

Pour essayer : lancer `start-local.cmd`, puis ouvrir **http://127.0.0.1:5173/malagasy-adventure** et commencer ou rejouer une partie du parcours. La voix accompagne les bulles ; le haut-parleur et le bouton 0,75× restent disponibles pour réécouter.

## Vérification navigateur du 27 octobre 2026

Les six tests dédiés de `e2e/malagasy-dialogue-voices.spec.ts` ont été exécutés sur les **véritables WAV MMS** servis localement, sans remplacer leur lecture. Ils vérifient le départ automatique après une action du joueur, le bouton de relecture, la vitesse 0,75×, la file sans chevauchement, l’arrêt à la navigation, le muet et l’absence de répétition liée aux rerendus. Deux scénarios contrôlent séparément l’échec d’un fichier et le refus d’autoplay par le navigateur, avec reprise manuelle et maintien des exercices utilisables.

La suite Chromium complète a ensuite réussi **59 tests sur 59**, en un passage sans échec ni relance. Elle comprend ces six scénarios de voix, les effets sonores, le parcours des neuf leçons et trois quiz, les sauvegardes, les écrans mobiles et les trois jeux existants. Cela vérifie le fonctionnement du lecteur ; ce résultat ne remplace toujours pas une validation de la prononciation par un malgachophone.
