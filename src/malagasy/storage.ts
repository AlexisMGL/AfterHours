import { createProgress } from './engine';
import type { Content, LearningEvent, Mastery, Progress } from './types';

export const SAVE_KEY = 'afterhours.malagasy.progress.v1';
export const RECOVERY_KEY = `${SAVE_KEY}.recovery`;
const MAX_BYTES = 2_000_000;
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
function fail(): never { throw new Error('Sauvegarde invalide ou incompatible. Aucun progrès n’a été remplacé.'); }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, max = 1_000_000_000): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);
function strings(value: unknown, max: number, valid: (item: unknown) => boolean = id): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(valid) && new Set(value).size === value.length;
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

/** v1 currently has no older schema. Add explicit migrations here, never guess at new data. */
export function parseSave(json: string, content?: Content): Progress {
  if (typeof json !== 'string' || json.length > MAX_BYTES) fail();
  let data: unknown;
  try {
    data = JSON.parse(json, (key, value: unknown) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
      return value;
    });
  } catch { return fail(); }
  if (!object(data) || !exactKeys(data, ['schemaVersion', 'createdAt', 'updatedAt', 'xp', 'completedLessons', 'rewardedExercises',
    'concepts', 'history', 'activityDates', 'achievements', 'settings']) || data.schemaVersion !== 1
    || !date(data.createdAt) || !date(data.updatedAt) || Date.parse(data.updatedAt) < Date.parse(data.createdAt)
    || !integer(data.xp) || !strings(data.completedLessons, 10_000) || !strings(data.rewardedExercises, 50_000)
    || !strings(data.achievements, 100) || !strings(data.activityDates, 730, item => typeof item === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(item) && !Number.isNaN(Date.parse(`${item}T12:00:00Z`))
      && new Date(`${item}T12:00:00Z`).toISOString().slice(0, 10) === item)
    || !object(data.concepts) || Object.keys(data.concepts).length > 30_000
    || !Array.isArray(data.history) || data.history.length > 1000
    || !object(data.settings) || !exactKeys(data.settings, ['muted', 'dailyGoal'])
    || typeof data.settings.muted !== 'boolean' || !integer(data.settings.dailyGoal, 120) || data.settings.dailyGoal < 1) fail();
  for (const [key, value] of Object.entries(data.concepts)) {
    if (!id(key) || !object(value) || !exactKeys(value, ['introduced', 'attempts', 'correct', 'mistakes', 'streak', 'mastery',
      'lastPracticed', 'nextReview', 'intervalDays']) || value.introduced !== true
      || !integer(value.attempts) || !integer(value.correct) || !integer(value.mistakes) || value.attempts !== value.correct + value.mistakes
      || !integer(value.streak) || value.streak > value.correct || !finite(value.mastery, 0, 1)
      || !integer(value.intervalDays, 365) || !(value.lastPracticed === null || date(value.lastPracticed))
      || !(value.nextReview === null || date(value.nextReview))
      || (value.attempts === 0 && (value.lastPracticed !== null || value.nextReview !== null))
      || (value.attempts > 0 && (value.lastPracticed === null || value.nextReview === null))) fail();
  }
  for (const event of data.history) {
    if (!object(event) || !exactKeys(event, ['exerciseId', 'correct', 'at', 'conceptIds']) || !id(event.exerciseId)
      || typeof event.correct !== 'boolean' || !date(event.at) || !strings(event.conceptIds, 100)
      || event.conceptIds.some(conceptId => !Object.hasOwn(data.concepts as object, conceptId))) fail();
  }
  if (content) {
    const lessons = new Map(content.lessons.map(lesson => [lesson.id, lesson]));
    const exercises = new Set(content.exercises.map(exercise => exercise.id));
    const concepts = new Set(content.concepts.map(concept => concept.id));
    if (data.completedLessons.some(lessonId => !lessons.has(lessonId))
      || data.rewardedExercises.some(exerciseId => !exercises.has(exerciseId))
      || Object.keys(data.concepts).some(conceptId => !concepts.has(conceptId))
      || data.history.some(event => !exercises.has((event as LearningEvent).exerciseId))) fail();
    for (const lessonId of data.completedLessons) {
      const lesson = lessons.get(lessonId)!;
      if (!lesson.prerequisites.every(prerequisite => (data.completedLessons as string[]).includes(prerequisite))
        || !lesson.introduces.every(conceptId => Object.hasOwn(data.concepts as object, conceptId))) fail();
    }
    for (const conceptId of Object.keys(data.concepts)) {
      const concept = content.concepts.find(item => item.id === conceptId)!;
      const introduction = lessons.get(concept.introducedIn);
      if (!introduction || !introduction.prerequisites.every(prerequisite => (data.completedLessons as string[]).includes(prerequisite))
        || !concept.prerequisites.every(prerequisite => Object.hasOwn(data.concepts as object, prerequisite))) fail();
    }
  }
  // Explicit reconstruction prevents imported objects from becoming application state by reference.
  return {
    schemaVersion: 1, createdAt: data.createdAt, updatedAt: data.updatedAt, xp: data.xp,
    completedLessons: [...data.completedLessons], rewardedExercises: [...data.rewardedExercises],
    concepts: Object.fromEntries(Object.entries(data.concepts).map(([key, value]) => [key, { ...(value as unknown as Mastery) }])),
    history: data.history.map(event => ({ ...(event as LearningEvent), conceptIds: [...(event as LearningEvent).conceptIds] })),
    activityDates: [...data.activityDates], achievements: [...data.achievements],
    settings: { muted: data.settings.muted, dailyGoal: data.settings.dailyGoal },
  };
}

export function serializeSave(progress: Progress): string { return JSON.stringify(progress, null, 2); }

/** Preserve the first unreadable save verbatim so later practice cannot erase the only recovery copy. */
export function loadRecovery(storage?: SaveStorage): string | null {
  try {
    const json = (storage ?? globalThis.localStorage).getItem(RECOVERY_KEY);
    return json !== null && json.length <= MAX_BYTES ? json : null;
  } catch { return null; }
}

export function loadProgress(content?: Content, storage?: SaveStorage): { progress: Progress; error?: string } {
  let target: SaveStorage | undefined;
  let json: string | null = null;
  try {
    target = storage ?? globalThis.localStorage;
    json = target.getItem(SAVE_KEY);
    return { progress: json ? parseSave(json, content) : createProgress() };
  } catch {
    let recovery = 'Exportez vos prochaines sessions.';
    if (target && json !== null && json.length <= MAX_BYTES) {
      try {
        const previous = target.getItem(RECOVERY_KEY);
        if (previous === null) {
          target.setItem(RECOVERY_KEY, json);
          recovery = 'Une copie de récupération a été conservée. Téléchargez-la depuis Ma sauvegarde.';
        } else {
          recovery = 'Une précédente copie de récupération est déjà conservée ; elle n’a pas été remplacée. Consultez Ma sauvegarde.';
        }
      } catch { /* Storage restrictions must not block learning or silently replace the raw save. */ }
    }
    return { progress: createProgress(), error: `La sauvegarde locale est illisible ou le stockage est indisponible. ${recovery}` };
  }
}
export function saveProgress(progress: Progress, storage?: SaveStorage): boolean {
  try { (storage ?? globalThis.localStorage).setItem(SAVE_KEY, serializeSave(progress)); return true; }
  catch { return false; }
}
