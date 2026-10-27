import type { Exercise } from './types';
import { renderDialogue } from './dialogue-view';

export const escapeHtml = (value: string | number): string => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const e = escapeHtml;
export interface AnswerDraft { text: string; choice: string; ordered: number[]; matches: Record<string, string>; selectedLeft: string }
export const emptyDraft = (): AnswerDraft => ({ text: '', choice: '', ordered: [], matches: {}, selectedLeft: '' });
export function shuffled<T>(items: T[], key: string): T[] {
  const output = [...items];
  let seed = [...key].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
  for (let i = output.length - 1; i > 0; i--) { seed = (seed * 1664525 + 1013904223) >>> 0; const j = seed % (i + 1); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}
export const tokensFor = (exercise: Exercise): string[] => shuffled(exercise.tokens ?? [], exercise.id);

type Renderer = (exercise: Exercise, draft: AnswerDraft, disabled: boolean) => string;
const choiceRenderer: Renderer = (exercise, draft, disabled) => `<div class="ma-choices">${shuffled(exercise.choices ?? [], exercise.id).map((choice, i) => `<button type="button" class="ma-choice ${draft.choice === choice ? 'selected' : ''}" data-choice="${e(choice)}" data-focus="choice-${i}" aria-pressed="${draft.choice === choice}" ${disabled ? 'disabled' : ''}><span class="ma-choice-key">${i + 1}</span><span>${e(choice)}</span><span class="ma-choice-radio"></span></button>`).join('')}</div>`;
const textRenderer: Renderer = (exercise, draft, disabled) => `<label class="ma-answer-label" for="ma-answer">Votre réponse</label><input id="ma-answer" class="ma-answer" value="${e(draft.text)}" placeholder="Écrivez ici…" autocomplete="off" autocapitalize="sentences" spellcheck="false" ${disabled ? 'disabled' : ''}>`;
const orderRenderer: Renderer = (exercise, draft, disabled) => {
  const tokens = tokensFor(exercise);
  return `<div class="ma-word-answer" aria-label="Votre phrase">${draft.ordered.length ? draft.ordered.map((index, i) => `<button type="button" data-remove-token="${i}" data-focus="remove-${i}" ${disabled ? 'disabled' : ''}>${e(tokens[index])}<span aria-hidden="true"> ×</span></button>`).join('') : '<span>La phrase commence ici…</span>'}</div><div class="ma-word-bank">${tokens.map((token, i) => `<button type="button" data-token="${i}" data-focus="token-${i}" ${disabled || draft.ordered.includes(i) ? 'disabled' : ''}>${e(token)}</button>`).join('')}</div>`;
};
const matchRenderer: Renderer = (exercise, draft, disabled) => {
  const pairs = exercise.pairs ?? [], rights = shuffled(pairs.map(pair => pair.right), exercise.id);
  return `<div class="ma-matching"><div>${pairs.map((pair, i) => `<button type="button" data-left="${e(pair.left)}" data-focus="left-${i}" class="${draft.selectedLeft === pair.left ? 'selected' : ''} ${draft.matches[pair.left] ? 'paired' : ''}" aria-pressed="${draft.selectedLeft === pair.left}" ${disabled ? 'disabled' : ''}><span>${e(pair.left)}</span>${draft.matches[pair.left] ? `<small>${e(draft.matches[pair.left])}</small>` : ''}</button>`).join('')}</div><div>${rights.map((right, i) => `<button type="button" data-right="${e(right)}" data-focus="right-${i}" class="${Object.values(draft.matches).includes(right) ? 'paired' : ''}" ${disabled || !draft.selectedLeft ? 'disabled' : ''}>${e(right)}</button>`).join('')}</div></div>`;
};

/** Add a renderer and a matching validator to register a future exercise type. */
export const EXERCISE_RENDERERS: Record<Exercise['type'], Renderer> = {
  choice: choiceRenderer, reading: choiceRenderer, dialogue: choiceRenderer,
  culture: choiceRenderer, listening: (exercise, draft, disabled) => `<div class="ma-audio-player"><div><button type="button" data-action="play-audio">Écouter / reprendre</button><button type="button" data-action="pause-audio">Pause</button><button type="button" data-action="replay-audio">Réécouter</button><button type="button" data-action="slow-audio">Écouter lentement</button></div><p id="ma-audio-status" role="status">Écoutez l’enregistrement jusqu’au bout avant de répondre.</p></div>${choiceRenderer(exercise, draft, disabled)}`, cloze: textRenderer,
  translate: textRenderer, order: orderRenderer, match: matchRenderer,
};
export const TYPE_LABELS: Record<Exercise['type'], string> = {
  choice: 'Le bon mot', match: 'Les associations', order: 'À vous de construire',
  cloze: 'Le mot manquant', translate: 'À vous de traduire', reading: 'Au fil du texte',
  dialogue: 'À vous de parler', culture: 'Escale culturelle', listening: 'Tendez l’oreille',
};
export function renderAnswerControls(exercise: Exercise, draft: AnswerDraft, disabled = false): string {
  return EXERCISE_RENDERERS[exercise.type](exercise, draft, disabled);
}
export function renderTask(exercise: Exercise, draft: AnswerDraft, disabled = false, assessment = false): string {
  return `<div class="ma-task-type" data-exercise-id="${e(exercise.id)}">${TYPE_LABELS[exercise.type]}</div>${exercise.dialogue?.length ? renderDialogue(exercise.dialogue, { sceneId: exercise.id, showTranslationControl: !assessment || disabled }) : exercise.context ? `<div class="ma-exercise-context">${e(exercise.context).replace(/\n/g, '<br>')}</div>` : ''}<h2 id="ma-question">${e(exercise.question)}</h2><div class="ma-answer-controls">${renderAnswerControls(exercise, draft, disabled)}</div>`;
}
export function answerValue(exercise: Exercise, draft: AnswerDraft): string | string[] | Record<string, string> {
  if (exercise.type === 'order') return draft.ordered.map(index => tokensFor(exercise)[index]);
  if (exercise.type === 'match') return draft.matches;
  return exercise.type === 'cloze' || exercise.type === 'translate' ? draft.text : draft.choice;
}
export function hasAnswer(exercise: Exercise, draft: AnswerDraft): boolean {
  if (exercise.type === 'order') return draft.ordered.length > 0;
  if (exercise.type === 'match') return Object.keys(draft.matches).length === exercise.pairs?.length;
  return !!(exercise.type === 'cloze' || exercise.type === 'translate' ? draft.text.trim() : draft.choice);
}
