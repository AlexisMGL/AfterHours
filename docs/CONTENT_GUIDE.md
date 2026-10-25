# Malagasy Adventure — ajouter du contenu

## Contrat de publication

Le contenu vit dans `src/malagasy/content.ts` et les modules de données qu’il importe ; la présentation ne doit pas contenir les corpus. Les interfaces de `types.ts` sont le contrat. Les mondes planifiés se trouvent dans `worlds.ts`.

Un contenu est publiable lorsque ses références sont valides, ses concepts ont été présentés avant évaluation et ses réponses sont étayées par des sources réellement consultées. La quantité n’est pas un critère de qualité. Ne pas rendre une destination jouable simplement pour remplir la carte.

## Ajouter une unité et ses leçons

1. Choisir des identifiants stables et descriptifs. Ne jamais renommer un ID déjà livré sans migration des sauvegardes.
2. Ajouter ou vérifier chaque source dans `Content.sources`, avec URL directe, auteur, usage précis et statut de consultation. Les permissions d’un enregistrement ne se déduisent pas de son accès public.
3. Ajouter les concepts avec `introducedIn`, leurs prérequis et leurs sources. Un concept de grammaire désigne une capacité identifiable, pas une catégorie française imposée au malgache.
4. Ajouter les entrées de vocabulaire avec traduction, note de contexte et `conceptId`.
5. Créer les leçons : objectifs, notes, nouveaux concepts, concepts revus, exercices, prérequis et durée estimée. Les notes doivent expliquer ce que les exercices évalueront.
6. Ajouter l’unité et ses `lessonIds`, puis vérifier le rattachement de chaque leçon. Terminer par un bilan cumulatif de type `checkpoint`.
7. Exécuter le validateur de contenu et les tests. Passer l’unité à `implemented: true` seulement quand toutes ses leçons sont utilisables.

Un prérequis de leçon est un ID de leçon terminée. Un prérequis de concept est un ID de concept déjà présenté. Les prérequis des mondes constituent la planification des destinations. Ces trois graphes ne sont pas interchangeables.

## Exercices

Chaque exercice fournit : ID, type, consigne, question, réponses acceptées, explication, concepts, difficulté et sources. Selon le type :

| Type | Configuration |
| --- | --- |
| `choice`, `reading`, `dialogue`, `culture` | `choices` inclut toutes les réponses acceptées ; ajouter `context` pour un texte ou une scène. |
| `translate`, `cloze` | Déclarer explicitement les variantes dans `answers`. Ne pas accepter une phrase grammaticalement différente par similarité approximative. |
| `order` | `tokens` contient exactement les mots nécessaires à au moins une réponse acceptée ; la vue mélange les mots. |
| `match` | `pairs` contient des associations non ambiguës et des valeurs distinctes de chaque côté. Le validateur reçoit un dictionnaire gauche → droite. |
| `listening` | Mêmes données de réponse qu’un choix, plus un `audioId` pointant sur un enregistrement vérifié. |

La normalisation ignore la casse, les espaces superflus, les variantes typographiques d’apostrophe et la ponctuation finale courante. Elle conserve accents et distinctions de lettres. Déclarer d’autres formulations naturelles dans `answers` après vérification.

Un exercice peut porter plusieurs concepts. Toute la liste doit être déjà introduite ; une révision ne peut pas enseigner implicitement un vocabulaire futur. Les exercices de révision doivent réutiliser des acquis pertinents dans un contexte cohérent.

## Histoires et dialogues

Utiliser une leçon `kind: 'story'` avec des notes de mise en situation, puis des exercices `dialogue`/`reading` enchaînés. La narration française peut contextualiser l’arrivée du voyageur ; le texte malgache doit utiliser des constructions déjà présentées. Les scènes et personnages sont une fiction pédagogique, pas une transcription d’un locuteur. Le moteur actuel accompagne une succession d’étapes : un arbre narratif persistant demanderait une extension du schéma et des tests dédiés.

## Ajouter un monde

Compléter sa fiche dans `worlds.ts` : objectifs lexicaux, grammaticaux et pratiques, thème culturel, prérequis, durée et coordonnées approximatives pour la carte. Ajouter ensuite unités, leçons, concepts, exercices et sources. Tant que les leçons n’existent pas, conserver `implemented: false`. Un monde disponible et un monde terminé sont deux états distincts.

## Audio

Une entrée `AudioAsset` contient un ID stable, une URL locale de préférence, un `sourceId`, une transcription et un statut. Documenter l’auteur/interprète, la variété de langue et la permission de redistribution dans le registre des sources. Une fois la prononciation et le droit d’usage vérifiés, utiliser `status: 'verified'` et relier l’exercice ou le mot à cet ID.

L’absence de fichier ne doit pas être masquée par une voix française ou anglaise de synthèse. Ne pas attribuer de compétence d’écoute à un exercice devenu écrit. La reconnaissance vocale et l’évaluation automatique de prononciation ne sont pas implémentées.

## Validation avant livraison

`validateContent(CONTENT)` renvoie des erreurs détaillées : doublons, références absentes, cycles, réponses mal configurées, contenu vide, audio manquant et leçons inaccessibles. Son parcours simulé contrôle que les exercices ne comportent pas de concepts inconnus au moment où ils deviennent disponibles.

Exécuter depuis la racine :

```sh
npm run test -- tests/malagasy-engine.test.ts
npm run build
```

Puis vérifier dans le navigateur le parcours, les feedbacks, la saisie au clavier et sur mobile, le rechargement et l’import/export. Pour une extension du système de progression, lancer aussi les tests des autres expériences. Le validateur contrôle la structure et la cohérence de références ; il ne peut pas vérifier à lui seul la correction linguistique.
