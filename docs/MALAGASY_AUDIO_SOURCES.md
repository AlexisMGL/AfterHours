# Premiers enregistrements malgaches — recherche du 26 octobre 2026

Huit fichiers de prononciation publiés sur Wikimedia Commons ont été téléchargés **dans leur format original, sans découpage, assemblage, changement de hauteur ni conversion**. Ils couvrent huit expressions courtes ; ils ne constituent pas deux voix de synthèse capables de lire les dialogues complets.

Les métadonnées originales ont été consultées via l’API Commons `imageinfo` (`url`, `extmetadata`, `size`). Elles sont conservées dans `src/malagasy/recording-references.json` et dans `public/malagasy/voices/attributions.json`, avec page source, auteur, interprète, licence, lien de licence, URL originale, date, durée, taille et empreinte SHA-256. Les huit originaux représentent 340 668 octets.

## Fichiers effectivement intégrables

| Expression exacte | Interprète | Fichier local | Publication et licence |
| --- | --- | --- | --- |
| Salama | Manantiana ; enregistrement publié par Gloumouth1 | `commons-salama.ogg` | [Fichier source](https://commons.wikimedia.org/wiki/File:Mg-salama.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Misaotra | Manantiana ; enregistrement publié par Gloumouth1 | `commons-misaotra.ogg` | [Fichier source](https://commons.wikimedia.org/wiki/File:Mg-misaotra.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Veloma | Manantiana ; enregistrement publié par Gloumouth1 | `commons-veloma.ogg` | [Fichier source](https://commons.wikimedia.org/wiki/File:Mg-veloma.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Azafady | Manantiana ; enregistrement publié par Gloumouth1 | `commons-azafady.ogg` | [Fichier source](https://commons.wikimedia.org/wiki/File:Mg-azafady.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Tonga soa | Manantiana ; enregistrement publié par Gloumouth1 | `commons-tonga-soa.ogg` | [Fichier source](https://commons.wikimedia.org/wiki/File:Mg-tonga_soa.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Tompoko | Manantiana ; enregistrement publié par Gloumouth1 | `commons-tompoko.ogg` | [Fichier source](https://commons.wikimedia.org/wiki/File:Mg-tompoko.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Eny | Jagwar ; projet Lingua Libre | `commons-eny.wav` | [Fichier source](https://commons.wikimedia.org/wiki/File:LL-Q7930_(mlg)-Jagwar-eny.wav), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Tsia | Bluerose25 ; projet Lingua Libre | `commons-tsia.wav` | [Fichier source](https://commons.wikimedia.org/wiki/File:LL-Q7930_(mlg)-Bluerose25-Tsia.wav), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Tous les fichiers se trouvent dans `public/malagasy/voices/`. Les attributions et les liens de licence doivent apparaître dans « Sources & crédits », conformément aux préférences produit. Les licences concernent ces enregistrements, conservés sans modification.

## Portée de la vérification

Les six descriptions Commons de Gloumouth1 identifient Manantiana comme personne enregistrée. Son [profil Wikipedia malgache](https://mg.wikipedia.org/wiki/Mpikambana:Manantiana) déclare le malgache comme langue maternelle (`mg-N`). Il s’agit d’une déclaration publique de la personne, pas d’une certification indépendante.

Les deux autres fichiers sont explicitement publiés comme prononciations de la langue `mlg` par Lingua Libre, avec leurs interprètes nommés. Leurs métadonnées ne suffisent pas à attribuer un genre ou à promettre un accent et une qualité pédagogique uniformes. Aucun genre masculin ou féminin n’a été déduit d’un pseudonyme.

Ces éléments permettent de choisir des **références humaines traçables**, mais pas de promettre une prononciation « toujours correcte ». Une validation pédagogique par une personne malgachophone du standard reste souhaitable. Ne pas marquer ces fichiers comme ayant fait l’objet d’une écoute ou d’une validation native dans ce projet si celle-ci n’a pas eu lieu.

La correspondance doit porter sur l’énoncé enregistré entier. `Salama` peut correspondre à `Salama!` après normalisation de la ponctuation ; il ne peut pas être utilisé comme enregistrement de `Salama aho` ou `Salama, tompoko`. Aucun assemblage de mots séparés ne doit être présenté comme la prononciation naturelle d’une nouvelle phrase.

Les recherches Commons n’ont pas trouvé d’enregistrements exacts pour les phrases de nom, d’origine et de statut des unités 2–3. Cela décrit cette recherche, sans prétendre à une absence universelle de tels fichiers.

## Pistes consultées et non distribuées

- Les [cours Peace Corps conservés par Yojik](https://fsi-languages.yojik.eu/languages/PeaceCorps/Malagasy-Sakalava.html) contiennent bien des MP3 associés au manuel introductif, notamment salutations et présentation. Les liens historiques de l’archive officielle ne sont plus utilisables dans cette recherche.
- La [politique officielle de réutilisation Peace Corps](https://www.peacecorps.gov/about-the-agency/policies-and-publications/information-management/) indique que les informations du site sont généralement dans le domaine public, sauf indication contraire, dans sa rubrique textes et images. Le [Global Policy Handbook de mai 2025](https://files.peacecorps.gov/multimedia/pdf/documents/volunteer_handbook.pdf), p. 28, précise le statut des produits pédagogiques créés dans le cadre du service et financés par le Peace Corps. Aucun extrait audio Peace Corps n’a néanmoins été redistribué ici : la provenance de l’asset exact, son découpage et sa transcription n’ont pas été finalisés.
- Le modèle Meta MMS-TTS pour le malgache existe, mais il ne fournit pas à lui seul deux voix pédagogiquement validées et sa licence est non commerciale. Aucune sortie de ce modèle n’est distribuée dans ce lot.

La recherche de fournisseurs TTS et leur éventuelle intégration sont séparées de ces huit fichiers. Un fournisseur qui annonce le malgache ne garantit pas automatiquement la correction de chaque phrase produite.
