# Malagasy Adventure — instructions propres à cette application

Lire ce fichier avant toute évolution de l’app ou de son intégration au catalogue. Il conserve **la vision du prompt initial et les retours produit ultérieurs**. Les demandes plus récentes prévalent en cas de conflit ; ne pas réintroduire un comportement abandonné en suivant une ancienne spécification.

## Vision initiale à conserver

- Construire la quatrième expérience d’Afterhours : une plateforme ludique de **malgache standard pour francophones**, intégrée au dépôt existant. Préserver les trois autres jeux, leurs routes et leurs préférences.
- Réutiliser Vite, TypeScript strict et les conventions du dépôt, avec une publication statique Netlify. Ne pas créer un projet indépendant ou ajouter un framework/backend sans besoin concret.
- Associer vocabulaire, grammaire, compréhension, conversations, histoires, culture, révisions espacées, XP, niveaux, succès, séries et statistiques dans un voyage à travers Madagascar.
- Préparer **20 mondes**, avec une hypothèse de travail intensif sur six mois. Ce rythme n’est ni une garantie de fluidité ni une certification CECRL.
- Concevoir une fondation extensible par de futurs prompts : qualité, fiabilité, cohérence pédagogique et maintenance passent avant quantité ou fausse fonctionnalité.

## Périmètre

- Rester sur les **trois premières unités du premier monde**. Améliorer leur qualité avant d’ajouter d’autres unités, sauf nouvelle demande explicite.
- Cette limitation remplace la demande initiale de livrer tout le monde 1. Il comporte toujours douze unités planifiées ; les neuf suivantes ne sont pas livrées.
- Garder les autres destinations comme programme futur clairement verrouillé. Préserver les trois autres jeux, la publication statique et les sauvegardes existantes.

## Curriculum et objectifs initiaux

- Chaque monde apporte **du vocabulaire, des constructions grammaticales et une capacité de communication identifiable**. Ne pas produire une suite de listes de mots.
- Conserver les vingt destinations, domaines lexicaux, objectifs grammaticaux, capacités pratiques, prérequis, thèmes culturels et estimations dans les données. Les noms de lieux ne sont pas vingt divisions administratives.
- Le détail de la progression est dans [CURRICULUM.md](../../docs/CURRICULUM.md) et `worlds.ts` ; le séquençage futur reste une hypothèse à valider lors de sa rédaction.
- Jalons futurs : monde 5, conversation quotidienne simple cumulant les premiers acquis ; monde 10, récit simple et problèmes pratiques ; monde 15, explications et échanges développés ; monde 20, intégration autonome dans des situations familières. Ne pas les annoncer comme livrés.
- Les unités actuelles couvrent salutations/politesse, nom/origine/pronoms, puis prédicats simples/`ny`/négation/questions. La suite prévue porte famille, maison, nourriture, nombres, interrogatifs, déplacement, besoins pratiques, conversations et aventure finale.
- Enseigner les structures réelles du malgache : prédicat initial, sujet final selon la construction, prédicats nominaux/adjectivaux, pronoms, déterminants, possession, négation, questions, temps/aspect, voix et structure informationnelle. Ne pas calquer les catégories françaises ni enseigner « tout est VOS ».
- Présenter les voix dès qu’un exemple les exige ; leur approfondissement tardif dans le curriculum ne permet pas de les ignorer auparavant.

## Apprentissage par la conversation

- **Faire apparaître les mots dans des dialogues en premier.** Introduire vocabulaire et constructions à travers une rencontre illustrée avant de demander leur rappel.
- Centrer les exercices sur les échanges de personnages : comprendre, choisir sa réplique, compléter une réponse et reconstruire une phrase dite dans la scène.
- Limiter le français à une consigne courte, une traduction accessible à la demande et une aide utile après une erreur. Éviter les longs textes pédagogiques qui encadrent chaque question.
- Conserver les explications grammaticales en aide facultative ; ne pas les afficher comme un préalable massif à chaque leçon.
- Réutiliser les mots déjà rencontrés dans de nouvelles conversations cohérentes. Aucun concept inconnu dans une révision ordinaire.
- Ne pas rendre une notion éligible au Centre de révision au premier écran si son dialogue d’introduction n’a pas été parcouru. Une scène interrompue ne vaut pas introduction de toute la leçon.
- Maintenir les personnages récurrents et les petites histoires contextualisées. Les scènes fictives peuvent combiner des expressions vérifiées sans prétendre transcrire un échange natif.
- Les découvertes géographiques, historiques et culturelles enrichissent le voyage ; elles restent secondaires à la langue, sourcées et sans stéréotypes.

## Révision, maîtrise et progression

- Un exercice peut tester plusieurs concepts mais **tous doivent avoir été rencontrés**. Garder les registres centraux de concepts et leurs liens vers introduction, prérequis, exercices, objectifs et sources.
- Distinguer inconnu, découverte, consolidation, maîtrise et échéance. Une leçon terminée ou beaucoup d’XP ne prouve pas une rétention durable.
- Suivre tentatives, réussites, erreurs, dernière pratique, échéance et estimation de maîtrise. La répétition espacée doit rester déterministe, configurable et testable sur tout le corpus futur.
- Le moteur générique propose les poids 55 % courant / 25 % acquis antérieurs / 20 % échéances ou faiblesses, adaptables au contexte. L’interface dialoguée conserve actuellement les six activités rédigées dans leur ordre et ajoute jusqu’à deux rappels antérieurs : ne pas sacrifier une scène pour imposer mécaniquement ces pourcentages.
- Privilégier les échéances et les faiblesses actuelles ; une erreur ancienne ne doit pas pénaliser indéfiniment une notion consolidée.
- Conserver des checkpoints obligatoires et des révisions facultatives. Récompenser une première réussite d’exercice et une première validation, sans XP illimités par répétition.

## Personnages et plaisir de progresser

- Privilégier une direction **cartoon, chaleureuse et vivante**, avec de petits personnages expressifs qui se parlent dans des bulles. Des avatars ou icônes seuls ne suffisent pas à créer une scène.
- Une bonne réponse doit produire une récompense brève et perceptible : mouvement, expression du personnage, éclat visuel et son de réussite clair.
- Le succès sonore doit comporter des notes distinctes et joyeuses ; éviter un simple glissement de fréquence neutre. Créer les sons du projet, sans reprendre les fichiers d’une autre app.
- Pour une erreur, proposer une réaction courte, douce et encourageante avec la correction. Éviter une punition sonore ou une animation agressive.
- Respecter le bouton muet, le clavier, le tactile et le réglage système de mouvement réduit. Aucun clignotement rapide ou animation interminable bloquant la réponse suivante.
- Ne pas inventer des XP pour la seule animation : distinguer encouragement, combo visuel et récompense réellement accordée.

## Repères et fin d’unité

- Toujours identifier clairement **le monde, l’unité, la partie et la position dans la séance**, notamment entre deux exercices.
- Chaque unité se termine par un **quiz complet**, qui couvre ses acquis et réutilise les précédents.
- Les trois quiz actuels comportent douze questions chacun. Ne pas déclarer le monde 1 entier terminé après ses trois unités publiées.
- Pendant un quiz final, masquer les traductions qui révéleraient la réponse ; les rendre disponibles après la correction. Garder les traductions à la demande pendant la découverte et l’entraînement.
- Distinguer la fin d’une partie de la fin d’une unité. Une réussite au quiz déclenche un vrai écran de clôture d’unité, avec score, compétences travaillées et accès à la prochaine unité.
- Une tentative rejouée doit afficher son résultat actuel ; une ancienne validation peut rester conservée sans transformer un échec récent en réussite visuelle.

## Carte

- L’utilisateur a rejeté la première carte dessinée à main levée. Utiliser un contour géographique traçable et une projection cohérente pour le littoral et les destinations.
- Soigner la silhouette de Madagascar, les îles, les repères, les chevauchements et l’accessibilité des étapes. Une jolie décoration ne justifie pas des points placés hors de leur position géographique.
- Le dernier monde représente tout Madagascar : ne pas l’inventer comme un nouveau lieu en mer. Les deux étapes d’Antananarivo doivent rester distinguables.
- Les décalages nécessaires pour des étapes proches restent reliés à leur ancrage. Les données Natural Earth intégrées sont simplifiées et citées aux crédits ; cette carte n’est pas un outil de navigation.

## Sources et exactitude

- **Afficher les sources seulement dans « Sources & crédits ».** Pas de liens de référence sous les questions, dans le feedback, les scènes, le lexique ou les écrans de leçon.
- Conserver en interne les `sourceIds`, le registre et les contrôles de références : retirer les liens de l’expérience ne signifie pas retirer la traçabilité du contenu.
- Toute nouvelle formulation malgache doit être étayée. Ne pas inventer une traduction pour rendre un dialogue plus vivant.
- Distinguer une réplique naturelle d’un mot cité pour expliquer la langue : par exemple, ne pas présenter le pronom postprédicatif `aho` isolé comme une traduction autonome de « moi ».
- Rechercher des sources linguistiques fiables, recouper les points incertains et distinguer standard/variantes régionales. Ne pas inventer de consigne phonétique pour remplir une activité.
- Sources initiales : manuels Peace Corps, dictionnaire malgache, travaux universitaires, grammaires recoupées ; découvrir d’autres sources primaires si nécessaire. Une piste bibliographique n’est pas une page effectivement consultée.
- Le registre central alimente les crédits : titre, auteur, lien direct, catégorie, date/édition connue, usage précis et droits. Distinguer consultation effective, lecture complémentaire, média réutilisé et contenu à vérifier.
- Créer les exercices et explications ; ne pas recopier un cours, une base, des images ou des enregistrements sans droits adaptés. Un accès public ne constitue pas une permission de redistribution.
- Signaler honnêtement la relecture malgachophone encore nécessaire. Une référence publiée ne remplace pas une validation actuelle du registre et de la naturalité.
- Aucun son de synthèse française/anglaise présenté comme une voix malgache. Sans enregistrement vérifié et autorisé, ne pas noter l’écoute ou la prononciation.

## Audio et oral

- **Priorité utilisateur du 27 octobre 2026 : faire réciter les dialogues par une voix numérique malgache**, pour donner de la vie aux leçons et couvrir les phrases que l’on ne trouvera pas toutes dans une banque d’enregistrements. Cette demande remplace le choix intermédiaire de se limiter aux huit références humaines disponibles.
- Utiliser un modèle qui prend réellement en charge le malgache, avec sa provenance et sa licence. Ne jamais présenter une TTS française/anglaise comme du malgache ni promettre une prononciation « toujours correcte » à partir du seul nom du modèle.
- Prévoir lecture, pause, reprise, relecture, vitesse lente, chargement, erreur et muet via le manifeste audio et son service. Une écoute doit réellement jouer un asset valide avant sa notation.
- Générer des fichiers de phrases entières en préparation du contenu, puis les servir avec le site statique : le joueur ne doit pas avoir besoin d’un compte Cloud, d’une clé ou d’un appel payant à chaque lecture. Le générateur doit permettre d’étendre le corpus lors de l’ajout de futures phrases.
- Les huit références humaines (`Salama`, `Misaotra`, `Veloma`, `Azafady`, `Tonga soa`, `Tompoko`, `Eny`, `Tsia`) restent des références ou un repli documenté, pas une limite qui condamne toutes les autres répliques au silence.
- Lire automatiquement une réplique nouvellement visible disposant d’un fichier autorisé correspondant à la phrase entière, après une action du joueur. Un rerendu, un choix de réponse, l’ouverture d’une traduction ou le passage muet/son ne doit pas relancer les répliques déjà montrées.
- Proposer un bouton haut-parleur accessible dans les bulles pour rejouer la réplique. Une relecture interrompt proprement la lecture précédente ; aucun chevauchement. Arrêter les voix en quittant la scène, la question ou l’app, et respecter immédiatement le muet.
- La correspondance porte sur **la réplique entière**, avec seulement une normalisation typographique sûre. Ne pas assembler des mots isolés ou découper des sons pour simuler une phrase native. Les blancs d’exercice et les points de suspension ne doivent pas révéler oralement une réponse manquante.
- **Dernier retour utilisateur : corriger « Azafady », entendu comme « azalafy », rendre Mia plus aiguë et prononcer les réponses malgaches au clic.** Ce retour autorise un traitement de hauteur pour distinguer les personnages, contrairement à la préférence antérieure. Mia utilise maintenant un timbre relevé de deux demi-tons, à tempo conservé, préparé hors ligne. Décrire honnêtement ce traitement dans les crédits : même modèle monolocuteur, pas une seconde voix féminine native.
- Pour « Azafady » seul, privilégier l’enregistrement humain de Manantiana (`audio-commons-azafady`) non modifié, dans les bulles comme dans les réponses, pour les deux personnages. Ne pas réintroduire la sortie MMS signalée comme fautive en régénérant la banque. Une correction de ce mot ne valide pas toutes les autres prononciations.
- Prononcer au clic **la réponse effectivement choisie en malgache**, correcte ou incorrecte, sans la valider automatiquement. Inclure les mots malgaches sélectionnés dans les associations et les banques de mots. Utiliser les champs explicites `selectionLanguage` / `spokenSelections` ; ne jamais déduire la langue de la bonne réponse ou de l’orthographe, ni lire les choix français avec la voix malgache. Un second clic peut rejouer la sélection. Respecter le muet et interrompre la voix précédente ; ne pas relancer le dialogue derrière cette lecture.
- Distinguer une sortie `synthetic` / `model-generated`, une référence `published-pronunciation` et une vraie relecture `native-speaker-reviewed`. Un test de décodage, de durée ou d’amplitude ne certifie pas l’accent ou la naturalité ; ne pas marquer les sorties synthétiques comme validées par un locuteur natif.
- Respecter la licence du modèle et des fichiers. En particulier, MMS est sous CC BY-NC 4.0 : ne pas lui attribuer des droits commerciaux qu’il n’accorde pas. Conserver la provenance, la révision du modèle et les paramètres utiles pour régénérer la banque.
- La lecture de référence accompagne encore des exercices écrits : elle n’attribue pas à elle seule de maîtrise d’écoute ou de prononciation. Pas de reconnaissance vocale ou de notation orale simulée. Les attributions et la couverture détaillée restent dans « Sources & crédits ».

## Architecture, sauvegarde et extensions

- Séparer curriculum, contenu, rendu/validation d’exercices, connaissances/révision, progression, persistance, audio et crédits. Garder les algorithmes purs et injecter les dates dans leurs tests.
- Les schémas typés et **IDs stables**, jamais les positions de tableaux, relient mondes, unités, leçons, exercices, concepts, dialogues, sources et assets.
- Ajouter un monde principalement par ses données ; enregistrer un nouveau format via rendu, validateur et contrôles dédiés. Pas de conditions propres au monde 1 dans les moteurs génériques.
- Éviter les gros fichiers qui mêlent corpus et logique, les dépendances inutiles et les infrastructures spéculatives.
- Sauvegarder automatiquement dans le navigateur. Conserver une abstraction de stockage compatible avec une future synchronisation, sans implémenter de compte aujourd’hui.
- L’export JSON comprend progression, paramètres, XP/niveaux dérivés, réussites, séries, maîtrise, échéances, historique et dates. Valider et prévisualiser l’import, puis demander confirmation avant remplacement ; refuser les données corrompues ou malveillantes.
- Conserver un numéro de schéma et des migrations explicites lors d’une évolution incompatible. Ne pas renommer les IDs livrés sans migration ; préserver les anciennes sauvegardes.
- Prévenir de la portée locale des données et permettre une sauvegarde portable. Conserver une copie de récupération des données locales illisibles lorsque c’est possible.
- Comptes, cloud, multijoueur, classements, tuteur IA, abonnements, mobile natif et scoring vocal avancé restent des pistes futures. Aucun faux service annoncé comme actif.

## Vérification

- Vérifier références, doublons, prérequis/cycles, introduction des notions, traductions/réponses, configurations, accessibilité du parcours et fichiers audio/médias.
- Tester de vrais parcours, les réponses alternatives, les quiz, déblocages, maîtrise, révision déterministe, plafonds XP, sauvegardes, import/export/corruption, clavier/tactile, mobile, muet et mouvement réduit.
- Terminer les modifications servies avant une suite navigateur pour éviter les rechargements HMR pendant les tests. Vérifier le build statique et les quatre routes sans régression des autres jeux.
- Maintenir [ARCHITECTURE.md](../../docs/ARCHITECTURE.md), [CURRICULUM.md](../../docs/CURRICULUM.md), [CONTENT_GUIDE.md](../../docs/CONTENT_GUIDE.md), [REVIEW_ENGINE.md](../../docs/REVIEW_ENGINE.md), [LANGUAGE_SOURCES.md](../../docs/LANGUAGE_SOURCES.md) et [ROADMAP.md](../../docs/ROADMAP.md) alignés sur le code.
- Rapporter le contenu réellement livré, les limites linguistiques/audio, les checks effectivement exécutés et la prochaine étape utile. Ne pas confondre programme futur et contenu implémenté ni annoncer des tests non exécutés.
