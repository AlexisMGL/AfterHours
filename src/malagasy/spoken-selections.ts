import type { Exercise } from './types';

/** Language is authored, never guessed from spelling or answer correctness. */
export function spokenSelectionsForExercise(exercise: Exercise): string[] {
  if (exercise.spokenSelections) return exercise.spokenSelections;
  if (exercise.selectionLanguage !== 'mg') return [];
  return exercise.choices ?? exercise.tokens ?? exercise.pairs?.map(pair => pair.left) ?? [];
}
