# Malagasy Adventure — état et suite

## Livraison actuelle

Le dépôt intègre une quatrième app au catalogue Afterhours, compatible avec la construction statique Vite/Netlify. Le parcours jouable couvre les **trois premières unités du premier monde**. Le reste des douze unités de ce monde et les dix-neuf autres mondes sont planifiés et affichés comme futurs.

Les fondations comprennent des modèles typés, des références stables, un registre de concepts et de sources, des exercices écrits variés, des bilans, un mélange cumulatif, une maîtrise distincte des XP, une planification espacée déterministe et une sauvegarde locale avec export/import JSON validé. La carte, le lexique, les révisions et les statistiques rendent cette structure inspectable.

La refonte dialoguée conserve neuf leçons et introduit 24 scènes de Lova et Mia, 72 activités écrites et trois quiz finaux de douze questions. Les traductions et aides sont facultatives. De courtes réactions cartoon, un son de succès à deux notes et une clôture d’unité rendent la progression plus perceptible. La carte utilise désormais un vrai littoral Natural Earth et une projection commune aux escales. Les 16 sources sont regroupées uniquement dans les crédits ; les IDs restent internes au contenu.

[Le fichier propre aux futurs agents](../src/malagasy/AGENTS.md) conserve la vision initiale et les nouveaux choix produit. [Le compte rendu de la refonte](MALAGASY_REFINEMENT.md) décrit les changements et accueille les résultats de vérification de cette version.

Les notes de sources et les limites de validation linguistique sont détaillées dans [LANGUAGE_SOURCES.md](LANGUAGE_SOURCES.md). Les résultats effectifs des tests et le nombre exact d’activités sont à vérifier dans la livraison et le rapport de validation, pas à déduire de l’objectif initial de 20 mondes.

## Limites connues

- Seules trois unités sont disponibles ; le monde 1 complet n’est pas livré.
- Les futurs objectifs et durées sont des estimations de conception, pas des cours déjà rédigés ni une promesse de niveau en six mois.
- L’authenticité des échanges, les nuances de registre et la prononciation demandent une relecture malgachophone.
- Les références linguistiques ouvertes ne constituent pas une autorisation de redistribuer leurs enregistrements. Sans audio vérifié et autorisé, l’écoute n’est pas évaluée.
- Aucun système de reconnaissance vocale, de correction automatique de prononciation, de compte ou de synchronisation distante n’existe.
- Les dialogues sont des scènes écrites guidées, sans tuteur conversationnel génératif.
- La maîtrise est une heuristique locale. Les répétitions d’une même journée restent plafonnées avant le seuil de maîtrise ; plusieurs journées de rappel réussi sont nécessaires. Cette protection n’atteste pas une rétention durable.
- Le stockage navigateur peut disparaître lors d’un effacement ou d’un changement d’appareil. Utiliser l’export JSON pour conserver une copie.
- Les sauvegardes ne sont pas signées ; elles ne constituent pas une protection anti-triche pour un éventuel classement.
- La carte utilise des points approximatifs pour un itinéraire pédagogique ; elle ne sert pas à se déplacer ni à décrire les limites administratives.

## Ordre de développement conseillé

1. **Faire relire les trois unités** par un malgachophone compétent en enseignement du standard, conserver les remarques et corriger le corpus avant de l’étendre.
2. **Produire un premier lot audio autorisé** : salutations et présentations, transcription, interprète, variété linguistique, permission et contrôle de qualité. Ajouter ensuite de vraies écoutes.
3. **Rester sur les unités 1–3 tant que l’utilisateur maintient ce périmètre** : affiner dialogues, retours, mémorisation et lisibilité à partir des essais réels.
4. **Après une nouvelle demande d’extension**, ajouter les unités 4–6 (famille, maison, aliments), puis 7–12 et le défi final. Vérifier possession, terminologie familiale et constructions spatiales ; réutiliser les premiers acquis.
5. **Mesurer la rétention** et améliorer le modèle de maîtrise, notamment la séparation de séances espacées et la diversité des modes de rappel.
6. **Développer les mondes 2–5**, puis réaliser le premier bilan de conversation, avant de produire les niveaux ultérieurs en série.
7. Envisager des comptes et une synchronisation uniquement après validation de la pédagogie et d’un besoin réel. Prévoir alors migration de sauvegarde et résolution de conflits.

## Exemples de demandes pour continuer

> Fais un audit linguistique des unités 1–3. Vérifie chaque réponse et alternative, indique les formulations incertaines et ne change pas les IDs persistants sans migration.

> Intègre ces enregistrements natifs et leurs permissions au manifeste audio. Ajoute des écoutes testées, garde un comportement honnête si un fichier ne peut pas être joué et vérifie le mobile.

> Ajoute les unités 4–6 au même moteur, avec références réellement consultées, bilans de révision cumulative et tests de contenu/déblocage. Conserve les trois jeux existants.

> Complète le monde 1 et crée un défi final contextualisé, puis vérifie le parcours complet, les sauvegardes existantes et la construction Netlify.
