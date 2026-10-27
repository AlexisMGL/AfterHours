import type { AudioAsset, Concept, Content, Exercise, ExerciseType, Lesson, Source, Unit, Vocabulary } from './types';
import { WORLDS } from './worlds';
import { EXERCISE_DIALOGUES, LESSON_SCENES, SHORT_QUESTIONS } from './dialogue-content';
import { MAP_SOURCES } from './map-sources';
import { DIALOGUE_RECORDINGS, VOICE_SOURCES } from './voice-recordings';
import { SYNTHETIC_RECORDINGS, SYNTHETIC_VOICE_SOURCES } from './synthetic-voices';
import { PROFILE_RECORDINGS, PROFILE_VOICE_SOURCES } from './voice-profiles';

const PC = 'peacecorps-intro', KEENAN = 'keenan-subject-final', ARTICLE = 'parker-article';
const dictionary = (word: string, supports: string): Source => ({
  id: 'dict-' + word.toLowerCase(), title: 'Dictionnaire malgache : ' + word,
  author: 'Encyclopédie de Madagascar et Dictionnaire malgache (références lexicographiques dans chaque entrée)',
  url: 'https://malagasyword.org/bins/teny2/' + word, category: 'dictionary', consulted: true, supports,
  license: 'Consultation lexicographique. Aucune définition longue ni aucun enregistrement reproduit ; vérifier les droits des sources sous-jacentes avant réutilisation.',
});
export const SOURCES: Source[] = [
  { id: PC, title: 'An Introduction to the Malagasy Language — Pre-departure materials', author: 'Peace Corps / Madagascar',
    url: 'https://fsi-languages.yojik.eu/languages/PeaceCorps/Malagasy-Sakalava/Malagasy-peace-corps/MG_Malagasy_Language_Lessons.pdf',
    category: 'language', consulted: true, date: 'Date non indiquée dans le document',
    supports: 'PDF de 24 pages réellement lu : p. 3 (o et i/y), p. 4 (politesse), p. 5 (nom et origine), p. 7–9 (pronoms, prédicats, négation), p. 11–13 (questions, eny, tsia). Exercices français originaux.',
    license: 'Document institutionnel consulté sur un miroir. Aucun fichier audio, image ou cours redistribué ; droits des enregistrements à vérifier séparément.' },
  { id: 'peacecorps-manual', title: 'Corps de la Paix Madagascar — Livre du stagiaire, Malagasy Ofisialy (ED454700)', author: 'Mupemba Wa Tshiangale / Peace Corps, Antananarivo',
    url: 'https://eric.ed.gov/?id=ED454700', category: 'language', consulted: true, date: 'Mai 1996',
    supports: 'Notice consultée ; PDF scanné ouvert mais non exploité pour les formulations des activités. Lecture complémentaire.',
    license: 'Référence bibliographique ; disponibilité sur ERIC ne signifie pas autorisation de réutilisation de médias.' },
  { id: KEENAN, title: 'The Syntax of Subject-Final Languages, §6.1.3.1 Malagasy', author: 'Edward L. Keenan III, dans Syntactic Typology, dir. Winfred P. Lehmann — University of Texas',
    url: 'https://lrc.la.utexas.edu/books/typology/6-subject-final', category: 'grammar', consulted: true, date: '1978',
    supports: 'Ordre prédicat–sujet ; VOXS dans certaines déclaratives, topicalisation et importance des voix. Limites d’un résumé « tout est VOS ».',
    license: 'Consultation universitaire ; synthèses originales, aucun passage long reproduit.' },
  { id: ARTICLE, title: 'A Concise Grammar of the Malagasy Language — The Article', author: 'G. W. Parker, transcription Wikisource',
    url: 'https://en.wikisource.org/wiki/A_Concise_Grammar_of_the_Malagasy_Language/The_Article', category: 'grammar', consulted: true, date: '1883',
    supports: 'Article ny ; no ne se traduit pas mécaniquement par une copule être. Référence historique recoupée au dictionnaire.',
    license: 'Texte historique, transcription sous conditions Wikisource (CC BY-SA). Explications reformulées.' },
  dictionary('salama', 'Salutation et adjectif « en bonne santé », deux emplois distingués.'),
  dictionary('azafady', 'Aza fady, formule de demande ou d’excuse ; variante espacée acceptée.'),
  dictionary('misaotra', 'Remercier ; emploi poli recoupé avec Peace Corps.'),
  dictionary('tompoko', 'Formule d’adresse respectueuse sans genre grammatical.'),
  dictionary('anarana', 'Nom, formes anarako et anaranao dans la morphologie.'),
  dictionary('aho', 'Pronom sujet généralement après le prédicat ; contrôle de son emploi pour ne pas présenter le mot isolé comme une réplique naturelle « moi ». Dans la scène de découverte, les pronoms sont explicitement cités comme mots à repérer.'),
  dictionary('Frantsa', 'Toponyme Frantsa : France, distinct de frantsay.'),
  dictionary('ny', 'Article ny ; distinct du suffixe possessif -ny.'),
  dictionary('tsy', 'Négation devant le prédicat dans les modèles simples.'),
  dictionary('ve', 'Particule interrogative ; placement dans les questions simples, sans prétendre en couvrir tous les emplois.'),
  { id: 'unesco-ambohimanga', title: 'Colline royale d’Ambohimanga', author: 'Centre du patrimoine mondial de l’UNESCO',
    url: 'https://whc.unesco.org/en/list/950/', category: 'geography', consulted: true,
    supports: 'Thème du monde Ambohimanga : patrimoine royal et lieu sacré ; position géographique.',
    license: 'Conditions UNESCO ; description paraphrasée, aucune photographie ou carte reprise.' },
  ...MAP_SOURCES,
  ...VOICE_SOURCES,
  ...SYNTHETIC_VOICE_SOURCES, ...PROFILE_VOICE_SOURCES,
];

const L = {
  greetings: 'lesson-01-01', welcome: 'lesson-01-02', greetingReview: 'lesson-01-03',
  name: 'lesson-02-01', origin: 'lesson-02-02', introReview: 'lesson-02-03',
  predicate: 'lesson-03-01', questions: 'lesson-03-02', sentenceReview: 'lesson-03-03',
};
const C = {
  hello: 'vocab.hello', goodbye: 'vocab.goodbye', thanks: 'vocab.thanks', please: 'vocab.please',
  spelling: 'grammar.spelling', welcome: 'vocab.welcome', yes: 'vocab.yes', no: 'vocab.no', respect: 'vocab.respect',
  name: 'skill.name', pronouns: 'grammar.singular-pronouns', origin: 'skill.origin', france: 'vocab.france',
  predicate: 'grammar.predicate-first', trainee: 'vocab.trainee', article: 'grammar.article-ny',
  negation: 'grammar.negation-tsy', question: 'grammar.question-ve',
};
function concept(id: string, label: string, category: Concept['category'], introducedIn: string, objective: string, sourceIds: string[], prerequisites: string[] = [], malagasy?: string, french?: string): Concept {
  return { id, label, category, introducedIn, objective, sourceIds, prerequisites, malagasy, french };
}
export const CONCEPTS: Concept[] = [
  concept(C.hello, 'Saluer', 'vocabulary', L.greetings, 'Choisir une salutation pour une rencontre.', [PC, 'dict-salama'], [], 'Salama', 'Bonjour / salut'),
  concept(C.goodbye, 'Prendre congé', 'vocabulary', L.greetings, 'Terminer une rencontre.', [PC], [], 'Veloma', 'Au revoir'),
  concept(C.thanks, 'Remercier', 'vocabulary', L.greetings, 'Remercier quelqu’un.', [PC, 'dict-misaotra'], [], 'Misaotra', 'Merci'),
  concept(C.please, 'Demander avec politesse', 'vocabulary', L.greetings, 'Distinguer demande polie et remerciement.', [PC, 'dict-azafady'], [], 'Azafady', 'S’il vous plaît / excusez-moi'),
  concept(C.spelling, 'Premiers repères de prononciation', 'grammar', L.greetings, 'Reconnaître o ≈ ou et i/y, sans prétendre évaluer l’oral.', [PC]),
  concept(C.welcome, 'Accueillir', 'vocabulary', L.welcome, 'Comprendre une formule de bienvenue.', [PC], [], 'Tonga soa', 'Bienvenue'),
  concept(C.yes, 'Répondre oui', 'vocabulary', L.welcome, 'Donner une réponse affirmative.', [PC], [], 'Eny', 'Oui'),
  concept(C.no, 'Répondre non', 'vocabulary', L.welcome, 'Donner une réponse négative autonome.', [PC], [], 'Tsia', 'Non'),
  concept(C.respect, 'S’adresser avec respect', 'vocabulary', L.welcome, 'Reconnaître une marque d’adresse respectueuse.', ['dict-tompoko'], [], 'Tompoko', 'Adresse respectueuse'),
  concept(C.name, 'Échanger les prénoms', 'communication', L.name, 'Demander et donner un nom avec une formule complète.', [PC, 'dict-anarana'], [C.hello], 'Iza no anaranao?', 'Comment t’appelles-tu ?'),
  concept(C.pronouns, 'Aho, ianao, izy', 'grammar', L.name, 'Distinguer je, tu/vous singulier et il/elle.', [PC, 'dict-aho'], [], 'aho / ianao / izy', 'je / tu-vous / il-elle'),
  concept(C.origin, 'Dire d’où l’on vient', 'communication', L.origin, 'Demander et indiquer un lieu d’origine.', [PC], [C.pronouns], 'Avy aiza ianao?', 'D’où viens-tu ?'),
  concept(C.france, 'Nommer la France', 'vocabulary', L.origin, 'Distinguer pays d’origine et nationalité.', ['dict-frantsa'], [], 'Frantsa', 'France'),
  concept(C.predicate, 'Le prédicat avant le sujet', 'grammar', L.predicate, 'Construire un énoncé nominal ou adjectival simple, sans imposer de copule.', [PC, KEENAN], [C.pronouns]),
  concept(C.trainee, 'Nommer un statut', 'vocabulary', L.predicate, 'Employer mpiofana dans une phrase nominale.', [PC], [], 'mpiofana', 'stagiaire'),
  concept(C.article, 'L’article ny', 'grammar', L.predicate, 'Repérer l’article devant un nom sans lui attribuer genre ou nombre.', [ARTICLE, 'dict-ny'], [C.predicate], 'ny', 'le / la / les selon le contexte'),
  concept(C.negation, 'La négation tsy', 'grammar', L.questions, 'Placer tsy devant le prédicat et le distinguer de tsia.', [PC, 'dict-tsy'], [C.predicate, C.no], 'tsy', 'ne… pas'),
  concept(C.question, 'La question avec ve', 'grammar', L.questions, 'Former une question oui/non avec ve avant le sujet.', [PC, 'dict-ve'], [C.predicate, C.yes, C.no], 've', 'marqueur de question oui/non'),
];
function vocab(id: string, malagasy: string, french: string, note: string, conceptId: string, unitId: string, sourceIds: string[]): Vocabulary {
  return { id, malagasy, french, note, conceptId, unitId, sourceIds };
}
export const VOCABULARY: Vocabulary[] = [
  vocab('word.salama', 'Salama', 'Bonjour / salut', 'Salutation ; aussi adjectif « en bonne santé » dans une phrase.', C.hello, 'unit-01', [PC, 'dict-salama']),
  vocab('word.veloma', 'Veloma', 'Au revoir', 'Pour prendre congé.', C.goodbye, 'unit-01', [PC]),
  vocab('word.misaotra', 'Misaotra', 'Merci', 'Après avoir reçu de l’aide, par exemple.', C.thanks, 'unit-01', [PC, 'dict-misaotra']),
  vocab('word.azafady', 'Azafady', 'S’il vous plaît / excusez-moi', 'Selon la situation. Graphie « aza fady » également rencontrée.', C.please, 'unit-01', [PC, 'dict-azafady']),
  vocab('word.tongasoa', 'Tonga soa', 'Bienvenue', 'L’hôte accueille la personne qui arrive.', C.welcome, 'unit-01', [PC]),
  vocab('word.eny', 'Eny', 'Oui', 'Réponse affirmative autonome.', C.yes, 'unit-01', [PC]),
  vocab('word.tsia', 'Tsia', 'Non', 'Réponse autonome, à distinguer de tsy dans une phrase.', C.no, 'unit-01', [PC]),
  vocab('word.tompoko', 'Tompoko', 'Adresse respectueuse', 'Peut accompagner une salutation ; ne marque pas le genre.', C.respect, 'unit-01', ['dict-tompoko']),
  vocab('word.aho', 'aho', 'je', 'Pronom sujet, par exemple dans Avy any Frantsa aho.', C.pronouns, 'unit-02', [PC, 'dict-aho']),
  vocab('word.ianao', 'ianao', 'tu / vous (une personne)', 'Le français tutoie ou vouvoie selon la situation.', C.pronouns, 'unit-02', [PC]),
  vocab('word.izy', 'izy', 'il / elle', 'Ne distingue pas le masculin et le féminin.', C.pronouns, 'unit-02', [PC]),
  vocab('word.anarako', 'anarako', 'mon nom', 'Dans Lova no anarako : je m’appelle Lova.', C.name, 'unit-02', [PC, 'dict-anarana']),
  vocab('word.anaranao', 'anaranao', 'ton / votre nom', 'Dans Iza no anaranao? : comment t’appelles-tu ?', C.name, 'unit-02', [PC, 'dict-anarana']),
  vocab('word.iza-name', 'Iza no anaranao?', 'Comment t’appelles-tu ?', 'Formule apprise en entier ; no n’est pas un verbe être.', C.name, 'unit-02', [PC, ARTICLE]),
  vocab('word.avy-aiza', 'Avy aiza ianao?', 'D’où viens-tu ?', 'Demande le lieu d’origine, pas forcément la nationalité.', C.origin, 'unit-02', [PC]),
  vocab('word.avy-any', 'Avy any Frantsa aho.', 'Je viens de France.', 'Modèle : avy any + lieu + aho.', C.origin, 'unit-02', [PC, 'dict-frantsa']),
  vocab('word.frantsa', 'Frantsa', 'France', 'Nom du pays, distinct de frantsay, français.', C.france, 'unit-02', ['dict-frantsa']),
  vocab('word.mpiofana', 'mpiofana', 'stagiaire', 'Mpiofana aho : je suis stagiaire, sans copule.', C.trainee, 'unit-03', [PC]),
  vocab('word.ny', 'ny', 'le / la / les selon le contexte', 'Article invariable ; pas toujours traduit par un article français.', C.article, 'unit-03', [ARTICLE, 'dict-ny']),
  vocab('word.tsy', 'tsy', 'ne… pas', 'Devant le prédicat dans les modèles étudiés.', C.negation, 'unit-03', [PC, 'dict-tsy']),
  vocab('word.ve', 've', 'marqueur de question oui/non', 'Mpiofana ve ianao? : es-tu stagiaire ?', C.question, 'unit-03', [PC, 'dict-ve']),
];
const instructions: Record<ExerciseType, string> = {
  choice: 'À toi !', match: 'Les mots se rencontrent', order: 'Construis la réponse',
  cloze: 'Un mot manque…', translate: 'À toi de parler', reading: 'Entre les bulles',
  dialogue: 'La conversation continue', culture: 'Une découverte', listening: 'À l’écoute',
};
function exercise(id: string, type: ExerciseType, question: string, answers: string[], concepts: string[], explanation: string, extra: Partial<Exercise> = {}): Exercise {
  return { id, type, answers, concepts, explanation, prompt: instructions[type], sourceIds: [PC], difficulty: 1, ...extra,
    question: SHORT_QUESTIONS[id] ?? question, context: undefined, dialogue: extra.dialogue ?? EXERCISE_DIALOGUES[id] };
}
export const EXERCISES: Exercise[] = [

  exercise('exercise-01-01-a', 'choice', 'Tu rencontres quelqu’un. Comment dire bonjour ?', ['Salama'], [C.hello], 'Salama sert à saluer. Veloma sert à prendre congé.', { selectionLanguage: 'mg', choices: ['Veloma', 'Salama', 'Misaotra'], sourceIds: [PC, 'dict-salama'] }),
  exercise('exercise-01-01-b', 'choice', 'Que veut dire « Misaotra » ?', ['Merci'], [C.thanks], 'On dit misaotra pour remercier quelqu’un.', { choices: ['Bonjour', 'Merci', 'Au revoir'], sourceIds: [PC, 'dict-misaotra'] }),
  exercise('exercise-01-01-c', 'dialogue', 'Tu veux attirer poliment l’attention avant de demander à passer. Que dis-tu ?', ['Azafady'], [C.please], 'Azafady peut servir d’excuse ou accompagner une demande.', { selectionLanguage: 'mg', context: 'À l’arrivée, une personne se trouve devant le passage. Tu souhaites lui parler avec politesse.', choices: ['Misaotra', 'Veloma', 'Azafady'], sourceIds: [PC, 'dict-azafady'] }),
  exercise('exercise-01-01-d', 'match', 'Relie les trois expressions.', [], [C.hello, C.goodbye, C.thanks], 'Salama ouvre la rencontre, misaotra remercie et veloma la termine.', { selectionLanguage: 'mg', pairs: [{ left: 'Salama', right: 'Bonjour' }, { left: 'Veloma', right: 'Au revoir' }, { left: 'Misaotra', right: 'Merci' }] }),
  exercise('exercise-01-01-e', 'translate', 'Traduis en malgache : « Au revoir ! »', ['Veloma'], [C.goodbye], 'Veloma est la formule de départ apprise ici.'),
  exercise('exercise-01-01-f', 'choice', 'Comme repère de départ, la lettre « o » correspond plutôt au son français…', ['ou, comme dans « vous »'], [C.spelling], 'Le manuel rapproche o du son /u/, comme le « ou » français. La prononciation réelle mérite un enregistrement natif.', { choices: ['o, comme dans « mot »', 'ou, comme dans « vous »', 'u, comme dans « rue »'] }),

  exercise('exercise-01-02-a', 'reading', 'Qui accueille l’autre avec « Tonga soa » ?', ['Lova accueille la personne qui arrive'], [C.welcome, C.hello], 'Tonga soa signifie bienvenue : la personne qui accueille le dit.', { context: 'Tu arrives devant la maison d’accueil.\nLova : Salama! Tonga soa!\nToi : Misaotra!', choices: ['La personne qui arrive accueille Lova', 'Lova accueille la personne qui arrive', 'Lova prend congé'] }),
  exercise('exercise-01-02-b', 'dialogue', 'Lova t’accueille. Quelle réponse convient pour remercier ?', ['Misaotra, tompoko.'], [C.thanks, C.respect, C.welcome], 'Misaotra remercie ; tompoko est une marque d’adresse respectueuse.', { selectionLanguage: 'mg', context: 'Lova : Tonga soa!', choices: ['Veloma, tompoko.', 'Misaotra, tompoko.', 'Tsia.'], sourceIds: [PC, 'dict-tompoko'] }),
  exercise('exercise-01-02-c', 'match', 'Associe ces nouveaux repères.', [], [C.yes, C.no, C.welcome], 'Eny signifie oui ; tsia est une réponse non ; tonga soa accueille.', { selectionLanguage: 'mg', pairs: [{ left: 'Eny', right: 'Oui' }, { left: 'Tsia', right: 'Non' }, { left: 'Tonga soa', right: 'Bienvenue' }] }),
  exercise('exercise-01-02-d', 'choice', 'Que marque « tompoko » dans une salutation ?', ['Une adresse respectueuse'], [C.respect], 'Tompoko s’adresse à quelqu’un avec respect, sans distinction de genre.', { choices: ['Un départ', 'Une adresse respectueuse', 'Une réponse négative'], sourceIds: ['dict-tompoko'] }),
  exercise('exercise-01-02-e', 'translate', 'Traduis en malgache : « Non. »', ['Tsia'], [C.no], 'Tsia s’emploie comme réponse autonome. La négation dans une phrase sera étudiée plus tard.'),
  exercise('exercise-01-02-f', 'dialogue', 'La rencontre se termine. Quelle formule choisis-tu ?', ['Veloma, tompoko.'], [C.goodbye, C.respect], 'Veloma, au revoir, est accompagné ici de tompoko, marque de respect.', { selectionLanguage: 'mg', context: 'Après cet accueil, Lova doit partir. Tu prends congé.', choices: ['Tonga soa!', 'Salama!', 'Veloma, tompoko.'], sourceIds: [PC, 'dict-tompoko'] }),

  exercise('exercise-01-03-a', 'translate', 'Tu écris un petit mot de remerciement. Traduis « Merci ! »', ['Misaotra'], [C.thanks], 'Pour remercier : misaotra. Azafady accompagne une demande ou une excuse.'),
  exercise('exercise-01-03-b', 'translate', 'Écris la formule malgache pour « excusez-moi / s’il vous plaît ».', ['Azafady', 'Aza fady'], [C.please], 'Azafady convient avant une demande. Les graphies azafady et aza fady sont toutes deux acceptées.', { context: 'Tu vas demander un renseignement à l’accueil.', sourceIds: [PC, 'dict-azafady'] }),
  exercise('exercise-01-03-c', 'match', 'Remets ces trois intentions en face des mots.', [], [C.hello, C.welcome, C.goodbye], 'Dire bonjour, accueillir et prendre congé sont trois intentions différentes.', { selectionLanguage: 'mg', pairs: [{ left: 'Salama', right: 'Saluer' }, { left: 'Tonga soa', right: 'Accueillir' }, { left: 'Veloma', right: 'Prendre congé' }] }),
  exercise('exercise-01-03-d', 'cloze', 'Pour répondre oui : « ___ »', ['Eny'], [C.yes], 'Eny est la réponse affirmative apprise dans cette unité.'),
  exercise('exercise-01-03-e', 'reading', 'Dans cet échange, quelle expression remercie ?', ['Misaotra'], [C.welcome, C.thanks, C.respect], 'Misaotra exprime le remerciement ; tompoko précise l’adresse respectueuse.', { selectionLanguage: 'mg', context: 'Lova : Tonga soa!\nToi : Misaotra, tompoko.', choices: ['Tonga soa', 'Tompoko', 'Misaotra'], sourceIds: [PC, 'dict-tompoko'] }),
  exercise('exercise-01-03-f', 'choice', 'Dans les mots étudiés ici, quel lien retenir entre « i » et « y » final ?', ['Ils renvoient à la même famille de son « i »'], [C.spelling], 'Le manuel présente i et y final ensemble. Ce repère écrit ne mesure pas une compétence d’écoute.', { choices: ['Le y final est toujours une consonne française', 'Ils renvoient à la même famille de son « i »', 'Le i se prononce comme « ou »'] }),
  exercise('exercise-01-03-g', 'dialogue', 'Refuse avec respect.', ['Tsia, tompoko.'], [C.no, C.respect], 'Tsia répond non ; tompoko ajoute une adresse respectueuse.', { selectionLanguage: 'mg', choices: ['Eny, tompoko.', 'Tsia, tompoko.', 'Tonga soa!'], dialogue: [{ speaker: 'mia', text: '…', translation: 'Tu déclines la place proposée d’un geste.' }], sourceIds: [PC, 'dict-tompoko'] }),
  exercise('exercise-01-03-h', 'order', 'Accueille Mia : « Bienvenue ! »', ['Tonga soa'], [C.welcome], 'Les deux mots tonga soa souhaitent la bienvenue.', { selectionLanguage: 'mg', tokens: ['soa', 'Tonga'], dialogue: [{ speaker: 'mia', text: 'Salama!', translation: 'Bonjour !' }] }),
  exercise('exercise-01-03-i', 'choice', 'Que fait Lova ?', ['Il salue Mia'], [C.hello], 'Salama ouvre la rencontre ; ce n’est ni un départ ni un remerciement.', { choices: ['Il remercie Mia', 'Il salue Mia', 'Il prend congé'], dialogue: [{ speaker: 'lova', text: 'Salama!', translation: 'Bonjour !' }], sourceIds: [PC, 'dict-salama'] }),
  exercise('exercise-01-03-j', 'cloze', 'Complète : « Veloma, ___ » pour rester respectueux.', ['tompoko'], [C.goodbye, C.respect], 'Veloma prend congé ; tompoko s’adresse à l’autre personne avec respect.', { dialogue: [{ speaker: 'lova', text: 'Veloma!', translation: 'Au revoir !' }, { speaker: 'mia', text: 'Veloma, …', translation: 'Au revoir, avec une adresse respectueuse.' }], sourceIds: [PC, 'dict-tompoko'] }),
  exercise('exercise-01-03-k', 'reading', 'Qui vient d’arriver ?', ['Mia'], [C.welcome, C.thanks], 'Lova accueille avec tonga soa ; Mia, qui vient d’arriver, remercie.', { choices: ['Mia', 'Lova', 'Personne : ils partent'], dialogue: [{ speaker: 'lova', text: 'Tonga soa!', translation: 'Bienvenue !' }, { speaker: 'mia', text: 'Misaotra!', translation: 'Merci !' }] }),
  exercise('exercise-01-03-l', 'match', 'Relie les réponses à leur sens.', [], [C.yes, C.no, C.please], 'Eny répond oui, tsia répond non ; azafady sert à demander avec politesse ou à s’excuser.', { selectionLanguage: 'mg', pairs: [{ left: 'Eny', right: 'Oui' }, { left: 'Tsia', right: 'Non' }, { left: 'Azafady', right: 'Excusez-moi' }], dialogue: [{ speaker: 'mia', text: 'Eny.', translation: 'Oui.' }, { speaker: 'lova', text: 'Tsia.', translation: 'Non.' }], sourceIds: [PC, 'dict-azafady'] }),

  exercise('exercise-02-01-a', 'choice', 'Que demande « Iza no anaranao? » ?', ['Comment t’appelles-tu ?'], [C.name], 'La question demande le nom de la personne à qui l’on parle.', { choices: ['D’où viens-tu ?', 'Comment t’appelles-tu ?', 'Veux-tu partir ?'], sourceIds: [PC, 'dict-anarana'] }),
  exercise('exercise-02-01-b', 'order', 'Présente-toi sous le prénom Lova : « Je m’appelle Lova. »', ['Lova no anarako'], [C.name], 'On apprend « prénom + no anarako » comme un ensemble. No n’est pas un verbe être.', { selectionLanguage: 'mg', tokens: ['anarako', 'Lova', 'no'], sourceIds: [PC, ARTICLE] }),
  exercise('exercise-02-01-c', 'match', 'Associe les trois pronoms singuliers.', [], [C.pronouns], 'Aho : je ; ianao : tu ou vous pour une personne ; izy : il ou elle.', { selectionLanguage: 'mg', pairs: [{ left: 'aho', right: 'je' }, { left: 'ianao', right: 'tu / vous (une personne)' }, { left: 'izy', right: 'il / elle' }] }),
  exercise('exercise-02-01-d', 'cloze', 'Pour demander « Comment t’appelles-tu ? » : « Iza no ___? »', ['anaranao'], [C.name], 'Anaranao signifie ton/votre nom ; anarako signifie mon nom.', { sourceIds: [PC, 'dict-anarana'] }),
  exercise('exercise-02-01-e', 'dialogue', 'Tu t’appelles Mia. Réponds à Lova.', ['Mia no anarako.'], [C.name, C.hello], 'Le prénom change, la formule reste : Mia no anarako.', { selectionLanguage: 'mg', context: 'Lova : Salama! Iza no anaranao?', choices: ['Lova no anarako.', 'Iza no anaranao?', 'Mia no anarako.'] }),
  exercise('exercise-02-01-f', 'translate', 'Traduis en français : « Lova no anarako. »', ["Je m'appelle Lova", 'Mon nom est Lova'], [C.name], 'Le locuteur donne son propre nom : Lova.'),

  exercise('exercise-02-02-a', 'reading', 'D’où vient Mia ?', ['De France'], [C.origin, C.france, C.name], 'Avy any Frantsa aho indique la provenance : je viens de France.', { context: 'Lova : Iza no anaranao?\nMia : Mia no anarako.\nLova : Avy aiza ianao?\nMia : Avy any Frantsa aho.', choices: ['De Madagascar', 'De France', 'Le texte ne donne pas son origine'], sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-02-02-b', 'order', 'Reconstruis : « Je viens de France. »', ['Avy any Frantsa aho'], [C.origin, C.france, C.pronouns], 'Dans ce modèle, le lieu suit avy any et le pronom sujet aho vient à la fin.', { selectionLanguage: 'mg', tokens: ['aho', 'Frantsa', 'Avy', 'any'], sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-02-02-c', 'dialogue', 'Tu veux connaître le lieu d’origine de Lova. Que demandes-tu ?', ['Avy aiza ianao?'], [C.origin, C.name], 'Avy aiza ianao demande l’origine ; Iza no anaranao demande le nom.', { selectionLanguage: 'mg', context: 'Les prénoms sont échangés. Tu poursuis la conversation.', choices: ['Iza no anaranao?', 'Avy aiza ianao?', 'Veloma!'] }),
  exercise('exercise-02-02-d', 'cloze', 'Complète « Avy any Frantsa ___ » pour dire « Je viens de France ».', ['aho'], [C.origin, C.pronouns], 'Aho désigne la personne qui parle : je.'),
  exercise('exercise-02-02-e', 'choice', 'Dans « Avy any Frantsa aho », que nomme « Frantsa » ?', ['Le pays : la France'], [C.france, C.origin], 'Frantsa est le nom du pays. Le lieu d’origine ne suffit pas à affirmer une nationalité.', { choices: ['Le prénom de la personne', 'Le pays : la France', 'Le pronom « je »'], sourceIds: ['dict-frantsa', PC] }),
  exercise('exercise-02-02-f', 'translate', 'Traduis en français : « Avy aiza ianao? »', ["D'où viens-tu", "D'où venez-vous", "Tu viens d'où", "Vous venez d'où"], [C.origin, C.pronouns], 'Ianao désigne une personne ; le français peut employer tu ou vous selon le contexte.'),

  exercise('exercise-02-03-a', 'dialogue', 'Lova pose une question. Réponds en donnant ton prénom Mia.', ['Mia no anarako.'], [C.name, C.hello], 'La réponse donne un nom : Mia no anarako.', { selectionLanguage: 'mg', context: 'Lova : Salama! Iza no anaranao?', choices: ['Avy any Frantsa aho.', 'Mia no anarako.', 'Veloma.'] }),
  exercise('exercise-02-03-b', 'translate', 'Traduis en malgache : « Je viens de France. »', ['Avy any Frantsa aho'], [C.origin, C.france, C.pronouns], 'Avy any + lieu + aho : le lieu d’origine précède le pronom.', { sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-02-03-c', 'reading', 'Quelle information Mia donne-t-elle dans sa deuxième phrase ?', ['Son lieu d’origine'], [C.name, C.origin, C.france], 'Mia no anarako donne le prénom ; Avy any Frantsa aho donne la provenance.', { context: 'Mia : Mia no anarako. Avy any Frantsa aho.', choices: ['Son lieu d’origine', 'Un remerciement', 'Le prénom de Lova'], sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-02-03-d', 'match', 'Associe ces petits repères de conversation.', [], [C.name, C.pronouns], 'Le suffixe change dans anarako/anaranao ; izy ne distingue pas il et elle.', { selectionLanguage: 'mg', pairs: [{ left: 'anarako', right: 'mon nom' }, { left: 'anaranao', right: 'ton / votre nom' }, { left: 'izy', right: 'il / elle' }], sourceIds: [PC, 'dict-anarana'] }),
  exercise('exercise-02-03-e', 'order', 'Pose la question : « D’où viens-tu ? »', ['Avy aiza ianao'], [C.origin, C.pronouns], 'La question de provenance apprise est Avy aiza ianao?', { selectionLanguage: 'mg', tokens: ['ianao', 'aiza', 'Avy'] }),
  exercise('exercise-02-03-f', 'dialogue', 'Tu quittes Lova après votre première conversation. Quelle phrase convient ?', ['Veloma, tompoko.'], [C.goodbye, C.respect], 'Une conversation se termine avec veloma ; tonga soa servirait à accueillir.', { selectionLanguage: 'mg', context: 'Vous avez échangé prénoms et origines. Il est temps de prendre congé.', choices: ['Tonga soa!', 'Iza no anaranao?', 'Veloma, tompoko.'], sourceIds: [PC, 'dict-tompoko'] }),
  exercise('exercise-02-03-g', 'cloze', 'Complète la réponse de Mia : « Mia no ___ »', ['anarako'], [C.name], 'Anarako signifie mon nom ; anaranao désigne le nom de la personne à qui l’on parle.', { dialogue: [{ speaker: 'lova', text: 'Iza no anaranao?', translation: 'Comment t’appelles-tu ?' }, { speaker: 'mia', text: 'Mia no …', translation: 'Je m’appelle Mia.' }], sourceIds: [PC, 'dict-anarana'] }),
  exercise('exercise-02-03-h', 'order', 'Tu joues Lova : présente-toi.', ['Lova no anarako'], [C.name], 'Pour donner son nom : prénom + no anarako.', { selectionLanguage: 'mg', tokens: ['no', 'Lova', 'anarako'], dialogue: [{ speaker: 'mia', text: 'Iza no anaranao?', translation: 'Comment t’appelles-tu ?' }], sourceIds: [PC, 'dict-anarana', ARTICLE] }),
  exercise('exercise-02-03-i', 'reading', 'Mia parle de quel pays ?', ['La France'], [C.origin, C.france], 'Frantsa est le nom de la France. La phrase indique la provenance.', { choices: ['La France', 'Madagascar', 'Aucun pays'], dialogue: [{ speaker: 'lova', text: 'Avy aiza ianao?', translation: 'D’où viens-tu ?' }, { speaker: 'mia', text: 'Avy any Frantsa aho.', translation: 'Je viens de France.' }], sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-02-03-j', 'match', 'Qui parle de qui ?', [], [C.pronouns], 'Aho : je ; ianao : tu ou vous pour une personne ; izy : il ou elle.', { selectionLanguage: 'mg', pairs: [{ left: 'aho', right: 'je' }, { left: 'ianao', right: 'tu / vous' }, { left: 'izy', right: 'il / elle' }], dialogue: [{ speaker: 'lova', text: 'Aho.', translation: 'Je.' }, { speaker: 'mia', text: 'Ianao.', translation: 'Tu · vous.' }] }),
  exercise('exercise-02-03-k', 'dialogue', 'Commence une rencontre avec respect.', ['Salama, tompoko.'], [C.hello, C.respect], 'Salama salue ; tompoko ajoute une adresse respectueuse.', { selectionLanguage: 'mg', choices: ['Salama, tompoko.', 'Veloma, tompoko.', 'Tsia.'], dialogue: [{ speaker: 'lova', text: 'Salama!', translation: 'Bonjour !' }], sourceIds: [PC, 'dict-tompoko'] }),
  exercise('exercise-02-03-l', 'cloze', 'Complète : « Avy ___ Frantsa aho »', ['any'], [C.origin, C.france, C.pronouns], 'Le modèle appris est avy any + lieu + aho.', { dialogue: [{ speaker: 'lova', text: 'Avy aiza ianao?', translation: 'D’où viens-tu ?' }, { speaker: 'mia', text: 'Avy … Frantsa aho.', translation: 'Je viens de France.' }], sourceIds: [PC, 'dict-frantsa'] }),

  exercise('exercise-03-01-a', 'order', 'Construis : « Je suis stagiaire. »', ['Mpiofana aho'], [C.predicate, C.trainee, C.pronouns], 'Mpiofana est le prédicat nominal ; aho est le sujet. On n’ajoute pas de verbe être dans cette phrase.', { selectionLanguage: 'mg', tokens: ['aho', 'Mpiofana'], sourceIds: [PC, KEENAN] }),
  exercise('exercise-03-01-b', 'choice', 'Dans « Mpiofana aho », quel mot est le sujet ?', ['aho'], [C.predicate, C.trainee, C.pronouns], 'Aho indique de qui on parle : je. Mpiofana donne le statut.', { spokenSelections: ['mpiofana', 'aho'], choices: ['mpiofana', 'aho', 'Un verbe être écrit'], sourceIds: [PC, KEENAN] }),
  exercise('exercise-03-01-c', 'cloze', 'Ajoute l’article étudié : « ___ mpiofana » (le/la stagiaire).', ['ny'], [C.article, C.trainee], 'Ny précède le nom. Il ne porte ni genre français ni marque de pluriel.', { sourceIds: [ARTICLE, 'dict-ny', PC] }),
  exercise('exercise-03-01-d', 'reading', 'Comment va le ou la stagiaire ?', ['Il ou elle est en bonne santé'], [C.predicate, C.article, C.trainee, C.hello], 'Salama est ici adjectif : en bonne santé. Ny mpiofana est le sujet.', { context: 'Salama ny mpiofana.', choices: ['Il ou elle est en bonne santé', 'Il ou elle prend congé', 'Il ou elle donne son nom'], sourceIds: ['dict-salama', 'dict-ny', PC, KEENAN] }),
  exercise('exercise-03-01-e', 'translate', 'Traduis en malgache : « Il est stagiaire. »', ['Mpiofana izy'], [C.predicate, C.trainee, C.pronouns], 'Mpiofana précède le sujet izy. Izy peut signifier il ou elle.', { sourceIds: [PC, KEENAN] }),
  exercise('exercise-03-01-f', 'choice', 'Quelle description correspond aux phrases de cette leçon ?', ['Un prédicat puis un sujet, sans ajouter une copule'], [C.predicate], 'C’est notre modèle de départ. Toutes les phrases malgaches ne suivent pas un ordre unique : voix et mise en relief seront approfondies plus tard.', { choices: ['Toujours le sujet puis le verbe français être', 'Un prédicat puis un sujet, sans ajouter une copule', 'Chaque phrase contient forcément un objet'], sourceIds: [PC, KEENAN] }),

  exercise('exercise-03-02-a', 'dialogue', 'Tu es stagiaire. Choisis la réponse affirmative complète.', ['Eny, mpiofana aho.'], [C.question, C.yes, C.predicate, C.trainee, C.pronouns], 'Ve pose la question. Pour répondre de soi, on passe de ianao à aho.', { selectionLanguage: 'mg', context: 'Lova : Mpiofana ve ianao?', choices: ['Tsia, tsy mpiofana aho.', 'Eny, mpiofana aho.', 'Iza no anaranao?'] }),
  exercise('exercise-03-02-b', 'order', 'Pose la question : « Es-tu stagiaire ? »', ['Mpiofana ve ianao'], [C.question, C.predicate, C.trainee, C.pronouns], 'Dans ce modèle, ve suit le prédicat mpiofana et précède le sujet ianao.', { selectionLanguage: 'mg', tokens: ['ianao', 'Mpiofana', 've'] }),
  exercise('exercise-03-02-c', 'cloze', 'Complète « ___ mpiofana aho » : « Je ne suis pas stagiaire. »', ['Tsy'], [C.negation, C.trainee, C.predicate], 'Tsy se place devant le prédicat. Tsia est la réponse autonome non.', { sourceIds: [PC, 'dict-tsy'] }),
  exercise('exercise-03-02-d', 'choice', 'Quelle différence entre « tsia » et « tsy » dans ce cours ?', ['Tsia répond non ; tsy nie le prédicat'], [C.no, C.negation], 'On peut dire : Tsia, tsy mpiofana aho — non, je ne suis pas stagiaire.', { choices: ['Tsia répond non ; tsy nie le prédicat', 'Les deux se remplacent partout', 'Tsy signifie oui ; tsia signifie merci'], sourceIds: [PC, 'dict-tsy'] }),
  exercise('exercise-03-02-e', 'reading', 'Mia est-elle stagiaire ?', ['Non'], [C.question, C.negation, C.no, C.trainee], 'Tsia et la négation tsy indiquent ici qu’elle n’est pas stagiaire.', { context: 'Lova : Mpiofana ve ianao?\nMia : Tsia, tsy mpiofana aho.', choices: ['Oui', 'Non', 'Elle donne seulement son nom'], sourceIds: [PC, 'dict-tsy'] }),
  exercise('exercise-03-02-f', 'translate', 'Traduis en malgache : « Je ne suis pas stagiaire. »', ['Tsy mpiofana aho'], [C.negation, C.predicate, C.trainee, C.pronouns], 'Tsy + prédicat + sujet : Tsy mpiofana aho.', { sourceIds: [PC, 'dict-tsy'] }),

  exercise('exercise-03-03-a', 'reading', 'Quelle phrase du texte exprime un statut ?', ['Mpiofana aho.'], [C.predicate, C.trainee, C.name, C.origin], 'Le nom est donné avec no anarako ; la provenance avec avy any ; le statut avec mpiofana.', { selectionLanguage: 'mg', context: 'Mia : Salama! Mia no anarako. Avy any Frantsa aho. Mpiofana aho.', choices: ['Mia no anarako.', 'Avy any Frantsa aho.', 'Mpiofana aho.'], sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-03-03-b', 'order', 'Reconstruis : « Le/la stagiaire est en bonne santé. »', ['Salama ny mpiofana'], [C.predicate, C.article, C.trainee, C.hello], 'Le prédicat adjectival salama précède le sujet ny mpiofana. Ny vient devant le nom.', { selectionLanguage: 'mg', tokens: ['mpiofana', 'ny', 'Salama'], sourceIds: [PC, 'dict-salama', 'dict-ny', KEENAN] }),
  exercise('exercise-03-03-c', 'dialogue', 'Tu n’es pas stagiaire. Réponds clairement à Lova.', ['Tsia, tsy mpiofana aho.'], [C.question, C.no, C.negation, C.trainee, C.pronouns], 'Tsia répond non ; tsy nie ensuite le statut dans la phrase complète.', { selectionLanguage: 'mg', context: 'Lova : Mpiofana ve ianao?', choices: ['Eny, mpiofana aho.', 'Tsia, tsy mpiofana aho.', 'Tonga soa!'], sourceIds: [PC, 'dict-tsy'] }),
  exercise('exercise-03-03-d', 'translate', 'Traduis en français : « Mpiofana ve ianao? »', ['Es-tu stagiaire', 'Êtes-vous stagiaire', 'Est-ce que tu es stagiaire', 'Est-ce que vous êtes stagiaire', 'Tu es stagiaire', 'Vous êtes stagiaire'], [C.question, C.trainee, C.pronouns], 'Ve marque une question oui/non ; le français peut tutoyer ou vouvoyer. La ponctuation interrogative est facultative dans la saisie.'),
  exercise('exercise-03-03-e', 'cloze', 'Lova demande ton origine. Complète « Avy ___ ianao? »', ['aiza'], [C.origin, C.pronouns], 'Avy aiza ianao est la question de provenance, réutilisée avec les nouveaux acquis.'),
  exercise('exercise-03-03-f', 'match', 'Associe les mots-outils à leur fonction.', [], [C.article, C.negation, C.question], 'Ny détermine un nom ; tsy nie le prédicat ; ve marque la question oui/non dans ce modèle.', { selectionLanguage: 'mg', pairs: [{ left: 'ny', right: 'article devant le nom' }, { left: 'tsy', right: 'négation du prédicat' }, { left: 've', right: 'question oui/non' }], sourceIds: [PC, 'dict-ny', 'dict-tsy', ARTICLE] }),
  exercise('exercise-03-03-g', 'choice', 'Que fait « ny » devant mpiofana ?', ['Il détermine le nom'], [C.article, C.trainee], 'Ny est ici un article devant le nom, sans marque de genre ou de nombre.', { choices: ['Il nie la phrase', 'Il détermine le nom', 'Il pose une question'], dialogue: [{ speaker: 'lova', text: 'Salama ny mpiofana.', translation: 'Le ou la stagiaire est en bonne santé.', highlight: 'ny' }], sourceIds: [PC, ARTICLE, 'dict-ny'] }),
  exercise('exercise-03-03-h', 'translate', 'Écris : « Je suis en bonne santé. »', ['Salama aho'], [C.predicate, C.hello, C.pronouns], 'Salama est le prédicat adjectival ; aho est le sujet.', { dialogue: [{ speaker: 'mia', text: '…', translation: 'Tu donnes de tes nouvelles : tu es en bonne santé.' }], sourceIds: [PC, KEENAN, 'dict-salama'] }),
  exercise('exercise-03-03-i', 'order', 'Réponds : « Je ne suis pas stagiaire. »', ['Tsy mpiofana aho'], [C.negation, C.predicate, C.trainee, C.pronouns], 'Tsy se place devant le prédicat, puis vient le sujet aho.', { selectionLanguage: 'mg', tokens: ['aho', 'Tsy', 'mpiofana'], dialogue: [{ speaker: 'lova', text: 'Mpiofana ve ianao?', translation: 'Es-tu stagiaire ?' }], sourceIds: [PC, 'dict-tsy'] }),
  exercise('exercise-03-03-j', 'dialogue', 'Tu viens de France : réponds à Lova.', ['Avy any Frantsa aho.'], [C.origin, C.france, C.pronouns], 'La réponse donne une provenance : avy any + lieu + aho.', { selectionLanguage: 'mg', choices: ['Mia no anarako.', 'Avy any Frantsa aho.', 'Mpiofana aho.'], dialogue: [{ speaker: 'lova', text: 'Avy aiza ianao?', translation: 'D’où viens-tu ?' }], sourceIds: [PC, 'dict-frantsa'] }),
  exercise('exercise-03-03-k', 'reading', 'Quel est le statut de Mia dans cette scène ?', ['Elle n’est pas stagiaire'], [C.name, C.origin, C.question, C.negation, C.no, C.trainee], 'Mia donne son nom et son origine, puis dit qu’elle n’est pas stagiaire avec tsia et tsy.', { choices: ['Elle est stagiaire', 'Elle n’est pas stagiaire', 'Elle donne seulement son prénom'], dialogue: [{ speaker: 'mia', text: 'Mia no anarako. Avy any Frantsa aho.', translation: 'Je m’appelle Mia. Je viens de France.' }, { speaker: 'lova', text: 'Mpiofana ve ianao?', translation: 'Es-tu stagiaire ?' }, { speaker: 'mia', text: 'Tsia, tsy mpiofana aho.', translation: 'Non, je ne suis pas stagiaire.' }], sourceIds: [PC, 'dict-frantsa', 'dict-tsy'] }),
  exercise('exercise-03-03-l', 'translate', 'Tu es Mia : écris ton prénom dans une phrase.', ['Mia no anarako'], [C.name], 'La rencontre peut commencer par Mia no anarako : je m’appelle Mia.', { dialogue: [{ speaker: 'lova', text: 'Salama! Iza no anaranao?', translation: 'Bonjour ! Comment t’appelles-tu ?' }], sourceIds: [PC, 'dict-anarana'] }),
];



function lesson(id: string, unitId: string, title: string, description: string, kind: Lesson['kind'], introduces: string[], reviews: string[], prerequisites: string[], notes: Lesson['notes'], sourceIds: string[]): Lesson {
  const prefix = id.replace('lesson-', 'exercise-');
  return { id, worldId: 'world-01', unitId, title, description, kind, introduces, reviews, prerequisites,
    objectives: [...introduces, ...reviews].map(conceptId => CONCEPTS.find(item => item.id === conceptId)!.objective),
    exerciseIds: EXERCISES.filter(item => item.id.startsWith(prefix + '-')).map(item => item.id), notes,
    estimatedMinutes: kind === 'checkpoint' ? 8 : 6, sourceIds, scenes: LESSON_SCENES[id] };
}
export const LESSONS: Lesson[] = [
  lesson(L.greetings, 'unit-01', 'Les mots qui ouvrent les portes', 'Quatre expressions pour ta première rencontre.', 'learn',
    [C.hello, C.goodbye, C.thanks, C.please, C.spelling], [], [], [
      { title: 'Un premier échange', body: 'Salama salue, misaotra remercie et veloma prend congé. Azafady accompagne une demande ou signifie excusez-moi. Apprends d’abord l’intention, puis le mot.', example: 'Salama! — Misaotra! — Veloma!', translation: 'Bonjour ! — Merci ! — Au revoir !' },
      { title: 'Une demande, une excuse', body: 'Selon le contexte, azafady correspond à s’il vous plaît ou excusez-moi. La graphie aza fady existe aussi. Ce n’est pas le mot pour dire merci.' },
      { title: 'Deux repères pour lire', body: 'Dans le malgache standard étudié ici, o se rapproche du « ou » de vous. Le i et le y final appartiennent à la même famille de son « i ». Ce sont des repères, pas une transcription de chaque mot. Sans enregistrement natif vérifié, aucune évaluation d’écoute ou de prononciation n’est proposée.' },
    ], [PC, 'dict-salama', 'dict-misaotra', 'dict-azafady']),
  lesson(L.welcome, 'unit-01', 'Une porte s’ouvre à Tana', 'Une première scène avec Lova, ton personnage de rencontre.', 'story',
    [C.welcome, C.yes, C.no, C.respect], [C.hello, C.goodbye, C.thanks, C.please], [L.greetings], [
      { title: 'L’histoire commence', body: 'Tu arrives à Antananarivo. Lova t’accueille devant une maison. Les personnages et la scène sont fictifs ; les formules viennent des références indiquées.', example: 'Lova : Salama! Tonga soa!', translation: 'Lova : Bonjour ! Bienvenue !' },
      { title: 'La réponse de l’invité', body: 'Tonga soa signifie bienvenue. Misaotra répond à cet accueil par un remerciement. Eny signifie oui, tsia signifie non.', example: 'Misaotra, tompoko.', translation: 'Merci, avec une adresse respectueuse.' },
      { title: 'Tompoko', body: 'Ce mot marque le respect dans l’adresse à une personne. Il peut s’adresser aussi bien à une femme qu’à un homme.' },
    ], [PC, 'dict-tompoko']),
  lesson(L.greetingReview, 'unit-01', 'Quiz final · Le premier échange', 'Douze défis pour terminer l’unité 1.', 'checkpoint', [],
    [C.hello, C.goodbye, C.thanks, C.please, C.spelling, C.welcome, C.yes, C.no, C.respect], [L.welcome], [
      { title: 'Ton premier carnet de voyage', body: 'Tu peux saluer, remercier, demander avec politesse, comprendre un accueil et prendre congé. Cette escale mélange ces intentions. Réussis au moins 80 % des activités pour ouvrir la suite.' },
    ], [PC, 'dict-tompoko', 'dict-azafady']),
  lesson(L.name, 'unit-02', 'Et toi, comment t’appelles-tu ?', 'Échange les prénoms et découvre trois pronoms.', 'learn',
    [C.name, C.pronouns], [C.hello, C.respect], [L.greetingReview], [
      { title: 'Une formule à garder entière', body: 'Iza no anaranao? demande le nom de la personne à qui tu parles. Pour répondre, place ton prénom devant no anarako. Anarako et anaranao signifient mon nom et ton/votre nom.', example: 'Mia no anarako.', translation: 'Je m’appelle Mia.' },
      { title: 'Qui parle de qui ?', body: 'Aho = je. Ianao = tu, ou vous lorsqu’on s’adresse à une personne. Izy = il ou elle, sans distinction de genre. Ces pronoms ne contiennent pas à eux seuls un verbe être.' },
      { title: 'Le petit mot no', body: 'Apprends no dans la formule du nom. Ce mot participe à la mise en relief ; il ne remplace pas mécaniquement le verbe français être dans toutes les phrases.' },
    ], [PC, 'dict-anarana', ARTICLE]),
  lesson(L.origin, 'unit-02', 'D’où vient ton voyage ?', 'Poursuis la conversation avec le lieu d’origine.', 'story',
    [C.origin, C.france], [C.name, C.pronouns, C.hello, C.thanks], [L.name], [
      { title: 'La conversation continue', body: 'Lova et Mia ont échangé leurs prénoms. Lova demande maintenant à Mia d’où elle vient. Lis les formules avant de répondre dans la scène.', example: 'Avy aiza ianao? — Avy any Frantsa aho.', translation: 'D’où viens-tu ? — Je viens de France.' },
      { title: 'Une origine, un modèle', body: 'Dans le modèle de réponse étudié : avy any + lieu + aho. Frantsa est le pays France. Le lieu d’origine et la nationalité sont deux informations différentes.' },
      { title: 'Les mots connus voyagent avec toi', body: 'Commence avec salama, donne ton prénom puis ton origine. Tu peux remercier avec misaotra et prendre congé avec veloma.' },
    ], [PC, 'dict-frantsa']),
  lesson(L.introReview, 'unit-02', 'Quiz final · Fais connaissance', 'Douze défis pour terminer l’unité 2.', 'checkpoint', [],
    [C.name, C.pronouns, C.origin, C.france, C.hello, C.goodbye, C.respect], [L.origin], [
      { title: 'Ta première conversation', body: 'Réponds à propos du personnage de la scène. Une question sur le nom attend un prénom ; une question sur l’origine attend un lieu. La révision réutilise aussi les mots de la première unité. Seuil : 80 %.' },
    ], [PC, 'dict-anarana', 'dict-frantsa', 'dict-tompoko']),
  lesson(L.predicate, 'unit-03', 'Penser la phrase autrement', 'Un prédicat, un sujet et le petit article ny.', 'learn',
    [C.predicate, C.trainee, C.article], [C.pronouns, C.hello, C.name], [L.introReview], [
      { title: 'Donner un statut', body: 'Mpiofana signifie stagiaire. Dans Mpiofana aho, le statut précède le sujet aho. C’est un prédicat nominal : on n’ajoute pas un équivalent écrit de être.', example: 'Mpiofana aho.', translation: 'Je suis stagiaire.' },
      { title: 'Décrire sans verbe être', body: 'Salama est aussi un adjectif : en bonne santé. Dans Salama aho, salama décrit et aho indique qui est décrit.', example: 'Salama aho.', translation: 'Je suis en bonne santé.' },
      { title: 'Le rôle de ny', body: 'Ny se place devant le nom : ny mpiofana, le/la stagiaire. L’article ne marque ni masculin/féminin ni singulier/pluriel. Sans autre contexte, nos exercices prennent ce groupe au singulier. Ny a aussi des usages génériques et ne correspond pas toujours à un article français.' },
      { title: 'Un modèle, pas une règle absolue', body: 'Nous commençons par prédicat puis sujet. Le malgache permet d’autres constructions selon la voix et la mise en relief. Le résumé « tout est verbe–objet–sujet » serait trompeur : nos phrases peuvent n’avoir ni verbe ni objet.' },
    ], [PC, KEENAN, ARTICLE, 'dict-ny', 'dict-salama']),
  lesson(L.questions, 'unit-03', 'Questionner, affirmer, nuancer', 'Ajoute ve et tsy à des phrases déjà comprises.', 'story',
    [C.negation, C.question], [C.predicate, C.trainee, C.pronouns, C.yes, C.no], [L.predicate], [
      { title: 'Le statut de Mia', body: 'Lova demande à Mia si elle est stagiaire. Chaque activité précise la situation du personnage : parfois oui, parfois non. Choisis selon ce contexte.', example: 'Mpiofana ve ianao?', translation: 'Es-tu stagiaire ?' },
      { title: 'Ve pose la question', body: 'Dans ce modèle, ve vient après le prédicat et avant le sujet : Mpiofana ve ianao? Il sert à une question oui/non. Avy aiza ianao? emploie plutôt un mot interrogatif.' },
      { title: 'Tsia et tsy : deux rôles', body: 'Tsia répond non. Tsy vient devant le prédicat pour nier la phrase. On peut utiliser les deux dans une réponse complète.', example: 'Tsia, tsy mpiofana aho.', translation: 'Non, je ne suis pas stagiaire.' },
      { title: 'Changer de point de vue', body: 'La question emploie ianao parce que Lova s’adresse à toi. Ta réponse emploie aho parce que tu parles de toi.', example: 'Eny, mpiofana aho.', translation: 'Oui, je suis stagiaire.' },
    ], [PC, 'dict-tsy']),
  lesson(L.sentenceReview, 'unit-03', 'Quiz final · Une vraie rencontre', 'Douze défis pour terminer l’unité 3 et relier tous tes acquis.', 'checkpoint', [],
    [C.name, C.origin, C.france, C.pronouns, C.hello, C.predicate, C.trainee, C.article, C.negation, C.question, C.no], [L.questions], [
      { title: 'Trois unités, un premier socle', body: 'Tu peux te présenter, comprendre une origine, construire un énoncé nominal simple, poser une question oui/non et nier un statut. Seuil : 80 %. Les unités 4 à 12 restent à écrire et à faire relire.' },
    ], [PC, KEENAN, ARTICLE, 'dict-ny', 'dict-tsy', 'dict-frantsa']),
];
export const UNITS: Unit[] = [
  { id: 'unit-01', worldId: 'world-01', number: 1, title: 'Bienvenue à Madagascar', malagasyTitle: 'Tonga soa!', description: 'Saluer, remercier et franchir les premières portes.', lessonIds: [L.greetings, L.welcome, L.greetingReview], implemented: true, objectives: ['Saluer et prendre congé', 'Choisir une formule de politesse', 'Découvrir des repères de lecture'] },
  { id: 'unit-02', worldId: 'world-01', number: 2, title: 'Faire connaissance', malagasyTitle: 'Iza no anaranao?', description: 'Un prénom, une origine et une première conversation.', lessonIds: [L.name, L.origin, L.introReview], implemented: true, objectives: ['Demander et donner son nom', 'Dire d’où l’on vient', 'Distinguer aho, ianao et izy'] },
  { id: 'unit-03', worldId: 'world-01', number: 3, title: 'Mes premières phrases', malagasyTitle: 'Mpiofana aho.', description: 'Comprendre une logique de phrase différente du français.', lessonIds: [L.predicate, L.questions, L.sentenceReview], implemented: true, objectives: ['Construire un prédicat nominal ou adjectival', 'Repérer ny', 'Questionner avec ve et nier avec tsy'] },
  ...([
    ['unit-04', 4, 'La famille et les proches', 'Des liens à raconter', ['Nommer les proches', 'Introduire la possession']],
    ['unit-05', 5, 'Une maison à découvrir', 'Les lieux du quotidien', ['Nommer des objets', 'Situer simplement un objet']],
    ['unit-06', 6, 'À table', 'Goûts et repas', ['Nommer aliments et boissons', 'Exprimer des besoins simples']],
    ['unit-07', 7, 'Compter et acheter', 'Nombres et quantités', ['Compter de 0 à 20', 'Découvrir les prix']],
    ['unit-08', 8, 'Poser les bonnes questions', 'Aller vers les autres', ['Distinguer les interrogatifs', 'Demander une information']],
    ['unit-09', 9, 'Trouver son chemin', 'Se déplacer en ville', ['Comprendre des directions', 'Demander une destination']],
    ['unit-10', 10, 'Les besoins du voyage', 'Se faire comprendre', ['Exprimer un besoin', 'Demander de répéter']],
    ['unit-11', 11, 'Les premières conversations', 'Relier les acquis', ['Combiner les situations connues', 'Comprendre de courts échanges']],
    ['unit-12', 12, 'L’aventure d’Antananarivo', 'Le défi du monde', ['Réviser cumulativement', 'Accomplir une aventure guidée']],
  ] as [string, number, string, string, string[]][]).map(([id, number, title, description, objectives]) => ({ id, worldId: 'world-01', number, title, malagasyTitle: 'À venir', description, lessonIds: [], implemented: false, objectives })),
];
/** Explicitly synthetic dialogue voices plus published human references; no listening XP. */
export const AUDIO: AudioAsset[] = [...SYNTHETIC_RECORDINGS, ...PROFILE_RECORDINGS, ...DIALOGUE_RECORDINGS];
export const CONTENT: Content = { worlds: WORLDS, units: UNITS, lessons: LESSONS, exercises: EXERCISES, concepts: CONCEPTS, vocabulary: VOCABULARY, sources: SOURCES, audio: AUDIO };
