import type { Content, Exercise, ExerciseType, Lesson, Mastery, Progress, World } from './types';

type Time = Date | string;
export type Answer = string | string[] | Record<string, string>;
export type AnswerValidator = (exercise: Exercise, answer: Answer) => boolean;
const asDate = (now: Time = new Date()): Date => new Date(now);
const iso = (now: Time = new Date()): string => asDate(now).toISOString();
const DAY = 86_400_000;
const INTERVALS = [1, 3, 7, 14, 30];

/** Keep apostrophes, accents and letter distinctions; only presentation is ignored. */
export function normalizeAnswer(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('fr').trim()
    .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[.!?…]+$/u, '').trim();
}
const textAnswer: AnswerValidator = (exercise, answer) => {
  const value = Array.isArray(answer) ? answer.join(' ') : typeof answer === 'string' ? answer : null;
  return value !== null && exercise.answers.some(accepted => normalizeAnswer(accepted) === normalizeAnswer(value));
};
const matchingAnswer: AnswerValidator = (exercise, answer) => {
  if (!exercise.pairs?.length || typeof answer !== 'object' || Array.isArray(answer)) return false;
  return Object.keys(answer).length === exercise.pairs.length && exercise.pairs.every(pair =>
    Object.hasOwn(answer, pair.left) && normalizeAnswer(answer[pair.left]) === normalizeAnswer(pair.right));
};

/** Adding an exercise renderer does not require changing answer validation for other types. */
export const exerciseValidators: Record<ExerciseType, AnswerValidator> = {
  choice: textAnswer, match: matchingAnswer, order: textAnswer, cloze: textAnswer,
  translate: textAnswer, reading: textAnswer, dialogue: textAnswer, culture: textAnswer,
  listening: textAnswer,
};
export function validateAnswer(exercise: Exercise, answer: Answer): boolean {
  return exerciseValidators[exercise.type]?.(exercise, answer) ?? false;
}

export function createProgress(now: Time = new Date()): Progress {
  return {
    schemaVersion: 1, createdAt: iso(now), updatedAt: iso(now), xp: 0,
    completedLessons: [], rewardedExercises: [], concepts: {}, history: [], activityDates: [],
    achievements: [], settings: { muted: false, dailyGoal: 10 },
  };
}

function freshMastery(): Mastery {
  return { introduced: true, attempts: 0, correct: 0, mistakes: 0, streak: 0, mastery: 0,
    lastPracticed: null, nextReview: null, intervalDays: 0 };
}
export function worldCompleted(worldId: string, progress: Progress, content: Content): boolean {
  const units = content.units.filter(unit => unit.worldId === worldId);
  return units.length > 0 && units.every(unit => unit.implemented && unit.lessonIds.length > 0
    && unit.lessonIds.every(id => progress.completedLessons.includes(id)));
}
export function worldAvailable(world: World, progress: Progress, content: Content): boolean {
  return world.implemented && world.prerequisites.every(id => worldCompleted(id, progress, content));
}
export function lessonAvailable(lesson: Lesson, progress: Progress, content: Content): boolean {
  const world = content.worlds.find(item => item.id === lesson.worldId);
  const unit = content.units.find(item => item.id === lesson.unitId);
  return !!world && worldAvailable(world, progress, content) && !!unit?.implemented && unit.worldId === lesson.worldId
    && lesson.prerequisites.every(id => progress.completedLessons.includes(id));
}
export function introduceLesson(progress: Progress, lesson: Lesson, content?: Content): Progress {
  if (content && !lessonAvailable(lesson, progress, content)) return progress;
  const concepts = { ...progress.concepts };
  for (const id of lesson.introduces) {
    const concept = content?.concepts.find(candidate => candidate.id === id);
    if (content && (!concept || !concept.prerequisites.every(prerequisite => concepts[prerequisite]?.introduced))) continue;
    concepts[id] ??= freshMastery();
  }
  return { ...progress, concepts };
}

function calendarDate(now: Time): string {
  const date = asDate(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addActivity(progress: Progress, now: Time): string[] {
  const day = calendarDate(now);
  return [...new Set([...progress.activityDates, day])].sort().slice(-730);
}

export function recordAnswer(progress: Progress, exercise: Exercise, correct: boolean, now: Time = new Date()): Progress {
  // A malformed or future exercise must never introduce concepts by scoring them.
  if (!exercise.concepts.length || !exercise.concepts.every(id => progress.concepts[id]?.introduced)) return progress;
  const at = iso(now), concepts = { ...progress.concepts };
  for (const id of exercise.concepts) {
    const previous = concepts[id];
    // Repeating five similar questions today is useful practice, but is not five spaced recalls.
    const newPracticeDay = !previous.lastPracticed || calendarDate(previous.lastPracticed) !== calendarDate(now);
    const streak = correct ? previous.streak + Number(newPracticeDay) : 0;
    const intervalDays = correct ? INTERVALS[Math.min(Math.max(0, streak - 1), INTERVALS.length - 1)] : 0;
    const cap = newPracticeDay ? 1 : Math.max(0.79, previous.mastery);
    const mastery = correct ? Math.min(cap, previous.mastery + (1 - previous.mastery) * 0.3) : Math.max(0, previous.mastery * 0.55);
    concepts[id] = {
      introduced: true, attempts: previous.attempts + 1, correct: previous.correct + Number(correct),
      mistakes: previous.mistakes + Number(!correct), streak, mastery, lastPracticed: at,
      nextReview: new Date(asDate(now).getTime() + (correct ? intervalDays * DAY : 10 * 60_000)).toISOString(),
      intervalDays,
    };
  }
  const reward = correct && !progress.rewardedExercises.includes(exercise.id);
  return { ...progress, updatedAt: at, concepts, xp: progress.xp + (reward ? 10 : 0),
    rewardedExercises: reward ? [...progress.rewardedExercises, exercise.id] : progress.rewardedExercises,
    history: [...progress.history, { exerciseId: exercise.id, correct, at, conceptIds: [...exercise.concepts] }].slice(-1000),
    activityDates: addActivity(progress, now),
  };
}

export function completeLesson(progress: Progress, lesson: Lesson, correct: number, total: number, now: Time = new Date()): Progress {
  if (progress.completedLessons.includes(lesson.id) || !Number.isInteger(correct) || !Number.isInteger(total)
    || total < 1 || correct < 0 || correct > total || correct / total < (lesson.kind === 'checkpoint' ? 0.8 : 0.6)
    || !lesson.prerequisites.every(id => progress.completedLessons.includes(id))
    || !lesson.introduces.every(id => progress.concepts[id]?.introduced)) return progress;
  const completedLessons = [...progress.completedLessons, lesson.id];
  const achievements = new Set(progress.achievements);
  achievements.add('first-lesson');
  if (completedLessons.length >= 3) achievements.add('three-lessons');
  if (lesson.kind === 'checkpoint') achievements.add('first-unit');
  return { ...progress, completedLessons, xp: progress.xp + 25, achievements: [...achievements],
    updatedAt: iso(now), activityDates: addActivity(progress, now) };
}

export function dueConcepts(progress: Progress, now: Time = new Date()): string[] {
  const time = asDate(now).getTime();
  return Object.entries(progress.concepts)
    .filter(([, value]) => value.introduced && value.nextReview !== null && new Date(value.nextReview).getTime() <= time)
    .sort(([idA, a], [idB, b]) => new Date(a.nextReview!).getTime() - new Date(b.nextReview!).getTime() || idA.localeCompare(idB))
    .map(([id]) => id);
}
export function conceptStatus(mastery?: Mastery, now: Time = new Date()): 'unseen' | 'learning' | 'reviewing' | 'mastered' | 'due' {
  if (!mastery?.introduced) return 'unseen';
  if (mastery.nextReview && new Date(mastery.nextReview).getTime() <= asDate(now).getTime()) return 'due';
  if (mastery.correct >= 5 && mastery.streak >= 3 && mastery.mastery >= 0.8) return 'mastered';
  return mastery.attempts >= 3 ? 'reviewing' : 'learning';
}
export const playerLevel = (xp: number): number => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));

export function streakDays(progress: Progress, now: Time = new Date()): number {
  const days = new Set(progress.activityDates);
  const date = asDate(now);
  date.setHours(12, 0, 0, 0);
  if (!days.has(calendarDate(date))) date.setDate(date.getDate() - 1);
  let streak = 0;
  while (days.has(calendarDate(date))) { streak++; date.setDate(date.getDate() - 1); }
  return streak;
}

export interface MixWeights { current: number; previous: number; review: number }
export const DEFAULT_MIX: MixWeights = { current: 55, previous: 25, review: 20 };

/** Pure selection: same content/save/date gives the same ordered, duplicate-free quiz. */
export function selectMixedExercises(content: Content, progress: Progress, lesson: Lesson | null,
  count = 6, now: Time = new Date(), weights: MixWeights = DEFAULT_MIX): Exercise[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const validWeights = [weights.current, weights.previous, weights.review].every(weight => Number.isFinite(weight) && weight >= 0)
    && weights.current + weights.previous + weights.review > 0;
  if (!validWeights) throw new Error('Les poids de révision doivent être positifs et leur somme non nulle.');
  const audio = new Set(content.audio.filter(asset => asset.status === 'verified').map(asset => asset.id));
  const eligible = content.exercises.filter(exercise => exercise.concepts.length > 0
    && exercise.concepts.every(id => progress.concepts[id]?.introduced)
    && (exercise.type !== 'listening' || !!exercise.audioId && audio.has(exercise.audioId)));
  const due = new Set(dueConcepts(progress, now));
  const weakness = (exercise: Exercise): number => Math.max(...exercise.concepts.map(id => {
    const mastery = progress.concepts[id];
    return (due.has(id) ? 2 : 0) + (1 - mastery.mastery);
  }));
  const lastAttempt = new Map(progress.history.map(event => [event.exerciseId, event.at]));
  const chronological = (a: Exercise, b: Exercise): number => {
    const aLast = lastAttempt.get(a.id) ?? '';
    const bLast = lastAttempt.get(b.id) ?? '';
    return aLast.localeCompare(bLast) || a.id.localeCompare(b.id);
  };
  const currentIds = new Set(lesson?.exerciseIds ?? []);
  const current = eligible.filter(exercise => currentIds.has(exercise.id)).sort(chronological);
  const previous = eligible.filter(exercise => !currentIds.has(exercise.id)
    && !exercise.concepts.some(id => lesson?.introduces.includes(id))).sort(chronological);
  // Historical mistakes are evidence for the mastery estimate, not a permanent priority flag.
  // Due recalls come first; otherwise an actually weak concept outranks a recovered one.
  const reviews = eligible.filter(exercise => exercise.concepts.some(id => due.has(id) || conceptStatus(progress.concepts[id], now) !== 'mastered'))
    .sort((a, b) => weakness(b) - weakness(a) || chronological(a, b));
  const result: Exercise[] = [], selected = new Set<string>();
  const take = (pool: Exercise[], target: number): void => {
    let added = 0;
    for (const exercise of pool) {
      if (added >= target || result.length >= count) break;
      if (!selected.has(exercise.id)) { result.push(exercise); selected.add(exercise.id); added++; }
    }
  };
  if (!lesson) {
    take(reviews, count);
    take([...eligible].sort((a, b) => weakness(b) - weakness(a) || chronological(a, b)), count);
    return result;
  }
  const sum = weights.current + weights.previous + weights.review;
  const targets = [weights.current, weights.previous, weights.review].map(weight => Math.floor(count * weight / sum));
  for (let remainder = count - targets.reduce((a, b) => a + b, 0), i = 0; remainder > 0; remainder--, i++) targets[i % 3]++;
  take(current, targets[0]); take(previous, targets[1]); take(reviews, targets[2]);
  take(current, count); take(reviews, count); take(previous, count); take(eligible, count);
  return result;
}

/** Authoring validation runs in tests and can be reused by future import tools. */
export function validateContent(content: Content): string[] {
  const errors: string[] = [];
  const registries = { worlds: content.worlds, units: content.units, lessons: content.lessons,
    exercises: content.exercises, concepts: content.concepts, vocabulary: content.vocabulary,
    sources: content.sources, audio: content.audio };
  for (const [name, items] of Object.entries(registries)) {
    const seen = new Set<string>();
    for (const item of items) {
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(item.id) || seen.has(item.id)) errors.push(`${name}: identifiant invalide ou dupliqué ${item.id}`);
      seen.add(item.id);
    }
  }
  const ids = Object.fromEntries(Object.entries(registries).map(([name, items]) => [name, new Set(items.map(item => item.id))]));
  const refs = (owner: string, type: keyof typeof registries, references: string[]): void => {
    for (const reference of references) if (!ids[type].has(reference)) errors.push(`${owner}: référence ${type} absente ${reference}`);
  };
  const sources = (owner: string, references: string[]): void => {
    if (!references.length) errors.push(`${owner}: sources absentes`);
    refs(owner, 'sources', references);
  };
  const cycles = (items: { id: string; prerequisites: string[] }[], name: string): void => {
    const index = new Map(items.map(item => [item.id, item]));
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) { errors.push(`${name}: prérequis cyclique ${id}`); return; }
      if (visited.has(id)) return;
      visiting.add(id);
      for (const prerequisite of index.get(id)?.prerequisites ?? []) visit(prerequisite);
      visiting.delete(id); visited.add(id);
    };
    for (const item of items) visit(item.id);
  };
  for (const world of content.worlds) refs(world.id, 'worlds', world.prerequisites);
  for (const unit of content.units) {
    refs(unit.id, 'worlds', [unit.worldId]); refs(unit.id, 'lessons', unit.lessonIds);
    if (unit.implemented && !unit.lessonIds.length) errors.push(`${unit.id}: unité jouable vide`);
    for (const id of unit.lessonIds) if (content.lessons.find(lesson => lesson.id === id)?.unitId !== unit.id) errors.push(`${unit.id}: leçon rattachée à une autre unité ${id}`);
  }
  for (const lesson of content.lessons) {
    refs(lesson.id, 'worlds', [lesson.worldId]); refs(lesson.id, 'units', [lesson.unitId]);
    refs(lesson.id, 'lessons', lesson.prerequisites); refs(lesson.id, 'exercises', lesson.exerciseIds);
    refs(lesson.id, 'concepts', [...lesson.introduces, ...lesson.reviews]); sources(lesson.id, lesson.sourceIds);
    if (!lesson.exerciseIds.length) errors.push(`${lesson.id}: leçon sans exercices`);
    if (content.units.find(unit => unit.id === lesson.unitId)?.worldId !== lesson.worldId) errors.push(`${lesson.id}: monde incohérent avec son unité`);
    if (!content.units.find(unit => unit.id === lesson.unitId)?.lessonIds.includes(lesson.id)) errors.push(`${lesson.id}: absente du parcours de son unité`);
  }
  for (const concept of content.concepts) {
    refs(concept.id, 'lessons', [concept.introducedIn]); refs(concept.id, 'concepts', concept.prerequisites); sources(concept.id, concept.sourceIds);
    if (!content.lessons.find(lesson => lesson.id === concept.introducedIn)?.introduces.includes(concept.id)) errors.push(`${concept.id}: introduction incohérente`);
  }
  for (const entry of content.vocabulary) {
    refs(entry.id, 'concepts', [entry.conceptId]); refs(entry.id, 'units', [entry.unitId]); sources(entry.id, entry.sourceIds);
    if (!entry.malagasy.trim() || !entry.french.trim()) errors.push(`${entry.id}: traduction absente`);
    if (entry.audioId) refs(entry.id, 'audio', [entry.audioId]);
  }
  for (const exercise of content.exercises) {
    refs(exercise.id, 'concepts', exercise.concepts); sources(exercise.id, exercise.sourceIds);
    if (!exercise.concepts.length || !exercise.question.trim() || !exercise.explanation.trim()) errors.push(`${exercise.id}: contenu incomplet`);
    if (!exerciseValidators[exercise.type]) errors.push(`${exercise.id}: type inconnu`);
    if (exercise.type === 'match') {
      if (!exercise.pairs?.length || new Set(exercise.pairs.map(pair => pair.left)).size !== exercise.pairs.length
        || new Set(exercise.pairs.map(pair => pair.right)).size !== exercise.pairs.length) errors.push(`${exercise.id}: paires invalides`);
    } else if (!exercise.answers.length || exercise.answers.some(answer => !answer.trim())) errors.push(`${exercise.id}: réponses absentes`);
    if (['choice', 'reading', 'dialogue', 'culture', 'listening'].includes(exercise.type)
      && (!exercise.choices || exercise.choices.length < 2 || !exercise.answers.every(answer => exercise.choices!.includes(answer)))) errors.push(`${exercise.id}: choix invalides`);
    if (exercise.type === 'order') {
      const inventory = (text: string[]): string => text.map(token => normalizeAnswer(token)).sort().join('|');
      if (!exercise.tokens?.length || !exercise.answers.some(answer => inventory(answer.split(' ')) === inventory(exercise.tokens!))) errors.push(`${exercise.id}: mots à ordonner invalides`);
    }
    if (exercise.audioId) refs(exercise.id, 'audio', [exercise.audioId]);
    if (exercise.type === 'listening' && !content.audio.some(asset => asset.id === exercise.audioId && asset.status === 'verified' && asset.url)) errors.push(`${exercise.id}: écoute sans audio vérifié`);
  }
  for (const asset of content.audio) {
    refs(asset.id, 'sources', [asset.sourceId]);
    if (asset.status === 'verified' && (!asset.url || !asset.transcript)) errors.push(`${asset.id}: audio vérifié incomplet`);
    if (asset.status === 'synthetic' && (!asset.url || !asset.transcript || !asset.model || asset.verification !== 'model-generated')) errors.push(`${asset.id}: provenance de synthèse incomplète`);
  }
  cycles(content.worlds, 'worlds'); cycles(content.lessons, 'lessons'); cycles(content.concepts, 'concepts');
  // A traversal can accumulate sibling lessons that the real learner was never required to take.
  // Check each lesson against its own prerequisite closure before testing global reachability.
  const lessonIndex = new Map(content.lessons.map(lesson => [lesson.id, lesson]));
  const worldIndex = new Map(content.worlds.map(world => [world.id, world]));
  for (const lesson of content.lessons) {
    const ancestors = new Set<string>(), worlds = new Set<string>();
    const visitLesson = (id: string): void => {
      if (ancestors.has(id)) return;
      ancestors.add(id);
      for (const prerequisite of lessonIndex.get(id)?.prerequisites ?? []) visitLesson(prerequisite);
    };
    const visitWorld = (id: string): void => {
      if (worlds.has(id)) return;
      worlds.add(id);
      for (const unit of content.units.filter(candidate => candidate.worldId === id)) for (const lessonId of unit.lessonIds) visitLesson(lessonId);
      for (const prerequisite of worldIndex.get(id)?.prerequisites ?? []) visitWorld(prerequisite);
    };
    for (const prerequisite of lesson.prerequisites) visitLesson(prerequisite);
    for (const prerequisite of worldIndex.get(lesson.worldId)?.prerequisites ?? []) visitWorld(prerequisite);
    const guaranteed = new Set([...ancestors].flatMap(id => lessonIndex.get(id)?.introduces ?? []));
    for (const id of lesson.introduces) {
      const concept = content.concepts.find(candidate => candidate.id === id);
      for (const prerequisite of concept?.prerequisites ?? []) {
        if (!guaranteed.has(prerequisite)) errors.push(`${lesson.id}: prérequis du concept ${id} non garanti ${prerequisite}`);
      }
      guaranteed.add(id);
    }
    for (const id of lesson.reviews) if (!guaranteed.has(id)) errors.push(`${lesson.id}: révision absente des prérequis ${id}`);
    for (const id of lesson.exerciseIds) {
      const exercise = content.exercises.find(candidate => candidate.id === id);
      for (const conceptId of exercise?.concepts ?? []) {
        if (!guaranteed.has(conceptId)) errors.push(`${lesson.id}: concept absent des prérequis dans ${id}: ${conceptId}`);
      }
    }
  }
  // Walk the entire authored lesson graph as a learner, checking the introduction boundary.
  let simulated = createProgress('2026-01-01T12:00:00.000Z');
  const pending = [...content.lessons];
  let moved = true;
  while (moved && pending.length) {
    moved = false;
    for (let index = pending.length - 1; index >= 0; index--) {
      const lesson = pending[index];
      if (!lessonAvailable(lesson, simulated, content)) continue;
      simulated = introduceLesson(simulated, lesson, content);
      for (const id of lesson.reviews) if (!simulated.concepts[id]?.introduced) errors.push(`${lesson.id}: révision d’un concept inconnu ${id}`);
      for (const id of lesson.exerciseIds) {
        const exercise = content.exercises.find(candidate => candidate.id === id);
        if (exercise && !exercise.concepts.every(concept => simulated.concepts[concept]?.introduced)) errors.push(`${lesson.id}: concept inconnu dans ${id}`);
      }
      simulated = { ...simulated, completedLessons: [...simulated.completedLessons, lesson.id] };
      pending.splice(index, 1); moved = true;
    }
  }
  for (const lesson of pending) errors.push(`${lesson.id}: leçon inaccessible`);
  return errors;
}
