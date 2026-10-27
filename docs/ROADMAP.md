# Malagasy Adventure — état et suite

## Livraison actuelle

Le dépôt intègre une quatrième app au catalogue Afterhours, compatible avec la construction statique Vite/Netlify. Le parcours jouable couvre les **trois premières unités du premier monde**. Le reste des douze unités de ce monde et les dix-neuf autres mondes sont planifiés et affichés comme futurs.

Les fondations comprennent des modèles typés, des références stables, un registre de concepts et de sources, des exercices écrits variés, des bilans, un mélange cumulatif, une maîtrise distincte des XP, une planification espacée déterministe et une sauvegarde locale avec export/import JSON validé. La carte, le lexique, les révisions et les statistiques rendent cette structure inspectable.

La refonte dialoguée conserve neuf leçons et introduit 24 scènes de Lova et Mia, 72 activités écrites et trois quiz finaux de douze questions. Les traductions et aides sont facultatives. De courtes réactions cartoon, un son de succès à deux notes et une clôture d’unité rendent la progression plus perceptible. La carte utilise désormais un vrai littoral Natural Earth et une projection commune aux escales. Les sources sont regroupées uniquement dans les crédits ; les IDs restent internes au contenu.

[Le fichier propre aux futurs agents](../src/malagasy/AGENTS.md) conserve la vision initiale et les nouveaux choix produit. [Le compte rendu de la refonte](MALAGASY_REFINEMENT.md) décrit les changements et accueille les résultats de vérification de cette version.

Les notes de sources et les limites de validation linguistique sont détaillées dans [LANGUAGE_SOURCES.md](LANGUAGE_SOURCES.md). Les résultats effectifs des tests et le nombre exact d’activités sont à vérifier dans la livraison et le rapport de validation, pas à déduire de l’objectif initial de 20 mondes.

Le premier lot humain conserve huit références publiées et leurs attributions. Le **nouveau choix utilisateur du 27 octobre** est d’entendre une voix numérique réciter les dialogues, pour ne pas dépendre d’enregistrements de chaque phrase. La banque MMS contient désormais 52 énoncés distincts (dialogues et sélections malgaches) générés localement, servis avec le site sans clé Cloud. Le modèle a un seul locuteur ; Mia reçoit un timbre relevé de deux demi-tons à tempo inchangé, suivant le dernier retour utilisateur. Azafady privilégie la référence humaine. Aucune paire native masculine/féminine ni prononciation certifiée n’est revendiquée. Le générateur réutilisable permet de préparer les futures phrases. Voir [MALAGASY_AUDIO_SOURCES.md](MALAGASY_AUDIO_SOURCES.md) et [MALAGASY_VOICES.md](MALAGASY_VOICES.md).

## Limites connues

- Seules trois unités sont disponibles ; le monde 1 complet n’est pas livré.
- Les futurs objectifs et durées sont des estimations de conception, pas des cours déjà rédigés ni une promesse de niveau en six mois.
- L’authenticité des échanges, les nuances de registre et la prononciation demandent une relecture malgachophone.
- Les huit enregistrements humains ont une provenance et des licences documentées, mais aucune prononciation parfaite ou nouvelle relecture native n’est revendiquée. Une sortie de synthèse reste identifiée comme générée ; ni la prise en charge du malgache ni un test audio ne certifient sa prononciation.
- Le modèle MMS malgache est monolocuteur et sous CC BY-NC 4.0. Ne pas annoncer une paire de voix masculine/féminine ou une autorisation commerciale sur cette base. La banque et sa couverture doivent correspondre aux fichiers effectivement produits, pas seulement au plan de génération.
- Les références linguistiques ouvertes ne constituent pas une autorisation générale de redistribuer leurs enregistrements. L’accompagnement sonore des dialogues ne valide pas une compétence d’écoute ou de prononciation.
- Aucun système de reconnaissance vocale, de correction automatique de prononciation, de compte ou de synchronisation distante n’existe.
- Les dialogues sont des scènes écrites guidées, sans tuteur conversationnel génératif.
- La maîtrise est une heuristique locale. Les répétitions d’une même journée restent plafonnées avant le seuil de maîtrise ; plusieurs journées de rappel réussi sont nécessaires. Cette protection n’atteste pas une rétention durable.
- Le stockage navigateur peut disparaître lors d’un effacement ou d’un changement d’appareil. Utiliser l’export JSON pour conserver une copie.
- Les sauvegardes ne sont pas signées ; elles ne constituent pas une protection anti-triche pour un éventuel classement.
- La carte utilise des points approximatifs pour un itinéraire pédagogique ; elle ne sert pas à se déplacer ni à décrire les limites administratives.

## Ordre de développement conseillé

1. **Faire relire les trois unités** par un malgachophone compétent en enseignement du standard, conserver les remarques et corriger le corpus avant de l’étendre.
2. **Donner une voix numérique aux dialogues** : préparer les phrases entières avec le modèle malgache, vérifier la couverture, le décodage, le volume et l’absence de silence, puis faire relire la prononciation et les noms propres. Garder l’outil de génération réutilisable pour les futures phrases et les références humaines comme comparaison. Chercher deux voix distinctes seulement si elles sont réellement disponibles et de qualité ; le traitement de hauteur demandé pour Mia reste présenté comme un timbre du même modèle, sans revendiquer une deuxième locutrice native. Ajouter ensuite des exercices d’écoute adaptés et testés.
3. **Rester sur les unités 1–3 tant que l’utilisateur maintient ce périmètre** : affiner dialogues, retours, mémorisation et lisibilité à partir des essais réels.
4. **Après une nouvelle demande d’extension**, ajouter les unités 4–6 (famille, maison, aliments), puis 7–12 et le défi final. Vérifier possession, terminologie familiale et constructions spatiales ; réutiliser les premiers acquis.
5. **Mesurer la rétention** et améliorer le modèle de maîtrise, notamment la séparation de séances espacées et la diversité des modes de rappel.
6. **Développer les mondes 2–5**, puis réaliser le premier bilan de conversation, avant de produire les niveaux ultérieurs en série.
7. Envisager des comptes et une synchronisation uniquement après validation de la pédagogie et d’un besoin réel. Prévoir alors migration de sauvegarde et résolution de conflits.

## Exemples de demandes pour continuer

> Fais un audit linguistique des unités 1–3. Vérifie chaque réponse et alternative, indique les formulations incertaines et ne change pas les IDs persistants sans migration.

> Régénère la banque numérique après modification des dialogues, vérifie sa couverture et fais relire la prononciation sans changer les IDs persistants. Teste lecture automatique, relecture, vitesse et muet ; conserve les limites de qualité et de licence dans les crédits.

> Ajoute les unités 4–6 au même moteur, avec références réellement consultées, bilans de révision cumulative et tests de contenu/déblocage. Conserve les trois jeux existants.

> Complète le monde 1 et crée un défi final contextualisé, puis vérifie le parcours complet, les sauvegardes existantes et la construction Netlify.
