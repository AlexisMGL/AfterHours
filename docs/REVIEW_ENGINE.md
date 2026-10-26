# Malagasy Adventure — maîtrise et révisions

Les algorithmes sont dans `src/malagasy/engine.ts`. Ils fonctionnent sur les IDs de concepts de tout le contenu ; aucun branchement n’est réservé au premier monde. Les dates peuvent être injectées pour des tests déterministes.

## Maîtrise individuelle

Présenter un concept crée un état `introduced: true`, mais **aucune maîtrise n’est accordée à sa seule présentation**. Une réponse met à jour chaque concept associé : nombre d’essais, réussites, erreurs, série de journées de rappel réussi, estimation de maîtrise, dernière pratique et prochaine révision.

L’estimation est comprise entre 0 et 1. Pour une réponse correcte, `m ← m + (1 − m) × 0,3`, avec un plafond de 0,79 pour des répétitions au cours d’une même journée d’apprentissage. Une estimation déjà supérieure à ce plafond n’est pas abaissée par un succès. Pour une erreur, `m ← m × 0,55`. Cette estimation est une heuristique pédagogique, pas une probabilité calibrée de rétention.

Le statut affichable est :

- `unseen` : concept non présenté ;
- `due` : une date de révision existe et est échue ;
- `mastered` : au moins cinq réussites, série d’au moins trois journées de rappel réussi et estimation ≥ 0,8 ;
- `reviewing` : au moins trois essais sans les conditions précédentes ;
- `learning` : autres concepts présentés.

Une leçon terminée ne suffit donc pas à qualifier ses concepts de maîtrisés. Les erreurs demeurent dans les compteurs et dans un historique des 1 000 dernières réponses.

## Planification espacée

Les intervalles de réussite sont **1, 3, 7, 14 puis 30 jours**, selon la série de journées de rappel réussi du concept. Cette série ne progresse qu’au premier rappel réussi d’une nouvelle journée locale, au plus une fois par jour. Une erreur remet la série à zéro et rapproche la révision à dix minutes. Le calcul ajoute une durée exacte à la date de réponse et conserve une date ISO UTC.

Les concepts dus sont triés par échéance, puis par ID en cas d’égalité. Des réponses successives le même jour ne font pas avancer l’intervalle ni atteindre à elles seules le statut maîtrisé. Cette protection distingue entraînement immédiat et rappels sur plusieurs jours ; elle ne constitue pas une validation scientifique du modèle de mémoire.

## Sélection cumulative

`selectMixedExercises` reçoit le contenu, la sauvegarde, une leçon éventuelle, le nombre d’exercices, la date et des poids. Les poids génériques configurables sont `current: 55`, `previous: 25`, `review: 20`. Ils restent une fondation pour des entraînements mixtes, pas une obligation de fractionner chaque conversation.

L’interface affinée conserve les six activités de chaque partie dans leur ordre conversationnel, puis ajoute jusqu’à deux rappels éligibles provenant de parties déjà validées. Le Centre de révision utilise la sélection générique sans leçon ciblée. Les quiz finaux suivent leurs douze activités rédigées pour couvrir l’unité entière. Ce choix rend la découverte cohérente et conserve le rappel cumulatif.

Les proportions donnent des quotas arrondis ; avec peu d’exercices, elles ne peuvent pas être exactes. Les places restantes sont réattribuées aux banques disponibles. Le résultat ne contient pas de doublon.

- **Courant** : exercices de la leçon ciblée.
- **Antérieur** : exercices hors de cette leçon qui ne testent pas ses nouveaux concepts.
- **Révision** : exercices contenant un concept dû ou pas encore maîtrisé ; priorité aux échéances, puis à la faiblesse actuelle. Une erreur ancienne ne donne pas une priorité permanente à un concept depuis consolidé.

Toutes les catégories imposent que chaque concept testé ait déjà été introduit. Une écoute sans entrée audio vérifiée est exclue. Le moteur départage les candidats avec la dernière date de pratique et l’ID : même contenu, sauvegarde et date donnent le même résultat. Un manque de banque antérieure, notamment au début du parcours, ne bloque pas la séance.

Les scènes d’introduction sont transitoires : ouvrir une leçon puis la quitter avant la pratique ne publie pas tous ses concepts dans la sauvegarde. La banque peut être préparée sur un état prospectif, mais les nouveaux concepts ne deviennent révisables qu’après la découverte et le passage à la pratique.

Sans leçon ciblée, le Centre de révision privilégie les échéances et les points faibles, puis complète avec les concepts introduits. Le choix parcourt tout le corpus : ajouter de futurs mondes ne demande pas de recopier les anciens exercices dans chaque nouveau monde.

## Bilans, déblocage et récompenses

Une leçon ordinaire demande au moins 60 % de bonnes réponses ; un `checkpoint` demande 80 %. Les prérequis doivent être terminés et tous les nouveaux concepts présentés. Le quiz final de chaque unité comprend douze questions et déclenche un écran de clôture distinct du bilan d’une partie. Le résultat d’une nouvelle tentative est affiché tel quel, sans utiliser une ancienne validation pour annoncer une réussite récente. Le quiz peut verrouiller la suite sans empêcher la pratique des acquis.

Une première réponse correcte à un ID d’exercice rapporte 10 XP ; refaire cet exercice ne rapporte plus d’XP. La première validation d’une leçon rapporte 25 XP. Les XP et les IDs déjà récompensés sont sauvegardés. Cette règle empêche la répétition d’un exercice pour des récompenses illimitées ; elle laisse les répétitions modifier la maîtrise, ce qui est leur finalité.

Le niveau est `1 + floor(sqrt(XP / 100))`. La série quotidienne compte les jours civils locaux consécutifs d’activité, avec tolérance au jour courant encore non pratiqué. Elle ne dépend pas de la langue du cours. La liste des dates d’activité est limitée à 730 jours.

## Prochaines améliorations possibles

Une future version pourra distinguer les jours de rappel réellement espacés, séparer reconnaissance et production, tenir compte des prérequis importants et calibrer les intervalles à partir de données d’usage. Cela demande une évolution explicite du modèle et des tests ; aucun algorithme adaptatif sophistiqué ou diagnostic de niveau n’est simulé aujourd’hui.
