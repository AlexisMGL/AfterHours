# Malagasy Adventure — ajouter du contenu

## Contrat de publication

Le contenu vit dans `src/malagasy/content.ts` et les modules de données qu’il importe ; la présentation ne doit pas contenir les corpus. Les interfaces de `types.ts` sont le contrat. Les mondes planifiés se trouvent dans `worlds.ts`.

Lire d’abord [les consignes propres à l’app](../src/malagasy/AGENTS.md). Le périmètre reste les trois premières unités ; ajouter une unité suppose une nouvelle demande d’extension.

Un contenu est publiable lorsque ses références sont valides, ses concepts ont été présentés avant évaluation et ses réponses sont étayées par des sources réellement consultées. La quantité n’est pas un critère de qualité. Ne pas rendre une destination jouable simplement pour remplir la carte.

## Ajouter une unité et ses leçons

1. Choisir des identifiants stables et descriptifs. Ne jamais renommer un ID déjà livré sans migration des sauvegardes.
2. Ajouter ou vérifier chaque source dans `Content.sources`, avec URL directe, auteur, usage précis et statut de consultation. Les permissions d’un enregistrement ne se déduisent pas de son accès public.
3. Ajouter les concepts avec `introducedIn`, leurs prérequis et leurs sources. Un concept de grammaire désigne une capacité identifiable, pas une catégorie française imposée au malgache.
4. Ajouter les entrées de vocabulaire avec traduction, note de contexte et `conceptId`.
5. Créer les leçons : objectifs, scènes de découverte, notes facultatives, nouveaux concepts, concepts revus, exercices, prérequis et durée estimée. Le dialogue présente d’abord les expressions ; les notes ne sont pas une longue lecture préalable.
6. Ajouter l’unité et ses `lessonIds`, puis vérifier le rattachement de chaque leçon. Terminer par un quiz cumulatif complet de type `checkpoint` couvrant tous les concepts de l’unité ; les quiz actuels ont douze questions chacun.
7. Exécuter le validateur de contenu et les tests. Passer l’unité à `implemented: true` seulement quand toutes ses leçons sont utilisables.

Un prérequis de leçon est un ID de leçon terminée. Un prérequis de concept est un ID de concept déjà présenté. Les prérequis des mondes constituent la planification des destinations. Ces trois graphes ne sont pas interchangeables.

## Exercices

Chaque exercice fournit : ID, type, consigne, question, réponses acceptées, explication, concepts, difficulté et sources. Selon le type :

| Type | Configuration |
| --- | --- |
| `choice`, `reading`, `dialogue`, `culture` | `choices` inclut toutes les réponses acceptées ; utiliser `dialogue` pour la scène en bulles et garder la consigne courte. |
| `translate`, `cloze` | Déclarer explicitement les variantes dans `answers`. Ne pas accepter une phrase grammaticalement différente par similarité approximative. |
| `order` | `tokens` contient exactement les mots nécessaires à au moins une réponse acceptée ; la vue mélange les mots. |
| `match` | `pairs` contient des associations non ambiguës et des valeurs distinctes de chaque côté. Le validateur reçoit un dictionnaire gauche → droite. |
| `listening` | Mêmes données de réponse qu’un choix, plus un `audioId` pointant sur un enregistrement vérifié. |

La normalisation ignore la casse, les espaces superflus, les variantes typographiques d’apostrophe et la ponctuation finale courante. Elle conserve accents et distinctions de lettres. Déclarer d’autres formulations naturelles dans `answers` après vérification.

Un exercice peut porter plusieurs concepts. Toute la liste doit être déjà introduite ; une révision ne peut pas enseigner implicitement un vocabulaire futur. Les exercices de révision doivent réutiliser des acquis pertinents dans un contexte cohérent.

## Histoires et dialogues

Toutes les parties ordinaires (`learn` et `story`) commencent par `Lesson.scenes`. `dialogue-content.ts` contient actuellement quatre scènes par partie, soit vingt-quatre au total. Une `DialogueScene` possède un ID, un cadre très court, des `turns` et éventuellement un repère `takeaway`. Chaque tour fournit `speaker` (`lova` ou `mia`), texte malgache, traduction française et éventuel mot surligné.

La vue révèle les tours progressivement ; la traduction reste dans un dévoilement facultatif. Les nouveaux concepts n’entrent dans la progression qu’au passage à la pratique après ces scènes. Ne pas présenter toute une leçon comme « rencontrée » après son premier tour.

Chaque activité peut utiliser `Exercise.dialogue` pour prolonger l’échange. La question française reste une consigne courte, sans paragraphe technique préalable. Les notes de grammaire sont accessibles via une aide repliée. Les scènes et personnages sont fictifs, pas la transcription d’un locuteur ; un arbre narratif persistant demanderait encore une extension du schéma et des tests.

Les `sourceIds` sont obligatoires en interne. Les liens, attributions et limites documentaires sont affichés uniquement dans « Sources & crédits », jamais au fil de la conversation ou dans le feedback.

## Prononcer les sélections

Déclarer `selectionLanguage: 'mg'` lorsque les choix, les jetons ou la colonne gauche d’association sont tous malgaches. Pour une question mixte, fournir `spokenSelections` avec seulement les libellés malgaches exacts. Ne pas marquer les distracteurs français et ne pas déduire la langue de la bonne réponse. Régénérer la banque MMS puis les profils Mia avec les scripts documentés dans [MALAGASY_VOICES.md](MALAGASY_VOICES.md). Chaque sélection lue doit avoir son propre fichier entier ; ne pas assembler des extraits.

## Ajouter un monde

Compléter sa fiche dans `worlds.ts` : objectifs lexicaux, grammaticaux et pratiques, thème culturel, prérequis, durée et coordonnées approximatives pour la carte. Ajouter ensuite unités, leçons, concepts, exercices et sources. Tant que les leçons n’existent pas, conserver `implemented: false`. Un monde disponible et un monde terminé sont deux états distincts.

## Audio

Une entrée `AudioAsset` contient un ID stable, une URL locale de préférence, un `sourceId`, une transcription et un statut. Documenter l’auteur/interprète, la variété de langue et la permission de redistribution dans le registre des sources. Une fois la prononciation et le droit d’usage vérifiés, utiliser `status: 'verified'` et relier l’exercice ou le mot à cet ID.

L’absence de fichier ne doit pas être masquée par une voix française ou anglaise de synthèse. Ne pas attribuer de compétence d’écoute à un exercice devenu écrit. La reconnaissance vocale et l’évaluation automatique de prononciation ne sont pas implémentées.

## Validation avant livraison

`validateContent(CONTENT)` renvoie des erreurs détaillées : doublons, références absentes, cycles, réponses mal configurées, contenu vide, audio manquant et leçons inaccessibles. Son parcours simulé contrôle que les exercices ne comportent pas de concepts inconnus au moment où ils deviennent disponibles.

Les tests d’auteur de `tests/malagasy-dialogues.test.ts` contrôlent aussi les scènes, le dialogue de chaque activité et la couverture des quiz. Le littoral et la projection ont leurs contrôles dédiés dans `tests/malagasy-map.test.ts`. Les motifs sonores d’interface ont des tests navigateur séparés : ils ne constituent pas une validation de prononciation malgache.

Exécuter depuis la racine :

```sh
npm run test -- tests/malagasy-engine.test.ts
npm run build
```

Puis vérifier dans le navigateur le parcours, les feedbacks, la saisie au clavier et sur mobile, le rechargement et l’import/export. Pour une extension du système de progression, lancer aussi les tests des autres expériences. Le validateur contrôle la structure et la cohérence de références ; il ne peut pas vérifier à lui seul la correction linguistique.
