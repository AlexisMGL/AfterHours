# Malagasy Adventure — refonte dialoguée du 26 octobre 2026

## Périmètre conservé

Trois premières unités du premier monde, neuf leçons, dix-huit concepts et vingt et une fiches de vocabulaire. Les unités 4–12 et les dix-neuf mondes suivants restent en préparation. Les IDs livrés et le schéma de sauvegarde sont conservés ; la refonte ne crée pas une nouvelle application ou un compte.

## Changements réalisés

- **Découverte par le dialogue** : vingt-quatre scènes, quatre par partie ordinaire, avec Lova et Mia. Les tours apparaissent progressivement, les mots importants sont surlignés et la traduction française se dévoile à la demande. Les notes grammaticales deviennent une aide facultative.
- **Pratique contextualisée** : soixante-douze activités sur les sept formats écrits existants. Chaque activité possède un échange illustré et une consigne courte. Les parties gardent leurs six activités dans l’ordre conversationnel, puis ajoutent jusqu’à deux rappels antérieurs éligibles.
- **Fin d’unité identifiable** : chaque quiz couvre les acquis de son unité en douze questions, avec un seuil de 80 %. Les écrans distinguent fin de partie et fin d’unité, montrent le score et ouvrent la prochaine étape. Monde, unité, partie et position restent visibles pendant la séance.
- **Réponses plus vivantes** : personnages SVG originaux et expressifs, étoiles brèves, badge et encouragement doux après une erreur. Le succès sonore comporte deux attaques de notes ascendantes distinctes ; la correction est plus douce et la fin d’unité possède sa cadence originale. Muet et mouvement réduit restent respectés.
- **Carte remplacée** : contour Natural Earth simplifié de Madagascar, Nosy Be et Sainte-Marie, projection commune aux côtes et aux villes, vingt escales accessibles au clavier, deux visites à Antananarivo distinguables et cartouche national pour le dernier monde.
- **Sources à leur place** : seize références dans le registre, visibles uniquement dans « Sources & crédits ». Les relations `sourceIds` et leurs validations sont conservées sans liens sous les questions, dans les dialogues, le feedback ou le lexique.
- **Passation durable** : [le fichier `src/malagasy/AGENTS.md`](../src/malagasy/AGENTS.md) réunit la vision du prompt initial et les retours ultérieurs : vingt mondes à terme, malgache réel, révisions cumulatives, architecture extensible, sauvegardes sûres, dialogues, cartoon, quiz et sources uniquement dans les crédits.

## Principaux modules

`dialogue-content.ts` contient les nouvelles scènes ; `characters.ts` et `dialogue-view.ts` rendent les personnages et les bulles ; `lesson-view.ts` et `session.ts` portent les écrans et l’état transitoire de la séance. `map.ts` et `madagascar-coast.json` portent la géométrie et la projection. Les moteurs de réponses, maîtrise, XP et sauvegardes restent séparés.

Les concepts ne deviennent révisables qu’au passage à la pratique, après les scènes de découverte. Une introduction quittée au premier échange ne doit pas ouvrir à la révision les mots encore invisibles.

## Vérification de cette version

| Contrôle final | Résultat |
| --- | --- |
| `npm run test` | **313 tests réussis**, 13 fichiers : moteurs existants, 17 contrôles du moteur Malagasy, 6 contrôles du corpus dialogué et 3 de la carte. |
| `npm run test:e2e` | **53 tests Chromium réussis** en un passage complet, sans échec ni relance : 36 scénarios existants, 13 de l’app et 4 des sons. |
| `npm run build` | **Réussi**, TypeScript strict et sortie statique Vite pour Netlify. |
| Build servi par HTTP | Quatre apps et variantes de routes avec/sans slash rechargées ; carte à 20 pastilles ; découverte progressive, personnages, première réponse et récompense ; mobile 390 px sans débordement ; aucune erreur console ni requête échouée. |
| Mobile et accessibilité | Vues et parcours testés à 340 et 390 px ; repères d’unité, clavier sur la carte, traductions facultatives, muet persistant et animations désactivées avec mouvement réduit. |
| Quiz | Les trois quiz de 12 questions parcourus ; traductions masquées avant réponse puis disponibles à la correction ; clôture d’unité et accès à la suivante vérifiés. |
| Découverte et sauvegardes | Quitter une scène n’introduit pas les mots invisibles ; progression, export/import, récupération de JSON corrompu et plafonnement des XP vérifiés. |
| Sons originaux | Rendu hors ligne réel dans Chromium : sortie finie et bornée, silence en mode muet, deux attaques et intervalle montant de réussite, correction douce et cadence de fin. |

Les contrôles ne chargent aucun fichier sonore malgache et ne constituent pas une validation de prononciation. Le navigateur vérifié est Chromium. Les anciens identifiants de contenu et le format de progression v1 restent compatibles. Les résultats historiques du 25 octobre sont conservés dans leur rapport séparé.

La refonte est présente dans le dépôt et le build `dist/`. Aucun push ni déploiement public n’a été effectué. Pour ouvrir l’app, lancer `start-local.cmd`, puis visiter **http://127.0.0.1:5173/malagasy-adventure**.

## Limites conservées

Aucun enregistrement malgache vérifié n’est distribué : les sons de réponse sont des effets d’interface et aucune compétence d’écoute ou de prononciation n’est attribuée. La relecture des exemples composés et du registre de politesse par un enseignant malgachophone reste nécessaire. Les mondes futurs sont un programme de conception, pas une promesse de fluidité en six mois. Aucun compte ou service distant n’est ajouté.

Voir [les sources et leurs limites](LANGUAGE_SOURCES.md), [l’architecture](ARCHITECTURE.md) et [la feuille de route](ROADMAP.md).
