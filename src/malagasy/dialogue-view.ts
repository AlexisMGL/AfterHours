import { characterArt } from './characters';
import type { CharacterId, DialogueTurn } from './types';
import { recordingForTurn } from './voice-bank';

const escape = (value: string | number): string => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const names: Record<CharacterId, string> = { lova: 'Lova', mia: 'Mia' };

function highlightedText(text: string, highlight?: string): string {
  if (!highlight) return escape(text);
  const index = text.toLocaleLowerCase('fr').indexOf(highlight.toLocaleLowerCase('fr'));
  if (index < 0) return escape(text);
  return `${escape(text.slice(0, index))}<mark>${escape(text.slice(index, index + highlight.length))}</mark>${escape(text.slice(index + highlight.length))}`;
}

export interface DialogueOptions {
  revealed?: number; interactive?: boolean; translations?: boolean; sceneId?: string;
  showTranslationControl?: boolean;
}
function renderTranslation(turn: DialogueTurn, options: DialogueOptions): string {
  if (options.showTranslationControl === false) return '';
  return `<details class="ma-speech-translation" ${options.translations ? 'open' : ''}><summary><span>Traduction</span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><p lang="fr">${escape(turn.translation)}</p></details>`;
}
function renderVoice(turn: DialogueTurn, context: string, index: number): string {
  const asset = recordingForTurn(turn), key = `${context}:${index}`;
  const speaker = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 4 0 5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/></svg>`;
  return `<span class="ma-voice-controls"><button type="button" class="ma-voice-replay" data-action="replay-dialogue" data-voice-key="${escape(key)}" ${asset ? `data-audio-id="${escape(asset.id)}"` : 'disabled'} aria-label="${asset ? `Réécouter ${names[turn.speaker]} : ${escape(turn.text)}` : 'Enregistrement non disponible pour cette phrase'}" title="${asset ? 'Réécouter cette phrase' : 'Enregistrement à venir'}">${speaker}</button>${asset ? `<button type="button" class="ma-voice-slow" data-action="slow-dialogue" data-voice-key="${escape(key)}" data-audio-id="${escape(asset.id)}" aria-label="Écouter lentement ${names[turn.speaker]} : ${escape(turn.text)}" title="Écouter lentement">0,75×</button>` : ''}<span class="ma-voice-status" data-voice-status="${escape(key)}" role="status" aria-live="polite"></span></span>`;
}

/** Short Malagasy exchanges stay central; a French translation is an optional disclosure. */
export function renderDialogue(turns: DialogueTurn[], options: DialogueOptions = {}): string {
  const revealed = Math.max(0, Math.min(turns.length, options.revealed ?? turns.length));
  const visible = turns.slice(0, revealed), lastSpeaker = visible.at(-1)?.speaker;
  const lesson = options.interactive === true;
  const context = `dialogue:${options.sceneId ?? 'conversation'}`;
  return `<section class="ma-dialogue-scene ${lesson ? 'ma-dialogue-discovery' : 'ma-dialogue-practice'}" ${options.sceneId ? `data-scene-id="${escape(options.sceneId)}"` : ''} data-dialogue-context="${escape(context)}" aria-label="Dialogue entre Lova et Mia"><div class="ma-dialogue-backdrop" aria-hidden="true"><span class="ma-dialogue-sun"></span><span class="ma-dialogue-cloud ma-dialogue-cloud-one"></span><span class="ma-dialogue-cloud ma-dialogue-cloud-two"></span><span class="ma-dialogue-hill ma-dialogue-hill-one"></span><span class="ma-dialogue-hill ma-dialogue-hill-two"></span><span class="ma-dialogue-house"></span><span class="ma-dialogue-plant"></span></div><div class="ma-dialogue-cast" aria-hidden="true"><figure class="ma-cast-lova ${lastSpeaker === 'lova' ? 'is-speaking' : ''}">${characterArt('lova', lastSpeaker === 'lova' ? 'speaking' : 'neutral', lesson ? 132 : 106)}<figcaption>Lova</figcaption></figure><figure class="ma-cast-mia ${lastSpeaker === 'mia' ? 'is-speaking' : ''}">${characterArt('mia', lastSpeaker === 'mia' ? 'speaking' : 'neutral', lesson ? 132 : 106)}<figcaption>Mia</figcaption></figure></div><div class="ma-dialogue-lines" aria-live="${lesson ? 'polite' : 'off'}">${visible.map((turn, index) => `<article class="ma-speech ma-speech-${turn.speaker} ${index === visible.length - 1 ? 'ma-speech-current' : ''}" data-dialogue-turn="${index}" data-voice-key="${escape(context)}:${index}" data-voice-state="idle"><div class="ma-speech-heading"><span class="ma-speech-name"><i></i>${names[turn.speaker]}</span>${renderVoice(turn, context, index)}</div><p class="ma-speech-text" lang="mg">${highlightedText(turn.text, turn.highlight)}</p>${renderTranslation(turn, options)}</article>`).join('')}${!visible.length ? '<div class="ma-dialogue-awaiting" aria-label="Une nouvelle rencontre commence"><i></i><i></i><i></i></div>' : ''}</div></section>`;
}

/** A brief original celebration, with a quiet, supportive response to mistakes. */
export function renderReward(correct: boolean, combo = 1, xp = 0): string {
  if (!correct) return `<div class="ma-reward ma-reward-encouragement" aria-hidden="true"><span class="ma-reward-character">${characterArt('lova', 'encouraging', 78)}</span><span class="ma-reward-reminder">On essaie encore !</span></div>`;
  const stars = ['✦', '★', '✧', '✦', '✧', '★', '✦', '✧'];
  return `<div class="ma-reward ma-reward-success" aria-hidden="true"><div class="ma-reward-stars">${stars.map((star, index) => `<span style="--ma-star:${index}">${star}</span>`).join('')}</div><span class="ma-reward-character">${characterArt(combo % 2 ? 'lova' : 'mia', 'happy', 83)}</span><span class="ma-reward-badge">${combo >= 3 ? `${combo} à la suite !` : xp > 0 ? `+${xp} XP` : 'Tsara !'}</span></div>`;
}
