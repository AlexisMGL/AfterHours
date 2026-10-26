import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/malagasy/content';
import { validateContent } from '../src/malagasy/engine';

describe('Dialogue-first Malagasy curriculum', () => {
  it('keeps existing save identifiers while limiting playable content to the first three units', () => {
    expect(CONTENT.units.filter(unit => unit.implemented).map(unit => unit.id)).toEqual(['unit-01', 'unit-02', 'unit-03']);
    expect(CONTENT.lessons).toHaveLength(9);
    for (let unit = 1; unit <= 3; unit++) {
      for (let part = 1; part <= 3; part++) {
        for (const suffix of ['a', 'b', 'c', 'd', 'e', 'f']) {
          expect(CONTENT.exercises.some(exercise => exercise.id === `exercise-0${unit}-0${part}-${suffix}`)).toBe(true);
        }
      }
    }
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('introduces every learning part through short character scenes before its practice', () => {
    const learning = CONTENT.lessons.filter(lesson => lesson.kind !== 'checkpoint');
    expect(learning).toHaveLength(6);
    expect(learning.flatMap(lesson => lesson.scenes ?? [])).toHaveLength(24);
    for (const lesson of learning) {
      expect(lesson.scenes).toHaveLength(4);
      for (const scene of lesson.scenes!) {
        expect(scene.id).toMatch(/^scene-/);
        expect(scene.setting.length).toBeLessThan(80);
        expect(scene.turns.length).toBeGreaterThan(0);
        expect(scene.turns.length).toBeLessThanOrEqual(3);
        for (const turn of scene.turns) {
          expect(['lova', 'mia']).toContain(turn.speaker);
          expect(turn.text.trim()).not.toBe('');
          expect(turn.translation.trim()).not.toBe('');
          expect(turn.text).not.toMatch(/https?:\/\//);
        }
        expect(scene.takeaway?.malagasy).toBeTruthy();
      }
    }
  });

  it('places each activity in a dialogue without long French context or exposed citations', () => {
    expect(CONTENT.exercises).toHaveLength(72);
    expect(new Set(CONTENT.exercises.map(exercise => exercise.type))).toEqual(new Set(['choice', 'dialogue', 'reading', 'match', 'translate', 'cloze', 'order']));
    for (const exercise of CONTENT.exercises) {
      expect(exercise.dialogue?.length, exercise.id).toBeGreaterThan(0);
      expect(exercise.context, exercise.id).toBeUndefined();
      expect(exercise.question.length, exercise.id).toBeLessThan(100);
      expect(exercise.sourceIds.length).toBeGreaterThan(0);
      expect([exercise.prompt, exercise.question, ...(exercise.dialogue ?? []).map(turn => turn.text)].join(' ')).not.toMatch(/https?:\/\//);
    }
  });

  it('ends each unit with a complete twelve-question quiz covering every concept it introduced', () => {
    for (const unit of CONTENT.units.filter(candidate => candidate.implemented)) {
      const lessons = unit.lessonIds.map(id => CONTENT.lessons.find(lesson => lesson.id === id)!);
      const checkpoint = lessons.at(-1)!;
      expect(checkpoint.kind).toBe('checkpoint');
      expect(checkpoint.title).toMatch(/^Quiz final/);
      expect(checkpoint.introduces).toEqual([]);
      expect(checkpoint.exerciseIds).toHaveLength(12);
      const tested = new Set(checkpoint.exerciseIds.flatMap(id => CONTENT.exercises.find(exercise => exercise.id === id)!.concepts));
      for (const introduced of lessons.flatMap(lesson => lesson.introduces)) expect(tested.has(introduced), `${unit.id}: ${introduced}`).toBe(true);
      expect(new Set(checkpoint.exerciseIds.map(id => CONTENT.exercises.find(exercise => exercise.id === id)!.type)).size).toBeGreaterThanOrEqual(5);
    }
  });

  it('presents isolated subject pronouns as quoted learning words rather than natural autonomous replies', () => {
    const lesson = CONTENT.lessons.find(candidate => candidate.id === 'lesson-02-01')!;
    const scene = lesson.scenes!.find(candidate => candidate.id === 'scene-02-01-d')!;
    expect(scene.setting).toBe('Les petits mots des phrases');
    expect(scene.turns.map(turn => turn.text)).toEqual(['« aho »', '« ianao »', '« izy »']);
    expect(scene.turns.every(turn => turn.translation.includes('pronom'))).toBe(true);
    const exercise = CONTENT.exercises.find(candidate => candidate.id === 'exercise-02-01-c')!;
    expect(exercise.dialogue!.map(turn => turn.text)).toEqual(['« aho »', '« ianao »', '« izy »']);
    expect(CONTENT.concepts.find(concept => concept.id === 'grammar.singular-pronouns')!.sourceIds).toContain('dict-aho');
  });

  it('never puts an unseen Malagasy word into an exercise conversation or word bank', () => {
    const words = (text: string): string[] => text.toLocaleLowerCase('fr').match(/[\p{L}]+/gu) ?? [];
    const encountered = new Set(['lova', 'mia']);
    for (const lesson of CONTENT.lessons) {
      for (const scene of lesson.scenes ?? []) {
        for (const turn of scene.turns) for (const word of words(turn.text)) encountered.add(word);
      }
      for (const exerciseId of lesson.exerciseIds) {
        const exercise = CONTENT.exercises.find(candidate => candidate.id === exerciseId)!;
        const testedWords = [...(exercise.dialogue ?? []).flatMap(turn => words(turn.text)), ...(exercise.tokens ?? []).flatMap(words)];
        for (const word of testedWords) expect(encountered.has(word), `${exercise.id}: ${word} absent des rencontres précédentes`).toBe(true);
      }
    }
  });
});
