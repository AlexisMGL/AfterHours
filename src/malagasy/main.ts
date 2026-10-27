import './style.css';
import './dialogue.css';
import './map.css';
import { CONTENT } from './content';
import type { Exercise, Lesson, Progress, World } from './types';
import { lessonAvailable, introduceLesson, recordAnswer, completeLesson, selectMixedExercises, dueConcepts, conceptStatus, playerLevel, streakDays, validateAnswer } from './engine';
import { loadProgress, saveProgress, parseSave, serializeSave, loadRecovery } from './storage';
import { icon, townArt } from './art';
import { renderWorldMap, miniIslandArt } from './map';
import { escapeHtml as e, emptyDraft, renderAnswerControls, answerValue, hasAnswer, tokensFor } from './exercise-view';
import { feedbackSound, completionSound, MalagasyAudio } from './audio';
import { renderLearningSession, sessionPassed } from './lesson-view';
import type { LearningSession } from './session';
import { characterArt } from './characters';
import { DialogueAudioPlayer, type DialogueAudioCue, type DialogueAudioEvent } from './dialogue-audio';
import { recordingForSelection } from './voice-bank';
import './voices.css';

type View = 'path' | 'worlds' | 'reviews' | 'vocabulary' | 'stats' | 'sources' | 'backup';
const app = document.querySelector<HTMLDivElement>('#app')!;
const loaded = loadProgress(CONTENT);
let progress = loaded.progress;
let storageWarning = loaded.error ?? '';
let view: View = readView();
let session: LearningSession | null = null;
let pendingImport: Progress | null = null;
let search = '';
const audio = new MalagasyAudio(CONTENT.audio);
const dialogueAudio = new DialogueAudioPlayer(CONTENT.audio, { onStatus: updateVoiceStatus });
dialogueAudio.muted = progress.settings.muted;
audio.muted = progress.settings.muted;
audio.onStatus = (status, message) => {
  if (!session || session.stage !== 'exercise') return;
  if (status === 'ended') session.audioReady = true;
  const statusElement = app.querySelector('#ma-audio-status');
  if (statusElement) statusElement.textContent = message ?? ({ loading: 'Chargement de l’enregistrement…', playing: 'Lecture en cours…', paused: 'Lecture en pause.', ended: 'Enregistrement écouté. Vous pouvez répondre.', error: 'Lecture impossible.' })[status];
  const submit = app.querySelector<HTMLButtonElement>('#ma-submit');
  if (submit) submit.disabled = !answerReady();
};
document.documentElement.lang = 'fr';
document.title = 'Malagasy Adventure · Afterhours';

function readView(): View {
  const hash = location.hash.slice(1);
  return ['path', 'worlds', 'reviews', 'vocabulary', 'stats', 'sources', 'backup'].includes(hash) ? hash as View : 'path';
}
const lessonById = (id: string): Lesson | undefined => CONTENT.lessons.find(lesson => lesson.id === id);
const completed = (id: string): boolean => progress.completedLessons.includes(id);
const activeLessons = (): Lesson[] => CONTENT.lessons.filter(lesson => CONTENT.units.find(unit => unit.id === lesson.unitId)?.implemented);
const nextLesson = (): Lesson | undefined => activeLessons().find(lesson => !completed(lesson.id) && lessonAvailable(lesson, progress, CONTENT));
const unitComplete = (id: string): boolean => { const lessons = CONTENT.lessons.filter(lesson => lesson.unitId === id); return lessons.length > 0 && lessons.every(lesson => completed(lesson.id)); };
const knownConcepts = (): number => Object.values(progress.concepts).filter(item => item.introduced).length;
const masteredConcepts = (): number => Object.values(progress.concepts).filter(item => conceptStatus(item) === 'mastered').length;
const averageMastery = (): number => { const known = Object.values(progress.concepts).filter(item => item.introduced); return known.length ? Math.round(known.reduce((total, item) => total + item.mastery, 0) / known.length * 100) : 0; };
const percent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
function persist(): void {
  if (!saveProgress(progress)) storageWarning = 'Le navigateur ne permet pas la sauvegarde locale. Exportez votre progression pour la conserver.';
}
function navigate(destination: View): void {
  session = null; audio.stop(); dialogueAudio.stop(); view = destination;
  history.replaceState(null, '', `#${view}`);
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
  app.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
}

function sidebar(): string {
  const links: [View, string, string][] = [['path', 'path', 'Mon parcours'], ['worlds', 'map', 'Carte des mondes'], ['reviews', 'review', 'Révisions'], ['vocabulary', 'book', 'Mon lexique'], ['stats', 'stats', 'Ma progression']];
  return `<aside class="ma-sidebar"><a class="ma-brand" href="/malagasy-adventure"><span class="ma-brand-icon">${icon('leaf', 26)}</span><span>malagasy<span>ADVENTURE</span></span></a><div class="ma-sidebar-label">LE VOYAGE</div><nav aria-label="Navigation principale">${links.map(([id, symbol, title]) => `<button data-view="${id}" class="${view === id && !session ? 'active' : ''}" ${view === id && !session ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span>${id === 'reviews' && dueConcepts(progress).length ? `<b>${dueConcepts(progress).length}</b>` : ''}</button>`).join('')}</nav><div class="ma-sidebar-postcard">${miniIslandArt()}<span>UNE ÎLE. MILLE RENCONTRES.</span><p>Le voyage commence<br>par un <em>salama.</em></p><small>Français → Malgache standard</small></div><nav class="ma-sidebar-bottom" aria-label="Ressources"><button data-view="sources" ${view === 'sources' ? 'aria-current="page"' : ''}>${icon('source')}<span>Sources & crédits</span></button><button data-view="backup" ${view === 'backup' ? 'aria-current="page"' : ''}>${icon('save')}<span>Ma sauvegarde</span></button><a href="/">↗<span>Retour à Afterhours</span></a></nav><div class="ma-edition"><span class="ma-online-dot"></span> CARNET N° 001 <span>ÉDITION DÉCOUVERTE</span></div></aside>`;
}
function topbar(): string {
  return `<header class="ma-topbar"><div class="ma-breadcrumb">MADAGASCAR <span>/</span> <strong>${session ? 'EN LEÇON' : ({ path: 'MON PARCOURS', worlds: 'LES DESTINATIONS', reviews: 'LES RÉVISIONS', vocabulary: 'MON LEXIQUE', stats: 'MA PROGRESSION', sources: 'LES RÉFÉRENCES', backup: 'MA SAUVEGARDE' })[view]}</strong></div><div class="ma-top-stats"><span title="Jours consécutifs d’activité" class="ma-streak">${icon('flame', 18)} <b>${streakDays(progress)}</b><span>jour${streakDays(progress) > 1 ? 's' : ''}</span></span><span class="ma-xp">${icon('star', 18)}<b>${progress.xp}</b> XP</span><button class="ma-sound" data-action="mute" aria-label="${progress.settings.muted ? 'Activer les sons' : 'Couper les sons'}" title="Sons de l’interface" aria-pressed="${!progress.settings.muted}">${icon('sound', 18)}${progress.settings.muted ? '<span class="ma-mute-slash"></span>' : ''}</button><span class="ma-avatar" title="Voyageur · niveau ${playerLevel(progress.xp)}">V<span>${playerLevel(progress.xp)}</span></span></div></header>`;
}
function pageHeading(kicker: string, title: string, description: string): string {
  return `<div class="ma-page-heading"><span class="ma-eyebrow">${kicker}</span><h1 tabindex="-1">${title}</h1><p>${description}</p></div>`;
}

function pathPage(): string {
  const next = nextLesson(), done = activeLessons().filter(lesson => completed(lesson.id)).length;
  const first = CONTENT.worlds[0];
  return `<section class="ma-welcome"><div><span class="ma-eyebrow"><i></i> TONGA SOA · BIENVENUE</span><h1 tabindex="-1">Un nouveau monde.<br><em>Un mot à la fois.</em></h1><p>Apprenez le malgache. Rencontrez une île.<br>Et faites de chaque petit pas une aventure.</p></div><div class="ma-welcome-stamp">${icon('compass', 35)}<span>LE GOÛT<br>DE LA DÉCOUVERTE</span></div></section><section class="ma-world-hero"><div class="ma-hero-copy"><div class="ma-hero-kicker"><span>MONDE 01</span> LES HAUTES TERRES</div><h2>${e(first.name)}</h2><p>Les premiers mots ouvrent les premières portes.</p><div class="ma-hero-progress"><span>${done} / ${activeLessons().length} leçons explorées</span><span>${percent(done / activeLessons().length * 100)} %</span><div><i style="width:${percent(done / activeLessons().length * 100)}%"></i></div></div><button class="ma-primary" data-action="${next ? 'continue' : 'review'}">${done ? next ? 'Continuer mon voyage' : 'Revoir mes acquis' : 'Commencer l’aventure'} ${icon('arrow', 18)}</button><span class="ma-hero-footnote">3 unités jouables · à votre rythme</span></div><div class="ma-hero-art">${townArt()}<div class="ma-hero-companions" aria-label="Lova et Mia, vos compagnons de voyage">${characterArt('lova', 'happy', 114)}${characterArt('mia', 'happy', 114)}</div><span class="ma-art-caption">ANTANANARIVO, MADAGASCAR</span></div></section><div class="ma-content-grid"><section class="ma-learning-path"><div class="ma-section-heading"><div><span class="ma-eyebrow">VOTRE ITINÉRAIRE</span><h2>Les premiers pas</h2></div><span class="ma-small-label">MONDE 01 / 20</span></div><div class="ma-unit-list">${CONTENT.units.filter(unit => unit.implemented).map(unit => {
    const lessons = unit.lessonIds.map(lessonById).filter((lesson): lesson is Lesson => !!lesson), isDone = unitComplete(unit.id), available = lessons.some(lesson => lessonAvailable(lesson, progress, CONTENT));
    const current = next?.unitId === unit.id;
    return `<article class="ma-unit ${current ? 'current' : ''} ${!available ? 'locked' : ''}"><div class="ma-unit-marker ${isDone ? 'complete' : current ? 'current' : ''}">${isDone ? icon('check', 20) : String(unit.number).padStart(2, '0')}</div><div class="ma-unit-content"><div class="ma-unit-title-row"><span class="ma-unit-label">UNITÉ ${String(unit.number).padStart(2, '0')}${current ? ' <b>VOUS ÊTES ICI</b>' : ''}</span><span class="ma-unit-status">${isDone ? 'Terminée' : available ? `${lessons.filter(lesson => completed(lesson.id)).length}/${lessons.length} leçons` : icon('lock', 14)}</span></div><h3>${e(unit.title)}</h3><p>${e(unit.description)}</p><div class="ma-lesson-steps">${lessons.map((lesson, i) => {
      const open = lessonAvailable(lesson, progress, CONTENT), finished = completed(lesson.id);
      return `<button class="ma-lesson-step ${finished ? 'done' : open ? 'available' : 'locked'}" data-lesson="${e(lesson.id)}" ${open ? '' : 'disabled'} aria-label="${e(lesson.title)}${finished ? ', terminée' : !open ? ', verrouillée' : ''}"><span>${finished ? icon('check', 15) : lesson.kind === 'checkpoint' ? icon('star', 15) : lesson.kind === 'story' ? icon('book', 15) : `${i + 1}`}</span><div><strong>${e(lesson.title)}</strong><small>${lesson.kind === 'checkpoint' ? 'Quiz final · 12 questions' : lesson.kind === 'story' ? 'Dialogue & mise en pratique' : `${lesson.estimatedMinutes} min · dialogue & jeu`}</small></div>${open ? '<span class="ma-step-arrow">↗</span>' : icon('lock', 13)}</button>`;
    }).join('')}</div></div></article>`;
  }).join('')}</div><details class="ma-future-units"><summary>La suite du premier monde <span>9 unités prévues ${icon('arrow', 16)}</span></summary><p>La découverte s’arrête après l’unité 3 dans cette édition. Voici la suite du programme, encore en préparation.</p>${CONTENT.units.filter(unit => !unit.implemented).map(unit => `<div><span>${String(unit.number).padStart(2, '0')}</span><strong>${e(unit.title)}</strong>${icon('lock', 14)}</div>`).join('')}</details></section><aside class="ma-path-aside"><section class="ma-daily-card"><div class="ma-card-title">${icon('compass', 20)}<h3>Le petit pas du jour</h3></div><p>Quelques minutes pour aller un peu plus loin.</p>${dailyGoal()}<div class="ma-daily-caption"><span>Objectif personnel</span><strong>${progress.settings.dailyGoal} exercices</strong></div></section><section class="ma-discovery-card"><span class="ma-eyebrow">LE MOT DU VOYAGE</span><span class="ma-featured-word" lang="mg">Salama</span><p>Bonjour · Salut</p><span class="ma-word-rule"></span><p class="ma-discovery-note">Une salutation simple pour commencer une rencontre.</p><button data-view="vocabulary">Ouvrir mon lexique ${icon('arrow', 16)}</button></section></aside></div><div class="ma-bottom-note">${icon('leaf', 18)}<span>Pas de course à la perfection. Juste le plaisir de progresser.</span></div>`;
}
function dailyGoal(): string {
  const today = new Date().toLocaleDateString('en-CA'), count = progress.history.filter(event => new Date(event.at).toLocaleDateString('en-CA') === today).length;
  return `<div class="ma-daily-ring" style="--ma-progress:${percent(count / progress.settings.dailyGoal * 100)}%"><div><strong>${Math.min(count, progress.settings.dailyGoal)}<small> / ${progress.settings.dailyGoal}</small></strong><span>exercices aujourd’hui</span></div></div>`;
}


function worldsPage(): string {
  return `${pageHeading('LE GRAND VOYAGE', 'Une île, vingt horizons.', 'Des Hautes Terres aux côtes de Madagascar : un programme progressif, une rencontre après l’autre.')}<div class="ma-worlds-layout">${renderWorldMap(CONTENT.worlds)}<div><div class="ma-info-banner">${icon('compass')}<p><strong>Le voyage prend forme.</strong> Antananarivo propose 3 unités jouables. Les 19 autres mondes présentent leur programme prévisionnel.</p></div><div class="ma-destination-list">${CONTENT.worlds.map(world => `<button class="ma-destination ${world.implemented ? 'open' : ''}" data-world="${e(world.id)}"><span class="ma-destination-number">${String(world.number).padStart(2, '0')}</span><span><strong>${e(world.name)}</strong><small>${e(world.subtitle)}</small></span>${world.implemented ? '<span class="ma-open-tag">EXPLORER ↗</span>' : icon('lock', 16)}</button>`).join('')}</div></div></div>`;
}
function reviewsPage(): string {
  const due = dueConcepts(progress), known = CONTENT.concepts.filter(concept => progress.concepts[concept.id]?.introduced), weakest = [...known].sort((a, b) => progress.concepts[a.id].mastery - progress.concepts[b.id].mastery).slice(0, 8);
  return `${pageHeading('ON N’OUBLIE PAS LES BELLES RENCONTRES', 'Un peu chaque jour.', 'Retrouvez les mots et les constructions déjà rencontrés, au moment où vous en avez besoin.')}<div class="ma-metric-grid"><div><span>À REVOIR AUJOURD’HUI</span><strong>${due.length}</strong><small>concepts arrivés à échéance</small></div><div><span>EN COURS D’APPRENTISSAGE</span><strong>${known.length - masteredConcepts()}</strong><small>concepts à consolider</small></div><div><span>ACQUIS DURABLES</span><strong>${masteredConcepts()}</strong><small>plusieurs réussites espacées</small></div></div><section class="ma-review-hero"><span class="ma-large-symbol">${icon('review', 55)}</span><div><span class="ma-eyebrow">VOTRE RENDEZ-VOUS AVEC LES MOTS</span><h2>${due.length ? 'C’est le bon moment pour réviser.' : known.length ? 'Gardez le lien avec vos acquis.' : 'Tout commence par une rencontre.'}</h2><p>${known.length ? 'Une courte session mélange vos acquis et privilégie les notions fragiles. Les notions inconnues restent à l’écart.' : 'Commencez votre première leçon pour retrouver ici vos premiers mots.'}</p><button class="ma-primary" data-action="${known.length ? 'review' : 'continue'}">${known.length ? 'Lancer une révision' : 'Découvrir ma première leçon'} ${icon('arrow', 18)}</button></div></section><div class="ma-section-heading"><h2>À consolider en douceur</h2><span class="ma-small-label">${weakest.length} NOTIONS</span></div>${weakest.length ? `<div class="ma-concept-grid">${weakest.map(concept => `<article class="ma-concept-card"><span class="ma-small-label">${concept.category === 'grammar' ? 'GRAMMAIRE' : concept.category === 'communication' ? 'COMMUNICATION' : 'VOCABULAIRE'}</span><h3>${e(concept.label)}</h3><div class="ma-slim-progress"><i style="width:${percent(progress.concepts[concept.id].mastery * 100)}%"></i></div><p>${percent(progress.concepts[concept.id].mastery * 100)} % · ${statusLabel(conceptStatus(progress.concepts[concept.id]))}</p><small>Prochaine révision : ${dateLabel(progress.concepts[concept.id].nextReview)}</small></article>`).join('')}</div>` : '<div class="ma-empty-state">Vos premières notions apparaîtront ici après une leçon.</div>'}<p class="ma-page-footnote">Les XP mesurent votre activité. La maîtrise évolue séparément, à chaque réponse et au fil des révisions.</p>`;
}
const dateLabel = (value: string | null): string => value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'après la première pratique';
function statusLabel(status: string): string { return ({ unseen: 'À découvrir', learning: 'En découverte', reviewing: 'À consolider', mastered: 'Maîtrisé', due: 'À revoir' })[status] ?? status; }
function vocabularyPage(): string {
  return `${pageHeading('VOTRE COLLECTION DE RENCONTRES', 'Des mots qui restent.', 'Un petit carnet pour retrouver les expressions des trois premières unités et suivre celles déjà découvertes.')}<div class="ma-lexicon-tools"><label for="ma-search">${icon('book')}<input id="ma-search" type="search" placeholder="Chercher un mot, une traduction…" value="${e(search)}"></label><span>${CONTENT.vocabulary.length} EXPRESSIONS DOCUMENTÉES</span></div><div id="ma-lexicon-results">${vocabularyResults()}</div>`;
}
function vocabularyResults(): string {
  const words = CONTENT.vocabulary.filter(word => `${word.malagasy} ${word.french} ${word.note}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  return words.length ? `<div class="ma-lexicon-grid">${words.map(word => { const known = progress.concepts[word.conceptId]?.introduced; return `<article class="ma-word-card"><div><span class="ma-small-label">UNITÉ ${CONTENT.units.find(unit => unit.id === word.unitId)?.number ?? '—'}</span><span class="ma-word-state ${known ? 'known' : ''}">${known ? 'Découvert' : 'À découvrir'}</span></div><h2 lang="mg">${e(word.malagasy)}</h2><p>${e(word.french)}</p><small>${e(word.note)}</small></article>`; }).join('')}</div>` : '<p class="ma-empty-state">Aucune expression ne correspond à votre recherche.</p>';
}
function statsPage(): string {
  const successful = progress.history.filter(event => event.correct).length, completedUnits = CONTENT.units.filter(unit => unitComplete(unit.id)).length;
  return `${pageHeading('CHAQUE PAS COMPTE', 'Votre carnet de progrès.', 'Une leçon terminée est une étape. Une notion retenue est un acquis qui se construit avec le temps.')}<div class="ma-metric-grid"><div><span>EXPÉRIENCE</span><strong>${progress.xp}<small> XP</small></strong><small>Niveau ${playerLevel(progress.xp)}</small></div><div><span>LEÇONS TERMINÉES</span><strong>${progress.completedLessons.length}<small> / ${activeLessons().length}</small></strong><small>${completedUnits} / 3 unités validées</small></div><div><span>MAÎTRISE MOYENNE</span><strong>${averageMastery()}<small> %</small></strong><small>sur ${knownConcepts()} notions découvertes</small></div></div><div class="ma-two-columns"><section class="ma-panel"><div class="ma-card-title">${icon('stats')}<h2>Votre pratique en chiffres</h2></div><dl class="ma-stats-list"><div><dt>Réponses données</dt><dd>${progress.history.length}</dd></div><div><dt>Réussites</dt><dd>${successful}</dd></div><div><dt>Précision de l’historique</dt><dd>${progress.history.length ? percent(successful / progress.history.length * 100) : 0} %</dd></div><div><dt>Jours d’activité</dt><dd>${progress.activityDates.length}</dd></div><div><dt>Série en cours</dt><dd>${streakDays(progress)} jours</dd></div><div><dt>Notions maîtrisées</dt><dd>${masteredConcepts()}</dd></div></dl><p class="ma-page-footnote">Historique limité aux dernières réponses conservées. Aucun niveau de langue officiel n’est déduit de ces statistiques.</p></section><section class="ma-panel"><div class="ma-card-title">${icon('star')}<h2>Les petites victoires</h2></div>${[['first-lesson', 'Le premier pas', 'Terminer votre première leçon.'], ['three-lessons', 'Le goût du voyage', 'Terminer trois leçons.'], ['first-unit', 'Première escale', 'Réussir un premier bilan d’unité.']].map(([id, name, description]) => `<div class="ma-achievement ${progress.achievements.includes(id) ? 'earned' : ''}"><span>${icon(progress.achievements.includes(id) ? 'star' : 'lock', 22)}</span><div><h3>${name}</h3><p>${description}</p></div>${progress.achievements.includes(id) ? icon('check', 18) : ''}</div>`).join('')}</section></div>`;
}
function sourcesPage(): string {
  return `${pageHeading('APPRENDRE AVEC CONFIANCE', 'Des mots, des sources.', 'Le contenu linguistique est accompagné de ses références. Les exercices et illustrations ont été créés pour cette application.')}<div class="ma-source-summary"><span>${icon('source', 28)}</span><div><h2>Une base documentée, une validation à poursuivre.</h2><p>Les références ci-dessous étayent les premières unités en malgache standard. Une relecture par une personne malgachophone reste nécessaire avant une diffusion pédagogique large. Le programme des mondes futurs est prévisionnel.</p></div></div><div class="ma-section-heading"><h2>Références effectivement consultées</h2><span class="ma-small-label">REGISTRE DES SOURCES</span></div><div class="ma-source-list">${CONTENT.sources.filter(source => source.consulted).map(source => `<article id="source-${e(source.id)}"><div><span class="ma-small-label">${e(source.category.toUpperCase())}${source.date ? ` · ${e(source.date)}` : ''}</span><h3><a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)} ↗</a></h3><span class="ma-source-author">${e(source.author)}</span><p>${e(source.supports)}</p><small>${e(source.license)}</small></div></article>`).join('')}</div>${CONTENT.sources.some(source => !source.consulted) ? `<div class="ma-section-heading"><h2>Pour aller plus loin</h2></div><p>Ces références sont proposées en complément et n’ont pas servi à valider les exercices de cette édition.</p>${CONTENT.sources.filter(source => !source.consulted).map(source => `<p><a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)} ↗</a></p>`).join('')}` : ''}<div class="ma-two-columns"><section class="ma-panel"><h2>Prononciation & audio</h2><p>Les 35 répliques complètes des trois unités disposent d’une voix numérique malgache, produite avec le modèle MMS spécialisé pour cette langue. La lecture se déclenche dans les dialogues et au clic sur une réponse malgache, même incorrecte. Le haut-parleur permet de réécouter et le bouton 0,75× de ralentir. Les textes à trous restent silencieux pour ne pas inventer ni révéler un mot absent.</p><p>Le modèle fournit une seule voix. Pour distinguer Mia, son timbre est relevé de deux demi-tons, à vitesse inchangée : ce traitement ne constitue pas une seconde voix féminine native. Le mot Azafady utilise l’enregistrement humain non modifié de Manantiana, en remplacement de la synthèse signalée comme fautive. La synthèse n’a pas été validée phrase par phrase par un enseignant malgachophone : la prononciation ne peut pas être garantie parfaite. Les fichiers sont identifiés comme synthétiques et ne valident aucune compétence orale. La licence du modèle est non commerciale. Les huit enregistrements humains de Manantiana, Jagwar et Bluerose25 restent conservés comme références complémentaires.</p></section><section class="ma-panel"><h2>Images & réutilisation</h2><p>Personnages, illustration d’Antananarivo et icônes : dessins vectoriels originaux créés pour Afterhours. Le fond géographique de la carte provient de Natural Earth, cité ci-dessus. Les voix humaines réutilisées sont distribuées localement avec les licences et attributions indiquées ci-dessus ; aucun média distant n’est chargé à l’utilisation.</p><p>Les références sont citées pour étayer les connaissances. Cela n’implique aucune autorisation de recopier leurs cours ou leurs enregistrements.</p></section></div>`;
}
function recoveryNotice(): string {
  return loadRecovery() ? '<section class="ma-panel"><h2>Une copie à examiner</h2><p>Une ancienne sauvegarde illisible a été conservée séparément avant la création du nouveau carnet. Vous pouvez la télécharger pour la faire examiner ; elle ne peut pas être importée en l’état.</p><button class="ma-secondary" data-action="export-recovery">Télécharger la copie conservée</button></section>' : '';
}
function backupPage(): string {
  return `${pageHeading('VOTRE VOYAGE VOUS APPARTIENT', 'Gardez une trace.', 'Votre progression est enregistrée automatiquement dans ce navigateur, sur cet appareil.')}${recoveryNotice()}<div class="ma-two-columns"><section class="ma-panel ma-backup-panel"><span class="ma-panel-icon">${icon('save', 34)}</span><h2>Emporter mon carnet</h2><p>Téléchargez une sauvegarde JSON contenant votre progression, vos préférences et le calendrier de vos révisions.</p><button class="ma-primary" data-action="export">Exporter ma sauvegarde ${icon('save', 17)}</button><small>${progress.completedLessons.length} leçons · ${progress.xp} XP · format v1</small></section><section class="ma-panel ma-backup-panel"><span class="ma-panel-icon">${icon('review', 34)}</span><h2>Reprendre un voyage</h2><p>Choisissez une sauvegarde. Vous pourrez consulter son contenu avant de confirmer le remplacement de votre carnet actuel.</p><button class="ma-secondary" data-action="import">Importer une sauvegarde ${icon('arrow', 17)}</button><input id="ma-import-file" type="file" accept="application/json,.json" hidden><small>Fichier JSON uniquement · taille maximale : 2 Mo</small></section></div><div class="ma-info-banner">${icon('source')}<p><strong>Un carnet local, sans compte.</strong> Effacer les données du site ou changer d’appareil peut faire perdre votre progression. Une exportation permet de la retrouver. Aucune synchronisation cloud n’est activée.</p></div><section class="ma-panel ma-preferences"><h2>À votre rythme</h2><label for="ma-daily-goal">Objectif quotidien<select id="ma-daily-goal">${[5, 10, 15, 20].map(goal => `<option value="${goal}" ${progress.settings.dailyGoal === goal ? 'selected' : ''}>${goal} exercices</option>`).join('')}</select></label><button class="ma-secondary" data-action="mute">${progress.settings.muted ? 'Activer' : 'Couper'} les sons de l’interface</button></section>`;
}

function sessionPage(): string {
  return renderLearningSession(session!, progress, CONTENT, nextLesson());
}

function render(autoplayVoices = false): void {
  app.innerHTML = `<div class="ma-app ${session ? 'ma-in-session' : ''}">${sidebar()}<div class="ma-workspace">${topbar()}${storageWarning ? `<div class="ma-storage-warning" role="status">${e(storageWarning)} <button data-view="backup">Ma sauvegarde</button></div>` : ''}<main class="ma-main" id="ma-main">${session ? sessionPage() : ({ path: pathPage, worlds: worldsPage, reviews: reviewsPage, vocabulary: vocabularyPage, stats: statsPage, sources: sourcesPage, backup: backupPage })[view]()}</main><footer class="ma-footer"><span>MALAGASY ADVENTURE <i>par Afterhours</i></span><span>APPRENDRE. RENCONTRER. EXPLORER.</span></footer></div><dialog class="ma-dialog" id="ma-dialog" aria-labelledby="ma-dialog-title"></dialog><div class="ma-toast" id="ma-toast" role="status" aria-live="polite"></div></div>`;
  synchronizeVoices(autoplayVoices);
}

function visibleVoiceCues(): { context: string; cues: DialogueAudioCue[] } | null {
  const scene = app.querySelector<HTMLElement>('[data-dialogue-context]');
  if (!scene) return null;
  const cues = [...scene.querySelectorAll<HTMLButtonElement>('.ma-voice-replay[data-audio-id]')].map(button => ({
    key: button.dataset.voiceKey!, audioId: button.dataset.audioId!,
    text: button.closest('.ma-speech')?.querySelector('.ma-speech-text')?.textContent ?? '',
  }));
  return { context: scene.dataset.dialogueContext!, cues };
}
function synchronizeVoices(autoplay: boolean): void {
  if (!session || session.stage === 'done') { dialogueAudio.stop(); return; }
  const visible = visibleVoiceCues();
  if (!visible) { dialogueAudio.stop(); return; }
  dialogueAudio.rate = 1;
  dialogueAudio.sync(visible.context, visible.cues, { autoplay });
}
function updateVoiceStatus(event: DialogueAudioEvent): void {
  for (const bubble of app.querySelectorAll<HTMLElement>('.ma-speech[data-voice-key]')) {
    const active = event.turnKey === bubble.dataset.voiceKey;
    const state = active ? event.state : 'idle';
    bubble.dataset.voiceState = state;
    for (const button of bubble.querySelectorAll<HTMLButtonElement>('.ma-voice-replay, .ma-voice-slow')) {
      button.setAttribute('aria-busy', String(state === 'loading'));
      button.setAttribute('aria-pressed', String(state === 'playing' && button.classList.contains('ma-voice-replay')));
    }
    const status = bubble.querySelector<HTMLElement>('.ma-voice-status');
    if (status) status.textContent = active && (event.state === 'blocked' || event.state === 'error') ? event.message ?? 'Lecture indisponible. Touchez le haut-parleur pour réessayer.' : '';
  }
}
function replayDialogue(key: string, slow: boolean): void {
  const cue = visibleVoiceCues()?.cues.find(item => item.key === key);
  if (!cue) return;
  if (progress.settings.muted) { toast('Le son est coupé. Activez-le pour écouter.'); return; }
  void dialogueAudio.replay(cue, slow ? .75 : 1);
}

function pronounceSelection(text: string): void {
  if (!session || progress.settings.muted) return;
  const exercise = session.exercises[session.index];
  const recording = recordingForSelection(exercise, text);
  if (!recording) return;
  audio.stop();
  void dialogueAudio.replay({ key: `selection:${exercise.id}:${text}`, audioId: recording.id, text }, 1).then(result => {
    if (result === 'error' || result === 'blocked') toast('Lecture indisponible. Touchez à nouveau la réponse pour réessayer.');
  });
}

function startLesson(id: string): void {
  const lesson = lessonById(id);
  if (!lesson || !lessonAvailable(lesson, progress, CONTENT)) return;
  audio.stop();
  dialogueAudio.stop();
  // Prepare the bank without exposing unseen dialogue words to the review centre.
  const prospective = introduceLesson(progress, lesson, CONTENT);
  const authored = lesson.exerciseIds.map(exerciseId => CONTENT.exercises.find(exercise => exercise.id === exerciseId)).filter((exercise): exercise is Exercise => !!exercise && exercise.concepts.every(conceptId => prospective.concepts[conceptId]?.introduced));
  // Keep the conversational arc intact; add two encountered recalls after it.
  const earlierIds = new Set(CONTENT.lessons.filter(item => progress.completedLessons.includes(item.id) && item.id !== lesson.id).flatMap(item => item.exerciseIds));
  const recalls = selectMixedExercises(CONTENT, progress, null, CONTENT.exercises.length).filter(exercise => earlierIds.has(exercise.id) && !lesson.exerciseIds.includes(exercise.id)).slice(0, 2);
  const exercises = lesson.kind === 'checkpoint' ? authored : [...authored, ...recalls];
  if (!exercises.length) { toast('Cette leçon n’a pas encore d’exercices disponibles.'); return; }
  session = { lesson, exercises, index: 0, correct: 0, draft: emptyDraft(), answered: false, wasCorrect: false, stage: 'notes', review: false, xpBefore: progress.xp, sceneIndex: 0, revealedTurns: 1, combo: 0, maxCombo: 0, lastReward: 0, results: [] };
  render(true); window.scrollTo(0, 0); app.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}
function startReview(): void {
  audio.stop();
  dialogueAudio.stop();
  const exercises = selectMixedExercises(CONTENT, progress, null, 8);
  if (!exercises.length) { navigate('path'); return; }
  const lesson: Lesson = { id: 'review-session', worldId: '', unitId: '', title: 'Le rendez-vous des révisions', description: 'Retrouver les notions déjà découvertes.', kind: 'checkpoint', objectives: [], introduces: [], reviews: [], prerequisites: [], exerciseIds: exercises.map(exercise => exercise.id), notes: [], estimatedMinutes: 5, sourceIds: [] };
  session = { lesson, exercises, index: 0, correct: 0, draft: emptyDraft(), answered: false, wasCorrect: false, stage: 'exercise', review: true, xpBefore: progress.xp, sceneIndex: 0, revealedTurns: 1, combo: 0, maxCombo: 0, lastReward: 0, results: [] };
  render(true); window.scrollTo(0, 0); app.querySelector<HTMLElement>('#ma-question')?.focus();
}
function checkAnswer(): void {
  if (!session || session.stage !== 'exercise' || session.answered) return;
  const exercise = session.exercises[session.index];
  if (!answerReady()) return;
  dialogueAudio.stop();
  session.wasCorrect = validateAnswer(exercise, answerValue(exercise, session.draft));
  session.answered = true; session.correct += Number(session.wasCorrect);
  session.combo = session.wasCorrect ? session.combo + 1 : 0;
  session.maxCombo = Math.max(session.maxCombo, session.combo);
  session.results.push({ exerciseId: exercise.id, correct: session.wasCorrect });
  const previousXp = progress.xp;
  progress = recordAnswer(progress, exercise, session.wasCorrect); persist();
  session.lastReward = progress.xp - previousXp;
  feedbackSound(session.wasCorrect, progress.settings.muted, session.combo);
  render();
  const continueButton = app.querySelector<HTMLElement>('[data-action="next-exercise"]');
  continueButton?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  continueButton?.focus({ preventScroll: true });
}
function advanceExercise(): void {
  if (!session?.answered) return;
  if (session.index + 1 < session.exercises.length) {
    audio.stop(); session.audioReady = false;
    session.index++; session.draft = emptyDraft(); session.answered = false; session.wasCorrect = false;
  } else {
    if (!session.review) progress = completeLesson(progress, session.lesson, session.correct, session.exercises.length);
    persist(); session.stage = 'done';
    if (sessionPassed(session)) completionSound(progress.settings.muted, !session.review && session.lesson.kind === 'checkpoint');
  }
  render(true); window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = app.querySelector<HTMLElement>('#ma-question, .ma-completion h1');
  heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
}
function updateTask(focusKey?: string): void {
  if (!session) return;
  const exercise = session.exercises[session.index], controls = app.querySelector('.ma-answer-controls');
  if (controls) controls.innerHTML = renderAnswerControls(exercise, session.draft, session.answered);
  const submit = app.querySelector<HTMLButtonElement>('#ma-submit');
  if (submit) submit.disabled = !answerReady();
  if (focusKey) [...app.querySelectorAll<HTMLElement>('[data-focus]')].find(element => element.dataset.focus === focusKey)?.focus({ preventScroll: true });
}
function advanceDialogue(): void {
  if (!session || session.stage !== 'notes') return;
  const scene = session.lesson.scenes?.[session.sceneIndex];
  if (!scene) return;
  if (session.revealedTurns < scene.turns.length) session.revealedTurns++;
  else if (session.sceneIndex + 1 < (session.lesson.scenes?.length ?? 0)) { session.sceneIndex++; session.revealedTurns = 1; }
  render(true);
  app.querySelector<HTMLElement>('.ma-dialogue-actions .ma-primary')?.focus({ preventScroll: true });
}
function answerReady(): boolean {
  if (!session) return false;
  const exercise = session.exercises[session.index];
  return hasAnswer(exercise, session.draft) && (exercise.type !== 'listening' || session.audioReady === true);
}
async function playLanguageAudio(replay: boolean, rate = 1): Promise<void> {
  if (!session) return;
  const exercise = session.exercises[session.index];
  if (exercise.type !== 'listening' || !exercise.audioId) return;
  if (progress.settings.muted) { toast('Activez le son dans les préférences pour écouter cet enregistrement.'); return; }
  if (replay) audio.stop();
  try { await audio.play(exercise.audioId, rate); }
  catch { toast('Lecture impossible. Aucune réussite d’écoute n’est accordée sans lecture complète.'); }
}
function showDialog(title: string, body: string): void {
  const dialog = app.querySelector<HTMLDialogElement>('#ma-dialog')!;
  dialog.innerHTML = `<div class="ma-dialog-heading"><span class="ma-eyebrow">VOTRE CARNET DE VOYAGE</span><button data-action="close-dialog" class="ma-icon-button" aria-label="Fermer">${icon('close')}</button></div><h2 id="ma-dialog-title">${e(title)}</h2>${body}`;
  dialog.showModal();
}
function worldDetails(id: string): void {
  const world = CONTENT.worlds.find(item => item.id === id);
  if (!world) return;
  const items = (title: string, values: string[]) => `<h3>${title}</h3><ul>${values.map(value => `<li>${e(value)}</li>`).join('')}</ul>`;
  showDialog(`${String(world.number).padStart(2, '0')} · ${world.name}`, `<p class="ma-dialog-intro">${e(world.subtitle)}</p><p>${e(world.description)}</p>${world.implemented ? '<span class="ma-open-tag">3 UNITÉS JOUABLES</span>' : '<span class="ma-planned-tag">DESTINATION EN PRÉPARATION · VERROUILLÉE</span>'}${items('Les mots à rencontrer', world.vocabulary)}${items('Les constructions à découvrir', world.grammar)}${items('Ce que vous apprendrez à faire', world.skills)}<h3>L’escale culturelle</h3><p>${e(world.culture)}</p><small>${world.estimatedHours} heures indicatives pour le programme complet de ce monde. ${world.implemented ? 'Cette édition couvre les trois premières unités.' : 'Ce programme est une hypothèse pédagogique à valider avant publication des leçons.'}</small>${world.implemented ? '<button class="ma-primary" data-view="path">Retrouver mon parcours ↗</button>' : ''}`);
}

let toastTimeout = 0;
function toast(message: string): void {
  const element = app.querySelector<HTMLElement>('#ma-toast')!;
  element.textContent = message; element.classList.add('visible');
  window.clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => element.classList.remove('visible'), 5500);
}
function exportSave(): void {
  const blob = new Blob([serializeSave(progress)], { type: 'application/json' }), url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `malagasy-adventure-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Votre carnet a été exporté.');
}
function exportRecovery(): void {
  const raw = loadRecovery();
  if (!raw) { toast('Aucune copie de récupération disponible.'); return; }
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })), link = document.createElement('a');
  link.href = url; link.download = 'malagasy-copie-a-examiner.json'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function previewImport(file?: File): Promise<void> {
  pendingImport = null;
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Le fichier dépasse la limite de 2 Mo.');
    const candidate = parseSave(await file.text(), CONTENT);
    pendingImport = candidate;
    showDialog('Reprendre ce voyage ?', `<p>Vérifiez ce carnet avant de remplacer votre progression actuelle.</p><dl class="ma-stats-list"><div><dt>Dernière activité</dt><dd>${e(new Date(candidate.updatedAt).toLocaleString('fr-FR'))}</dd></div><div><dt>Leçons terminées</dt><dd>${candidate.completedLessons.length}</dd></div><div><dt>Expérience</dt><dd>${candidate.xp} XP</dd></div><div><dt>Notions découvertes</dt><dd>${Object.keys(candidate.concepts).length}</dd></div></dl><p class="ma-import-warning">Confirmer remplacera le carnet actuel (${progress.xp} XP). Vous pouvez l’exporter avant de continuer.</p><div class="ma-dialog-actions"><button class="ma-secondary" data-action="export">Exporter le carnet actuel</button><button class="ma-primary" data-action="confirm-import">Remplacer mon carnet</button><button class="ma-text-link" data-action="close-dialog">Annuler</button></div>`);
  } catch (error) {
    showDialog('Ce carnet ne peut pas être ouvert', `<p role="alert">${e(error instanceof Error ? error.message : 'Sauvegarde invalide.')}</p><p>Votre progression actuelle est conservée.</p><button class="ma-secondary" data-action="close-dialog">Fermer</button>`);
  }
}

app.addEventListener('submit', event => { if ((event.target as HTMLElement).id === 'ma-exercise-form') { event.preventDefault(); checkAnswer(); } });
app.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'ma-answer' && session && !session.answered) { session.draft.text = input.value; const submit = app.querySelector<HTMLButtonElement>('#ma-submit'); if (submit) submit.disabled = !answerReady(); }
  if (input.id === 'ma-search') { search = input.value; const results = app.querySelector('#ma-lexicon-results'); if (results) results.innerHTML = vocabularyResults(); }
});
app.addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'ma-import-file') void previewImport(input.files?.[0]);
  if (input.id === 'ma-daily-goal') { progress = { ...progress, settings: { ...progress.settings, dailyGoal: Number(input.value) }, updatedAt: new Date().toISOString() }; persist(); render(); toast('Votre objectif a été enregistré.'); }
});
app.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a[data-view], [data-world]');
  if (!target || (target as HTMLButtonElement).disabled) return;
  const data = target.dataset;
  if (data.view) { navigate(data.view as View); return; }
  if (data.lesson) { startLesson(data.lesson); return; }
  if (data.world) { worldDetails(data.world); return; }
  if (session?.stage === 'exercise' && !session.answered) {
    if (data.choice !== undefined) { session.draft.choice = data.choice; updateTask(data.focus); pronounceSelection(data.choice); return; }
    if (data.token !== undefined) { const word = tokensFor(session.exercises[session.index])[Number(data.token)]; session.draft.ordered.push(Number(data.token)); updateTask(); pronounceSelection(word); app.querySelector<HTMLElement>('.ma-word-bank button:not(:disabled)')?.focus({ preventScroll: true }); return; }
    if (data.removeToken !== undefined) { session.draft.ordered.splice(Number(data.removeToken), 1); updateTask(); return; }
    if (data.left !== undefined) { session.draft.selectedLeft = data.left; updateTask(data.focus); pronounceSelection(data.left); return; }
    if (data.right !== undefined && session.draft.selectedLeft) { for (const left of Object.keys(session.draft.matches)) if (session.draft.matches[left] === data.right) delete session.draft.matches[left]; session.draft.matches[session.draft.selectedLeft] = data.right; session.draft.selectedLeft = ''; updateTask(); app.querySelector<HTMLElement>('[data-left]:not(.paired)')?.focus({ preventScroll: true }); return; }
  }
  switch (data.action) {
    case 'replay-dialogue': replayDialogue(data.voiceKey ?? '', false); break;
    case 'slow-dialogue': replayDialogue(data.voiceKey ?? '', true); break;
    case 'advance-dialogue': advanceDialogue(); break;
    case 'play-audio': void playLanguageAudio(false); break;
    case 'replay-audio': void playLanguageAudio(true); break;
    case 'slow-audio': void playLanguageAudio(true, .75); break;
    case 'pause-audio': audio.pause(); break;
    case 'continue': { const next = nextLesson(); if (next) startLesson(next.id); else startReview(); break; }
    case 'review': startReview(); break;
    case 'begin-exercises': if (session) {
      const scenes = session.lesson.scenes ?? [];
      if (scenes.length && (session.sceneIndex !== scenes.length - 1 || session.revealedTurns < scenes[session.sceneIndex].turns.length)) break;
      progress = introduceLesson(progress, session.lesson, CONTENT); persist();
      session.stage = 'exercise'; render(true); window.scrollTo(0, 0);
      const question = app.querySelector<HTMLElement>('#ma-question'); question?.setAttribute('tabindex', '-1'); question?.focus({ preventScroll: true });
    } break;
    case 'next-exercise': advanceExercise(); break;
    case 'exit-lesson': dialogueAudio.stop(); showDialog('Faire une pause ?', '<p>Vos réponses sont déjà sauvegardées. La leçon reste à valider : vous reprendrez ses exercices depuis le début.</p><div class="ma-dialog-actions"><button class="ma-primary" data-view="path">Retour au parcours</button><button class="ma-secondary" data-action="close-dialog">Poursuivre la leçon</button></div>'); break;
    case 'mute': progress = { ...progress, settings: { ...progress.settings, muted: !progress.settings.muted }, updatedAt: new Date().toISOString() }; audio.muted = progress.settings.muted; dialogueAudio.muted = progress.settings.muted; persist(); render(); break;
    case 'export': exportSave(); break;
    case 'export-recovery': exportRecovery(); break;
    case 'import': app.querySelector<HTMLInputElement>('#ma-import-file')?.click(); break;
    case 'close-dialog': pendingImport = null; app.querySelector<HTMLDialogElement>('#ma-dialog')?.close(); break;
    case 'confirm-import': if (pendingImport) { progress = pendingImport; audio.muted = progress.settings.muted; dialogueAudio.muted = progress.settings.muted; pendingImport = null; storageWarning = ''; persist(); navigate('backup'); toast('Votre carnet a été restauré. Bon retour !'); } break;
  }
});
window.addEventListener('hashchange', () => navigate(readView()));
app.addEventListener('keydown', event => {
  const marker = (event.target as Element).closest<SVGElement>('[data-world][role="button"]');
  if (marker && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); worldDetails(marker.dataset.world ?? ''); }
});
window.addEventListener('pagehide', () => { audio.stop(); dialogueAudio.stop(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) dialogueAudio.stop(); });
render();
