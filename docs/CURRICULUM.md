# Malagasy Adventure — progression pédagogique

## Périmètre de la première livraison

Le monde 1 contient douze unités prévues, dont les **trois premières sont jouables** : saluer et être poli ; se présenter ; construire de premières phrases. Les unités 4–12 et les mondes 2–20 sont des destinations futures, pas des cours disponibles. Leur présence sur la carte décrit une intention pédagogique.

Le corpus affiné contient neuf leçons, **24 scènes de découverte, 72 activités écrites originales, 18 concepts et 21 fiches de vocabulaire**. Les six parties ordinaires introduisent les expressions dans les dialogues de Lova et Mia. Chaque unité finit par un quiz de douze questions couvrant ses notions et des rappels antérieurs. Sept formats sont utilisés : choix, associations, remise en ordre, texte à trous, traduction, compréhension écrite et dialogue guidé. Aucun exercice d’écoute ou quiz culturel n’est présenté comme livré.

La découverte précède le rappel noté. Les traductions françaises sont accessibles dans les bulles à la demande ; les notes grammaticales servent d’aide facultative. La partie ordinaire conserve ses activités dans l’ordre, puis ajoute jusqu’à deux rappels de parties déjà validées. Les sources restent dans l’écran « Sources & crédits » ; leurs IDs restent reliés aux contenus en interne.

Le contenu enseigne d’abord le malgache standard. Les noms de destinations sont des thèmes de voyage ; ils ne constituent ni une carte des divisions administratives ni une succession de dialectes enseignés.

## Les 20 mondes

Chaque monde a un identifiant `world-01` à `world-20`. Les métadonnées exécutables se trouvent dans `src/malagasy/worlds.ts`. Le prérequis planifié d’un monde est le monde précédent. Les heures affichées sont des estimations de conception pour les mondes complets, pas la durée du prototype disponible.

| Monde | Destination | Lexique | Constructions à introduire ou approfondir | Communication visée |
| --- | --- | --- | --- | --- |
| 1 | Antananarivo — Premiers pas | Salutations, présentation, famille, maison, aliments | Prédicats simples, pronoms, `ny`, questions et négation | Saluer, se présenter, créer de courtes phrases |
| 2 | Antsirabe — Au fil des jours | Routine, heures, objets, entourage | Verbes fréquents, possession, temps du quotidien | Présenter sa famille et sa journée |
| 3 | Toamasina — Marchés et repas | Nourriture, boissons, quantités, achats | Demandes, démonstratifs, préférences, prix | Commander, acheter et exprimer ses besoins |
| 4 | Andasibe — Trouver son chemin | Lieux, directions, transports | Relations spatiales, localisation, déplacement, impératifs | Se diriger et expliquer sa destination |
| 5 | Fianarantsoa — La première conversation | Rencontres, activités, intérêts | Consolidation, connecteurs et relances | Soutenir une conversation quotidienne simple |
| 6 | Ambositra — Décrire ce qui nous entoure | Apparence, matières, couleurs | Prédicats adjectivaux et comparaisons approfondis | Décrire et comparer |
| 7 | Ranomafana — Hier et demain | Activités, événements, projets | Passé/futur selon les classes verbales ; repères temporels | Situer un événement passé ou prévu |
| 8 | Manakara — Carnet de voyage | Trajets, hébergement, météo | Séquençage et relations temporelles | Raconter un déplacement |
| 9 | Morondava — Les souvenirs restent | Fêtes, expériences, émotions | Constructions narratives développées | Raconter une expérience |
| 10 | Toliara — Trouver une solution | Difficultés, services, aide | Capacité, obligation, permission et causes | Expliquer un problème et demander une aide |
| 11 | Mahajanga — Tisser des liens | Amitié, famille, usages sociaux | Possession et formulations interpersonnelles | Entretenir des échanges sociaux |
| 12 | Antsiranana — Exprimer ses idées | Opinions, choix, préférences | Accord, désaccord et justification | Donner un avis et le justifier |
| 13 | Nosy Be — Et si on essayait ? | Loisirs, projets, possibilités | Intention, possibilité, condition | Discuter de projets et suggestions |
| 14 | Sambava — Travail et société | Travail, commerce, responsabilités | But, causation, constructions verbales et voix | Expliquer une activité ou une organisation |
| 15 | Ambohimanga — Histoire et patrimoine | Patrimoine, traditions, histoire | Relatives et récits historiques | Présenter une tradition et un lieu de mémoire |
| 16 | Isalo — Un monde vivant | Paysages, biodiversité, protection | Descriptions complexes, causes et conséquences | Expliquer un enjeu environnemental |
| 17 | Tôlanaro — Changer de perspective | Idées, société, décisions | Voix et structure informationnelle approfondies | Reformuler et nuancer un point de vue |
| 18 | Sainte-Marie — Raconter plus loin | Récits, voyages, émotions | Subordination et discours rapporté | Comprendre et produire un récit suivi |
| 19 | Antananarivo — Madagascar aujourd’hui | Médias, société, débats | Argumentation, connecteurs, registres | Soutenir une discussion de société |
| 20 | Madagascar — Le grand voyage | Consolidation générale | Intégration et adaptation au contexte | Communiquer avec davantage d’autonomie |

## Choix de séquence et précautions linguistiques

La distinction entre prédicat et sujet est présentée très tôt : un prédicat peut être nominal ou adjectival et n’est pas nécessairement un verbe. Il ne faut donc pas enseigner le français traduit mot à mot ni une règle universelle « toute phrase est VOS ».

Le chapitre d’Edward L. Keenan, [The Syntax of Subject-Final Languages](https://lrc.la.utexas.edu/books/typology/6-subject-final), décrit notamment l’ordre VOXS dans certaines constructions verbales non marquées, mais aussi les contraintes de référence, les topicalisations et l’importance des constructions de voix. Cette référence typologique appuie ces précautions ; elle n’est pas un cours contemporain complet.

Le monde 6 **approfondit** les prédicats adjectivaux déjà rencontrés auparavant. De même, le monde 17 approfondit les voix : leur existence et les rôles des participants doivent être explicités dès que les exemples précédents l’exigent, sans attendre le monde 17. Les futurs verbes, relatives et constructions temporelles devront être validés individuellement, et non produits par substitution de catégories françaises.

Les objectifs des mondes futurs restent une hypothèse de séquençage à réviser après rédaction et validation des leçons correspondantes. Les exemples français et malgaches des trois unités disponibles ont un registre de sources dans l’application ; les exercices sont originaux. La relecture par un locuteur compétent et la validation phonétique restent des étapes distinctes de cette recherche documentaire.

## Jalons futurs

- **Monde 5** : bilan dialogué cumulatif couvrant présentation, origine, famille, routine, repas, prix, directions et demandes de clarification. L’objectif est un échange simple avec hésitations possibles, pas une certification.
- **Monde 10** : raconter une expérience simple et résoudre un problème du quotidien.
- **Monde 15** : produire des descriptions et des explications plus développées, notamment historiques.
- **Monde 20** : réinvestir les constructions étudiées dans des situations variées et identifier les acquis fragiles.

Ces bilans ne sont pas encore implémentés. Aucun niveau CECRL ni délai de fluidité n’est garanti.

## Proposition de rythme sur six mois

| Période indicative | Parcours futur | Travail privilégié |
| --- | --- | --- |
| Semaines 1–6 | Mondes 1–5 | Fondations et conversation simple |
| Semaines 7–12 | Mondes 6–10 | Description, temporalité et problèmes pratiques |
| Semaines 13–18 | Mondes 11–15 | Relations, opinions, projets et explications |
| Semaines 19–24 | Mondes 16–20 | Récits, perspectives et consolidation |
| Semaines 25–26 | Bilans et révisions ciblées | Reprendre les points faibles, échanges avec un locuteur |

Ce scénario suppose le développement des mondes futurs. Prévoir environ 45–60 minutes de travail régulier, des séances plus longues selon les besoins et des échanges réels avec des locuteurs. Le calendrier doit s’adapter à la rétention constatée. Le prototype actuel permet seulement de commencer les trois premières unités.
