import { describe, expect, it } from 'vitest';
import {
  completeLesson, conceptStatus, createProgress, dueConcepts, introduceLesson, lessonAvailable,
  normalizeAnswer, playerLevel, recordAnswer, selectMixedExercises, streakDays, validateAnswer, validateContent, worldAvailable, worldCompleted,
} from '../src/malagasy/engine';
import { loadProgress, loadRecovery, parseSave, RECOVERY_KEY, SAVE_KEY, saveProgress, serializeSave } from '../src/malagasy/storage';
import type { Content, Exercise, Lesson, Progress } from '../src/malagasy/types';
import { CONTENT } from '../src/malagasy/content';

const NOW = '2026-10-25T12:00:00.000Z';
const first: Lesson = {
  id: 'l.hello', unitId: 'u.1', worldId: 'w.1', title: 'Saluer', description: 'Bonjour', kind: 'learn',
  introduces: ['v.hello'], reviews: [], objectives: ['Saluer'], prerequisites: [], exerciseIds: ['e.hello'],
  notes: [], estimatedMinutes: 3, sourceIds: ['source'],
};
const next: Lesson = { ...first, id: 'l.name', introduces: ['v.name'], reviews: ['v.hello'],
  prerequisites: ['l.hello'], exerciseIds: ['e.name'] };
const checkpoint: Lesson = { ...first, id: 'l.review', kind: 'checkpoint', introduces: [], reviews: ['v.hello', 'v.name'],
  prerequisites: ['l.name'], exerciseIds: ['e.hello', 'e.name'] };
const hello: Exercise = { id: 'e.hello', type: 'choice', prompt: 'Choisissez.', question: 'Bonjour', answers: ['Manao ahoana'],
  choices: ['Manao ahoana', 'Veloma'], explanation: 'Une salutation.', concepts: ['v.hello'], sourceIds: ['source'], difficulty: 1 };
const name: Exercise = { ...hello, id: 'e.name', question: 'Je m’appelle Lova.', answers: ['Lova no anarako.'],
  choices: ['Lova no anarako.', 'Veloma'], concepts: ['v.name'] };
const content: Content = {
  worlds: [{ id: 'w.1', number: 1, name: 'Antananarivo', subtitle: 'Premiers pas', description: '', vocabulary: [],
    grammar: [], skills: [], culture: '', coordinates: [-18.9, 47.5], prerequisites: [], estimatedHours: 10, implemented: true },
  { id: 'w.2', number: 2, name: 'Antsirabe', subtitle: '', description: '', vocabulary: [], grammar: [], skills: [], culture: '',
    coordinates: [-19.8, 47], prerequisites: ['w.1'], estimatedHours: 10, implemented: false }],
  units: [{ id: 'u.1', number: 1, worldId: 'w.1', title: 'Bienvenue', malagasyTitle: 'Tonga soa', description: '',
    lessonIds: ['l.hello', 'l.name', 'l.review'], implemented: true, objectives: [] }],
  lessons: [first, next, checkpoint], exercises: [hello, name],
  concepts: [{ id: 'v.hello', category: 'vocabulary', label: 'Bonjour', objective: 'Saluer', introducedIn: 'l.hello', prerequisites: [], sourceIds: ['source'] },
    { id: 'v.name', category: 'communication', label: 'Se présenter', objective: 'Se présenter', introducedIn: 'l.name', prerequisites: ['v.hello'], sourceIds: ['source'] }],
  sources: [{ id: 'source', title: 'Test', author: 'Test', url: 'https://example.org', category: 'language', consulted: true, supports: 'Test', license: 'Test' }],
  vocabulary: [], audio: [],
};
function learnFirst(): Progress {
  let progress = introduceLesson(createProgress(NOW), first, content);
  progress = recordAnswer(progress, hello, true, NOW);
  return completeLesson(progress, first, 1, 1, NOW);
}

describe('Malagasy exercise validation', () => {
  it('ignores display punctuation and case but preserves meaningful spelling and words', () => {
    expect(normalizeAnswer('  MANAO   AHOANA ? ')).toBe('manao ahoana');
    expect(validateAnswer(hello, '  MANAO ahoana!')).toBe(true);
    expect(validateAnswer(hello, 'Manao ahona')).toBe(false);
    expect(validateAnswer({ ...hello, answers: ['Tsy mpianatra aho'] }, 'Mpianatra aho')).toBe(false);
    expect(validateAnswer({ ...hello, answers: ['Je suis français.'] }, 'Je suis francais')).toBe(false);
    expect(validateAnswer({ ...hello, answers: ['Je suis français.', 'Je suis francais.'] }, 'Je suis francais')).toBe(true);
  });
  it('validates each registered text, ordering and matching type', () => {
    for (const type of ['choice', 'cloze', 'translate', 'reading', 'dialogue', 'culture', 'listening'] as const) {
      expect(validateAnswer({ ...hello, type }, 'Manao ahoana')).toBe(true);
      expect(validateAnswer({ ...hello, type }, 'Veloma')).toBe(false);
    }
    expect(validateAnswer({ ...hello, type: 'order' }, ['Manao', 'ahoana'])).toBe(true);
    expect(validateAnswer({ ...hello, type: 'order' }, ['ahoana', 'Manao'])).toBe(false);
    const match: Exercise = { ...hello, type: 'match', pairs: [{ left: 'Veloma', right: 'Au revoir' }, { left: 'Eny', right: 'Oui' }] };
    expect(validateAnswer(match, { Veloma: 'Au revoir', Eny: 'Oui' })).toBe(true);
    expect(validateAnswer(match, { Veloma: 'Oui', Eny: 'Au revoir' })).toBe(false);
    expect(validateAnswer(match, { Veloma: 'Au revoir' })).toBe(false);
    expect(validateAnswer(match, { Veloma: 'Au revoir', Eny: 'Oui', extra: 'Non' })).toBe(false);
  });
});

describe('Malagasy progression and spaced repetition', () => {
  it('unlocks prerequisites and blocks unintroduced concepts and unfinished checkpoints', () => {
    const empty = createProgress(NOW);
    expect(lessonAvailable(first, empty, content)).toBe(true);
    expect(lessonAvailable(next, empty, content)).toBe(false);
    expect(introduceLesson(empty, next, content)).toBe(empty);
    expect(recordAnswer(empty, hello, true, NOW)).toBe(empty);
    expect(completeLesson(empty, first, 5, 5, NOW)).toBe(empty);
    const progress = learnFirst();
    expect(lessonAvailable(next, progress, content)).toBe(true);
    expect(lessonAvailable({ ...first, worldId: 'w.2' }, progress, content)).toBe(false);
    const introduced = introduceLesson(progress, next, content);
    const finished = completeLesson(introduced, next, 3, 4, NOW);
    expect(finished.completedLessons).toContain('l.name');
    expect(completeLesson(finished, checkpoint, 3, 4, NOW).completedLessons).not.toContain('l.review');
    expect(completeLesson(finished, checkpoint, 4, 5, NOW).completedLessons).toContain('l.review');
    expect(completeLesson(introduced, next, 2, 4, NOW)).toBe(introduced);
  });
  it('keeps planned destinations locked and requires a full prerequisite world for future content', () => {
    const progress = learnFirst();
    expect(worldAvailable(content.worlds[0], progress, content)).toBe(true);
    expect(worldAvailable(content.worlds[1], progress, content)).toBe(false);
    expect(worldAvailable({ ...content.worlds[1], implemented: true }, progress, content)).toBe(false);
    expect(worldCompleted('w.1', progress, content)).toBe(false);
    const finished = { ...progress, completedLessons: content.lessons.map(lesson => lesson.id) };
    expect(worldCompleted('w.1', finished, content)).toBe(true);
    expect(worldAvailable({ ...content.worlds[1], implemented: true }, finished, content)).toBe(true);
    const partial = { ...content, units: [...content.units, { ...content.units[0], id: 'u.planned', implemented: false, lessonIds: [] }] };
    expect(worldCompleted('w.1', finished, partial)).toBe(false);
  });
  it('caps rewards per exercise and lesson without preventing additional practice', () => {
    let progress = learnFirst();
    expect(progress.xp).toBe(35);
    const xp = progress.xp;
    for (let index = 0; index < 10; index++) {
      progress = recordAnswer(progress, hello, true, NOW);
      progress = completeLesson(progress, first, 1, 1, NOW);
    }
    expect(progress.xp).toBe(xp);
    expect(progress.history).toHaveLength(11);
    expect(progress.concepts['v.hello'].attempts).toBe(11);
    expect(progress.achievements).toEqual(['first-lesson']);
    expect(playerLevel(0)).toBe(1);
    expect(playerLevel(400)).toBe(3);
  });
  it('schedules deterministic reviews, distinguishes completion from mastery and brings errors back sooner', () => {
    let progress = learnFirst();
    expect(conceptStatus(progress.concepts['v.hello'], NOW)).toBe('learning');
    expect(dueConcepts(progress, '2026-10-26T12:00:00.000Z')).toEqual(['v.hello']);
    expect(conceptStatus(progress.concepts['v.hello'], '2026-10-26T12:00:00.000Z')).toBe('due');
    for (let index = 0; index < 4; index++) progress = recordAnswer(progress, hello, true, `2026-10-${26 + index}T12:00:00.000Z`);
    expect(progress.concepts['v.hello'].intervalDays).toBe(30);
    expect(progress.concepts['v.hello'].nextReview).toBe('2026-11-28T12:00:00.000Z');
    expect(conceptStatus(progress.concepts['v.hello'], '2026-10-29T12:00:00.000Z')).toBe('mastered');
    const earlierMastery = progress.concepts['v.hello'].mastery;
    progress = recordAnswer(progress, hello, false, '2026-10-29T12:00:00.000Z');
    expect(progress.concepts['v.hello'].mastery).toBeLessThan(earlierMastery);
    expect(progress.concepts['v.hello'].nextReview).toBe('2026-10-29T12:10:00.000Z');
    expect(progress.concepts['v.hello'].streak).toBe(0);
    expect(dueConcepts(progress, '2026-10-29T12:11:00.000Z')).toEqual(['v.hello']);
    expect(recordAnswer(learnFirst(), hello, false, NOW)).toEqual(recordAnswer(learnFirst(), hello, false, NOW));
  });
  it('requires spaced practice days rather than marking a concept mastered inside one session', () => {
    let progress = learnFirst();
    for (let index = 0; index < 30; index++) progress = recordAnswer(progress, hello, true, NOW);
    expect(progress.concepts['v.hello'].mastery).toBe(0.79);
    expect(progress.concepts['v.hello'].streak).toBe(1);
    expect(progress.concepts['v.hello'].intervalDays).toBe(1);
    expect(conceptStatus(progress.concepts['v.hello'], NOW)).not.toBe('mastered');
    progress = recordAnswer(progress, hello, true, '2026-10-26T12:00:00.000Z');
    expect(progress.concepts['v.hello'].intervalDays).toBe(3);
    expect(conceptStatus(progress.concepts['v.hello'], '2026-10-26T12:00:00.000Z')).not.toBe('mastered');
    progress = recordAnswer(progress, hello, true, '2026-10-27T12:00:00.000Z');
    expect(conceptStatus(progress.concepts['v.hello'], '2026-10-27T12:00:00.000Z')).toBe('mastered');
    const mastery = progress.concepts['v.hello'].mastery;
    progress = recordAnswer(progress, hello, true, '2026-10-27T13:00:00.000Z');
    expect(progress.concepts['v.hello'].mastery).toBe(mastery);
    expect(progress.concepts['v.hello'].intervalDays).toBe(7);
  });
  it('counts real consecutive local calendar days, including yesterday before today’s practice', () => {
    const progress = { ...createProgress(NOW), activityDates: ['2026-10-22', '2026-10-23', '2026-10-24'] };
    expect(streakDays(progress, NOW)).toBe(3);
    expect(streakDays(progress, '2026-10-27T12:00:00.000Z')).toBe(0);
    expect(streakDays({ ...progress, activityDates: [...progress.activityDates, '2026-10-25'] }, NOW)).toBe(4);
  });
});

describe('Malagasy mixed revision selection', () => {
  it('mixes prior work with the current goal while excluding unseen and unsupported listening', () => {
    const progress = introduceLesson(learnFirst(), next, content);
    const locked: Exercise = { ...hello, id: 'e.locked', concepts: ['v.unknown'] };
    const unsupported: Exercise = { ...hello, id: 'e.listening', type: 'listening', audioId: 'audio.pending' };
    const candidates = { ...content, exercises: [...content.exercises, locked, unsupported] };
    const selected = selectMixedExercises(candidates, progress, next, 6, NOW);
    expect(new Set(selected.map(item => item.id))).toEqual(new Set(['e.name', 'e.hello']));
    expect(selected).toEqual(selectMixedExercises(candidates, progress, next, 6, NOW));
    expect(new Set(selected.map(item => item.id)).size).toBe(selected.length);
    expect(selectMixedExercises(candidates, createProgress(NOW), first, 6, NOW)).toEqual([]);
  });
  it('applies configurable mix proportions and prioritizes due mistakes in review', () => {
    let progress = introduceLesson(learnFirst(), next, content);
    progress = recordAnswer(progress, name, false, NOW);
    const mixed = selectMixedExercises(content, progress, next, 1, NOW, { current: 1, previous: 0, review: 0 });
    expect(mixed.map(item => item.id)).toEqual(['e.name']);
    expect(selectMixedExercises(content, progress, null, 1, '2026-10-25T12:11:00.000Z')[0].id).toBe('e.name');
    expect(() => selectMixedExercises(content, progress, next, 6, NOW, { current: 0, previous: 0, review: 0 })).toThrow();
  });
  it('prioritizes current weakness over recovered historical errors while preserving due recall priority', () => {
    let progress = introduceLesson(createProgress(NOW), first, content);
    progress = recordAnswer(progress, hello, false, NOW);
    for (let index = 0; index < 5; index++) {
      progress = recordAnswer(progress, hello, true, `2026-10-${25 + index}T12:00:00.000Z`);
    }
    const today = '2026-10-29T12:00:00.000Z';
    progress = completeLesson(progress, first, 1, 1, today);
    progress = introduceLesson(progress, next, content);
    expect(progress.concepts['v.hello'].mistakes).toBe(1);
    expect(conceptStatus(progress.concepts['v.hello'], today)).toBe('mastered');
    expect(selectMixedExercises(content, progress, null, 1, today)[0].id).toBe('e.name');
    const due = progress.concepts['v.hello'].nextReview!;
    expect(selectMixedExercises(content, progress, null, 1, due)[0].id).toBe('e.hello');
  });
});

describe('Malagasy persistence and content integrity', () => {
  it('validates the shipped curriculum and plays the entire authored path without locked concepts', () => {
    expect(CONTENT.worlds).toHaveLength(20);
    expect(CONTENT.worlds[0].implemented).toBe(true);
    expect(CONTENT.worlds.slice(1).every(world => !world.implemented)).toBe(true);
    expect(CONTENT.units.filter(unit => unit.implemented)).toHaveLength(3);
    expect(CONTENT.lessons).toHaveLength(9);
    expect(validateContent(CONTENT)).toEqual([]);
    let progress = createProgress(NOW);
    for (let index = 0; index < CONTENT.lessons.length; index++) {
      const lesson = CONTENT.lessons.find(candidate => !progress.completedLessons.includes(candidate.id)
        && lessonAvailable(candidate, progress, CONTENT));
      expect(lesson, `Étape ${index + 1} accessible`).toBeDefined();
      progress = introduceLesson(progress, lesson!, CONTENT);
      const mixed = selectMixedExercises(CONTENT, progress, lesson!, 6, NOW);
      expect(mixed.length).toBeGreaterThan(0);
      expect(mixed.every(exercise => exercise.concepts.every(id => progress.concepts[id]?.introduced))).toBe(true);
      for (const id of lesson!.exerciseIds) {
        const exercise = CONTENT.exercises.find(candidate => candidate.id === id)!;
        const answer = exercise.type === 'match' ? Object.fromEntries(exercise.pairs!.map(pair => [pair.left, pair.right])) : exercise.answers[0];
        expect(validateAnswer(exercise, answer), `${exercise.id}: réponse définie valide`).toBe(true);
        progress = recordAnswer(progress, exercise, true, NOW);
      }
      progress = completeLesson(progress, lesson!, lesson!.exerciseIds.length, lesson!.exerciseIds.length, NOW);
    }
    expect(progress.completedLessons).toHaveLength(CONTENT.lessons.length);
    expect(parseSave(serializeSave(progress), CONTENT)).toEqual(progress);
  });
  it('round trips complete progress through storage and rejects corrupted imports safely', () => {
    const progress = learnFirst(), values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveProgress(progress, storage)).toBe(true);
    expect(loadProgress(content, storage).progress).toEqual(progress);
    expect(parseSave(serializeSave(progress), content)).toEqual(progress);
    expect(() => parseSave('{ broken')).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, schemaVersion: 999 }))).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, xp: -100 }))).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, completedLessons: ['missing'] }), content)).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, completedLessons: ['l.name'] }), content)).toThrow();
    expect(() => parseSave('{"__proto__":{"polluted":true}}')).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, completedLessons: [], concepts: { ...progress.concepts, 'v.name': progress.concepts['v.hello'] } }), content)).toThrow();
    values.set(SAVE_KEY, 'broken');
    expect(loadProgress(content, storage).error).toBeTruthy();
    expect(loadProgress(content, storage).progress.xp).toBe(0);
    expect(values.get(SAVE_KEY)).toBe('broken');
    expect(saveProgress(progress, { getItem: () => null, setItem: () => { throw new Error('Quota'); } })).toBe(false);
  });
  it('rejects malformed dates, excessive data, NaN-like mastery and prototype keys', () => {
    const progress = learnFirst();
    expect(() => parseSave(JSON.stringify({ ...progress, activityDates: ['2026-02-30'] }))).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, activityDates: ['2026-99-99'] }))).toThrow();
    expect(() => parseSave(' '.repeat(2_000_001))).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, concepts: { 'v.hello': { ...progress.concepts['v.hello'], mastery: null } } }))).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, settings: { muted: false, dailyGoal: 0 } }))).toThrow();
    expect(() => parseSave(JSON.stringify({ ...progress, constructor: 'x' }))).toThrow();
  });
  it('keeps the first unreadable local save recoverable after fresh progress is saved', () => {
    const values = new Map<string, string>([[SAVE_KEY, '{ carnet interrompu']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const result = loadProgress(content, storage);
    expect(result.error).toContain('copie de récupération a été conservée');
    expect(values.get(SAVE_KEY)).toBe('{ carnet interrompu');
    expect(loadRecovery(storage)).toBe('{ carnet interrompu');
    values.set(SAVE_KEY, '{ autre carnet interrompu');
    expect(loadProgress(content, storage).error).toContain('n’a pas été remplacée');
    expect(loadRecovery(storage)).toBe('{ carnet interrompu');
    expect(saveProgress(learnFirst(), storage)).toBe(true);
    expect(loadProgress(content, storage).error).toBeUndefined();
    expect(loadRecovery(storage)).toBe('{ carnet interrompu');
    values.set(RECOVERY_KEY, 'x'.repeat(2_000_001));
    expect(loadRecovery(storage)).toBeNull();
    const unavailable = { getItem: () => { throw new Error('Stockage indisponible'); }, setItem: () => { throw new Error('Stockage indisponible'); } };
    expect(loadRecovery(unavailable)).toBeNull();
    expect(loadProgress(content, unavailable).error).toContain('stockage est indisponible');
  });
  it('validates references, prerequisites, answers and the complete reachable lesson path', () => {
    expect(validateContent(content)).toEqual([]);
    expect(validateContent({ ...content, exercises: [...content.exercises, hello] }).some(error => error.includes('dupliqué'))).toBe(true);
    expect(validateContent({ ...content, lessons: [{ ...first, prerequisites: ['l.name'] }, next, checkpoint] }).some(error => error.includes('cyclique'))).toBe(true);
    expect(validateContent({ ...content, lessons: [{ ...first, introduces: [] }, next, checkpoint] }).some(error => error.includes('concept inconnu'))).toBe(true);
    expect(validateContent({ ...content, exercises: [{ ...hello, type: 'listening' }, name] }).some(error => error.includes('audio vérifié'))).toBe(true);
    expect(validateContent({ ...content, exercises: [{ ...hello, sourceIds: ['absent'] }, name] }).some(error => error.includes('sources absente'))).toBe(true);
  });
  it('rejects knowledge supplied only by an optional sibling outside a lesson’s prerequisite closure', () => {
    const sibling: Lesson = { ...next, id: 'l.sibling', introduces: [], reviews: ['v.name'], prerequisites: ['l.hello'] };
    const branched: Content = { ...content, lessons: [first, sibling, next, checkpoint],
      units: [{ ...content.units[0], lessonIds: ['l.hello', 'l.sibling', 'l.name', 'l.review'] }] };
    const errors = validateContent(branched);
    expect(errors.some(error => error.includes('l.sibling') && error.includes('absent des prérequis'))).toBe(true);
    expect(validateContent({ ...branched, lessons: [first, { ...sibling, prerequisites: ['l.name'] }, next, checkpoint] })).toEqual([]);
  });
});
