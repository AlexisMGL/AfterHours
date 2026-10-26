# Malagasy Adventure — livraison du 25 octobre 2026

> Rapport historique de la première livraison. La refonte du 26 octobre conserve le périmètre de trois unités mais remplace une partie de cette présentation et augmente le corpus : voir [le compte rendu actuel](MALAGASY_REFINEMENT.md). Les nombres et vérifications ci-dessous décrivent la version du 25 octobre.

## Ouvrir l’application

Depuis la racine, lancer `start-local.cmd`, puis ouvrir **http://127.0.0.1:5173/malagasy-adventure**. La quatrième carte du catalogue `/` ouvre la même app. Les trois jeux précédents conservent leurs routes et leurs fonctionnalités.

Le build final est disponible dans `dist/`. Il reste compatible avec la configuration Netlify existante. Aucun push Git ni déploiement public n’a été effectué.

## Périmètre réellement livré

| Élément | État |
| --- | --- |
| Unités jouables | 3 : salutations et politesse ; présentation et origine ; premières phrases |
| Leçons | 9 : deux découvertes/scènes et un bilan obligatoire par unité |
| Activités rédigées | 54, avec réponses acceptées, explications, concepts et sources |
| Formats écrits | 7 : choix, associations, mots à ordonner, texte à compléter, traduction, lecture, dialogue guidé |
| Concepts suivis | 18 |
| Fiches de lexique | 21, recherchables et reliées aux sources |
| Parcours futur | 12 unités prévues au monde 1 ; 20 mondes avec objectifs lexicaux, grammaticaux et pratiques |
| Contenu futur | Unités 4–12 et mondes 2–20 explicitement en préparation et verrouillés |
| Sources | 14 entrées dans le registre, avec statut et portée de consultation précisés |
| Audio linguistique | Aucun enregistrement distribué ; aucune activité d’écoute ou prononciation notée |

Les séances ordinaires utilisent un mélange cumulatif de la banque rédigée : un passage de neuf leçons ne garantit donc pas de voir les 54 activités distinctes. Les bilans utilisent leurs activités dédiées. Le Centre de révision permet de retrouver les notions déjà rencontrées.

## Fonctionnement

- **Parcours** : déblocage par prérequis, leçons ordinaires à 60 % et bilans à 80 %. Les unités futures ne sont pas comptées comme terminées.
- **Révision** : pondération configurable 55 % courant / 25 % acquis antérieurs / 20 % échéances ou faiblesses, avec adaptation aux banques disponibles. Aucune notion inconnue n’est sélectionnée.
- **Maîtrise** : compteurs indépendants des XP, erreurs et historique, échéances déterministes de 1/3/7/14/30 jours. Plusieurs journées de réussite sont nécessaires au statut maîtrisé. Une erreur historique ne pénalise plus indéfiniment une notion redevenue maîtrisée.
- **Progression** : XP sur la première réussite d’un exercice et première validation d’une leçon ; niveaux, série d’activité, objectif quotidien, trois succès et statistiques.
- **Sauvegarde** : enregistrement local automatique, export JSON, aperçu d’import et confirmation avant remplacement, validation stricte v1. Une première sauvegarde locale illisible est conservée séparément et téléchargeable pour examen.
- **Présentation** : carnet de voyage en français, illustrations SVG originales, navigation clavier et tactile, dialogues accessibles, mobile et préférence de mouvement réduit. Aucun média ou service distant n’est requis à l’exécution.
- **Audio préparé** : manifeste typé, lecture/pause/reprise/relecture/vitesse lente, messages de chargement/erreur et blocage des réponses d’écoute avant lecture complète. Aucun enregistrement vérifié n’étant intégré, ces interactions ne sont pas proposées dans le corpus livré. Les effets de réponse sont synthétisés localement et peuvent être coupés.

## Sources et faisabilité linguistique

Le petit manuel institutionnel Peace Corps, le dictionnaire malgache, le travail universitaire de Keenan sur les langues à sujet final et la grammaire historique de Parker fournissent une base traçable pour ces trois unités. Les références historiques sont identifiées comme telles ; les miroirs d’une même ressource ne sont pas présentés comme des confirmations indépendantes.

Le contenu distingue notamment `ny` des articles français, `tsy` de `tsia`, le prédicat d’un verbe, et la formule du nom avec `no` d’une copule française. Les exercices et explications sont des créations originales. Les variantes acceptées sont déclarées explicitement : par exemple `Azafady` / `Aza fady`.

La faisabilité du prototype est étayée ; celle d’une formation complète de vingt mondes demande encore une validation pédagogique progressive. **Les phrases composées, dialogues et nuances de politesse nécessitent une relecture par un enseignant malgachophone.** Aucune validation native ou certification de niveau n’est revendiquée. Aucun fichier sonore n’a été copié sans droits vérifiés. Voir [les sources et leurs limites](LANGUAGE_SOURCES.md).

## Fichiers et architecture

Créés : `src/malagasy/{types,worlds,content,engine,storage,exercise-view,audio,art,main}.ts`, `src/malagasy/style.css`, `tests/malagasy-engine.test.ts`, `e2e/malagasy.spec.ts` et les documents liés ci-dessous.

Modifiés : `src/main.ts` pour la route chargée à la demande, `src/arcade.ts` et `src/arcade.css` pour la quatrième carte et sa grille, `e2e/traffic.spec.ts` pour le nouveau nombre de cartes, `README.md` pour l’utilisation et l’extension. Aucun moteur des trois jeux précédents ni aucune dépendance/configuration d’hébergement n’a été changé.

Les contenus, algorithmes, vues et données persistées sont séparés. Les IDs stables et registres permettent d’ajouter des unités principalement par leurs données. Un nouveau format d’exercice ajoute son type, son rendu, son validateur et ses contrôles de configuration.

- [Architecture](ARCHITECTURE.md)
- [Curriculum et scénario de progression sur six mois](CURRICULUM.md)
- [Guide de création du contenu](CONTENT_GUIDE.md)
- [Moteur de révision](REVIEW_ENGINE.md)
- [Sources linguistiques](LANGUAGE_SOURCES.md)
- [Feuille de route](ROADMAP.md)

## Vérifications finales

| Contrôle | Résultat |
| --- | --- |
| `npm run test` | **304 tests réussis**, 11 fichiers, dont 17 tests du moteur Malagasy |
| `npm run test:e2e` | **45 tests Chromium réussis**, dont 9 Malagasy ; passage final complet sans échec ni relance |
| `npm run build` | **Réussi** : TypeScript strict et Vite, sortie statique `dist/` |
| Contrôle du build servi par HTTP | Catalogue à 4 cartes ; lancement et rechargement des 4 routes, avec/sans slash final ; carte à 20 destinations ; première réponse correcte ; mobile sans débordement ; aucune erreur console ni requête échouée |
| Mobile | Toutes les vues et une leçon réellement parcourue sur 340 et 390 px |
| Données | Validation des références, prérequis par branche, parcours complet des 9 leçons, maîtrise, mélange, plafonds XP, import/export et récupération après corruption |

Le contrôle navigateur concerne Chromium. Safari/Firefox et la lecture de futurs fichiers audio natifs n’ont pas été validés. L’avertissement de taille du chunk Phaser concerne les jeux existants et n’empêche pas le build ; l’app d’apprentissage ne le charge pas.

## Suite conseillée

1. Faire relire les trois unités et conserver les corrections dans le registre de contenu.
2. Obtenir un premier lot d’enregistrements natifs autorisés, transcrits et contrôlés ; ajouter ensuite des écoutes et leurs tests réels.
3. Ajouter les unités 4–6 — famille, maison et repas — avec possession et descriptions, en réutilisant les premiers acquis.

Pas de compte, synchronisation cloud, reconnaissance vocale, tuteur génératif, monde 1 complet ou promesse de fluidité en six mois dans cette livraison.
