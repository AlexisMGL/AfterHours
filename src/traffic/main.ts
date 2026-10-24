import './style.css';
import { BOARD_SIZE, createPuzzle, movementRange, moveVehicle, solvePuzzle, undoMove, type Level, type Move, type PuzzleState, type Vehicle } from './core';
import { LEVELS, WORLDS } from './levels';
import { TrafficAudio, TRACKS } from './audio';
import { icon, vehicleArt, worldArt } from './art';

document.documentElement.lang = 'fr';
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const STORAGE_KEY = 'afterhours-exit-lane-v1';
interface Progress { version: 1; lastLevel: number; best: Record<number, number>; runs: Record<number, Move[]>; volume: number; muted: boolean }
const defaults = (): Progress => ({ version: 1, lastLevel: 1, best: {}, runs: {}, volume: .45, muted: false });
function loadProgress(): Progress {
  const result = defaults();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return result;
    const data = stored as Partial<Progress>;
    if (data.version !== 1) return result;
    if (Number.isInteger(data.lastLevel) && LEVELS.some(level => level.id === data.lastLevel)) result.lastLevel = data.lastLevel!;
    if (typeof data.volume === 'number' && Number.isFinite(data.volume)) result.volume = Math.max(0, Math.min(1, data.volume));
    if (typeof data.muted === 'boolean') result.muted = data.muted;
    for (const level of LEVELS) {
      const best = data.best?.[level.id];
      if (Number.isInteger(best) && best! >= level.par && best! < 100000) result.best[level.id] = best!;
      const run = data.runs?.[level.id];
      if (Array.isArray(run) && run.length <= 2000 && run.every(move => move && typeof move.id === 'string' && Number.isInteger(move.delta))) {
        result.runs[level.id] = run.map(move => ({ id: move.id, delta: move.delta }));
      }
    }
  } catch { /* Storage can be unavailable; the complete game still works. */ }
  return result;
}
const progress = loadProgress();
let storageUnavailable = false;
function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  catch { storageUnavailable = true; }
}
let level = LEVELS.find(candidate => candidate.id === progress.lastLevel)!;
let state: PuzzleState = createPuzzle(level);
let selected = state.vehicles.find(car => car.target)!.id;
let hint: Move | undefined;
let hintBusy = false;
let hintTimer: ReturnType<typeof setTimeout> | undefined;
let announcement = '';
let audioStarted = false;
let destroyed = false;
const audio = new TrafficAudio(() => updateMusic());
audio.setVolume(progress.volume);
audio.setMuted(progress.muted);
audio.setSfxVolume(.35);

function restoreRun(): void {
  state = createPuzzle(level);
  const valid: Move[] = [];
  for (const move of progress.runs[level.id] ?? []) {
    const next = moveVehicle(state, move.id, move.delta);
    if (next === state) break;
    state = next;
    valid.push(move);
  }
  progress.runs[level.id] = valid;
  selected = state.vehicles.find(car => car.target)!.id;
}
restoreRun();

$('#app').innerHTML = `<div class="tl-page">
  <header class="tl-header"><a class="tl-brand" href="/rush-hour" aria-label="EXIT LANE, accueil du jeu"><span class="tl-brand-mark">${icon('arrow')}</span><span>EXIT LANE<small>LE BON SENS DU DÉTOUR</small></span></a><nav><a class="tl-back" href="/">← RETOUR À L’ARCADE</a><button class="tl-help-button" data-action="help" aria-label="Comment jouer">${icon('help')}<span>COMMENT JOUER</span></button></nav></header>
  <main><section class="tl-hero"><div><div class="tl-eyebrow"><b></b>UN CASSE-TÊTE. UNE PETITE ÉVASION.</div><h1>Un petit bouchon.<br>Un grand <em>déclic.</em></h1><p>Faites de la place. Trouvez votre chemin.<br>Votre voiture rouge a rendez-vous dehors.</p></div><div class="tl-progress" id="tl-progress"></div></section>
  <nav class="tl-worlds" id="tl-worlds" aria-label="Les trois mondes"></nav>
  <section class="tl-workspace" aria-label="Puzzle de circulation"><div><div class="tl-play-card" id="tl-game"></div><p class="tl-live" id="tl-live" role="status" aria-live="polite"></p></div><aside class="tl-side" id="tl-side" aria-label="Niveaux et musique"></aside></section>
  </main><footer class="tl-footer"><a href="/">AFTERHOURS ARCADE</a><span>3 MONDES · 15 DÉCLICS · 5 MÉLODIES</span><span>PRENEZ VOTRE TEMPS. LA SORTIE EST LÀ.</span></footer>
  <dialog class="tl-dialog" id="tl-help" aria-labelledby="tl-help-title"><div class="tl-eyebrow">LE CODE DE LA PETITE ÉVASION</div><h2 id="tl-help-title">Place au déclic.</h2><ol><li>Faites sortir la <strong>voiture rouge</strong> par l’ouverture à droite.</li><li>Glissez les véhicules pour libérer le passage. Chacun avance et recule <strong>dans son axe</strong>, sans tourner ni traverser les autres.</li><li>Un glissement compte pour un coup, quelle que soit sa longueur. Le nombre « idéal » est la solution la plus courte, sortie comprise.</li><li>Vous pouvez annuler, recommencer et demander un indice à tout moment.</li></ol><p><strong>Au clavier :</strong> sélectionnez une voiture avec <kbd>Tab</kbd> ou un clic, puis utilisez les flèches. <kbd>Z</kbd> annule, <kbd>R</kbd> recommence et <kbd>H</kbd> donne un indice. Une voiture peut se déplacer de plusieurs cases avec <kbd>Maj</kbd> + flèche.</p><p>Trois étoiles pour le nombre idéal de coups ; deux pour un petit détour. Tous les niveaux sont accessibles et votre progression se sauvegarde sur cet appareil.</p><button class="tl-primary" data-action="close-help">C’est parti ${icon('arrow')}</button></dialog>
</div>`;

const stars = (moves: number, par: number): number => moves <= par ? 3 : moves <= par + Math.max(3, Math.ceil(par * .25)) ? 2 : 1;
const starText = (count: number): string => '★'.repeat(count) + '☆'.repeat(3 - count);
const world = () => WORLDS.find(candidate => candidate.id === level.worldId)!;
const carName = (car: Vehicle): string => car.target ? 'Voiture rouge' : `${car.length === 3 ? 'Camion' : 'Voiture'} ${car.id}`;
function startAudio(): void {
  if (audioStarted) return;
  audioStarted = true;
  void audio.unlock().then(() => { if (!destroyed) { audio.play(); updateMusic(); } });
}

function updateMusic(): void {
  const current = audio.getTrack(), title = document.querySelector('#tl-track-name'), subtitle = document.querySelector('#tl-track-meta');
  if (title) title.textContent = current.name;
  if (subtitle) subtitle.textContent = `${String(TRACKS.indexOf(current) + 1).padStart(2, '0')} / 05 · ${audioStarted ? 'LA BANDE-SON DU DÉTOUR' : 'DÉMARRE AVEC VOTRE PREMIER GESTE'}`;
}

function render(): void {
  cancelDrag();
  const activeCar = (document.activeElement as HTMLElement | null)?.dataset.car;
  const completed = Object.keys(progress.best).length;
  $('#tl-progress').innerHTML = `<strong>${String(completed).padStart(2, '0')}<small> / 15</small></strong><span>ÉVASIONS RÉUSSIES</span><small>À chaque détour, un déclic.</small><div class="tl-progress-track" aria-label="${completed} niveaux réussis sur 15"><i style="width:${completed / 15 * 100}%"></i></div>`;
  $('#tl-worlds').innerHTML = WORLDS.map((entry, index) => {
    const levels = LEVELS.filter(candidate => candidate.worldId === entry.id);
    return `<button class="tl-world tl-world-${entry.id}" data-action="world" data-world="${entry.id}" aria-label="Monde ${index + 1} : ${entry.name}" aria-pressed="${entry.id === level.worldId}"><small>MONDE 0${index + 1}<span> / ${index === 0 ? 'PREMIERS PAS' : index === 1 ? 'ON PREND LE LARGE' : 'LES GRANDS DÉFIS'}</span></small><strong>${entry.name}</strong><span>${levels.map(candidate => `<i class="tl-world-dot ${progress.best[candidate.id] ? 'done' : ''}"></i>`).join('')} ${levels.filter(candidate => progress.best[candidate.id]).length} / 5</span><span class="tl-world-art">${worldArt(entry.id)}</span></button>`;
  }).join('');
  const target = state.vehicles.find(car => car.target)!, exitReady = !state.won && movementRange(state, target.id).max === BOARD_SIZE - target.x;
  const play = $('#tl-game');
  play.dataset.world = level.worldId;
  play.innerHTML = `<div class="tl-level-heading"><div><small>${world().name.toUpperCase()} / NIVEAU ${String(level.id).padStart(2, '0')}</small><h2>${level.name}</h2></div><span class="tl-level-tag">${level.id <= 5 ? 'TRANQUILLE' : level.id <= 10 ? 'ÇA SE CORSE' : 'BIEN CORSÉ'}</span></div>
    <div class="tl-board-stage"><div class="tl-board" id="tl-board" role="group" aria-label="Parking de 6 cases sur 6, niveau ${level.id}">
      ${state.vehicles.map(car => `<button class="tl-car ${car.id === selected ? 'selected' : ''} ${hint?.id === car.id ? 'hinted' : ''} ${car.target && state.won ? 'is-exited' : ''}" data-car="${car.id}" data-axis="${car.axis}" data-x="${car.x}" data-y="${car.y}" aria-label="${carName(car)}, ${car.axis === 'h' ? 'horizontale' : 'verticale'}, ${car.length} cases" aria-pressed="${car.id === selected}" ${state.won ? 'disabled' : ''} style="left:${car.x / 6 * 100}%;top:${car.y / 6 * 100}%;width:${(car.axis === 'h' ? car.length : 1) / 6 * 100}%;height:${(car.axis === 'v' ? car.length : 1) / 6 * 100}%">${vehicleArt(car)}</button>`).join('')}
      <button class="tl-exit ${exitReady ? 'ready' : ''}" data-action="exit" aria-label="Sortir la voiture rouge" ${exitReady ? '' : 'disabled'}>${icon('arrow')}<span>SORTIE</span></button>
      ${state.won ? victoryMarkup() : ''}
    </div></div>
    <div class="tl-board-caption"><span>GLISSEZ · AVANCEZ · RECULEZ</span><span><b id="tl-move-count">${state.moves}</b> COUPS <span aria-hidden="true">/</span> IDÉAL <b>${level.par}</b></span></div>
    <div class="tl-controls"><button data-action="undo" ${state.history.length ? '' : 'disabled'}>${icon('undo')}Annuler<kbd>Z</kbd></button><button data-action="reset">${icon('reset')}Recommencer<kbd>R</kbd></button><button data-action="hint" ${state.won || hintBusy ? 'disabled' : ''}>${icon('hint')}${hintBusy ? 'Recherche…' : 'Indice'}<kbd>H</kbd></button></div>`;
  const best = progress.best[level.id], selection = LEVELS.filter(candidate => candidate.worldId === level.worldId);
  $('#tl-side').innerHTML = `<section class="tl-panel tl-mission"><div class="tl-panel-caption">VOTRE PETITE MISSION<span>0${WORLDS.indexOf(world()) + 1} / 03</span></div><h3>Le chemin se dessine.</h3><p>${level.brief} Les voitures suivent leur axe. La rouge rejoint l’ouverture à droite.</p><div class="tl-stats"><div class="tl-stat"><strong>${state.moves}</strong><span>Vos coups</span></div><div class="tl-stat"><strong>${level.par}</strong><span>L’idéal</span></div><div class="tl-stat"><strong>${best ?? '—'}</strong><span>Votre record</span></div></div></section>
    <section class="tl-panel"><div class="tl-panel-caption">LES CINQ DÉTOURS<span>${world().name}</span></div><nav class="tl-level-list" aria-label="Les cinq niveaux du monde">${selection.map(candidate => {
      const record = progress.best[candidate.id];
      return `<button class="tl-level-choice ${record ? 'done' : ''}" data-action="level" data-level="${candidate.id}" aria-label="Niveau ${candidate.id} : ${candidate.name}${record ? `, réussi en ${record} coups` : ''}" aria-current="${candidate.id === level.id}"><strong>${String(candidate.id).padStart(2, '0')}</strong><span class="tl-stars" aria-hidden="true">${starText(record ? stars(record, candidate.par) : 0)}</span></button>`;
    }).join('')}</nav><p class="tl-level-note"><span>${selection[0]!.par} → ${selection.at(-1)!.par} coups idéaux</span><span>Tous accessibles</span></p></section>
    ${hint ? `<section class="tl-panel tl-hint-panel"><h3>${icon('hint')}Un petit coup de pouce</h3><p>${hintDescription(hint)}</p><button class="tl-text-button" data-action="apply-hint">Jouer ce coup ${icon('arrow')}</button><button class="tl-text-button" data-action="hide-hint">Masquer</button></section>` : ''}
    <section class="tl-panel tl-music"><div class="tl-panel-caption">LA RADIO DES PETITS DÉTOURS<span>5 TITRES ORIGINAUX</span></div><div class="tl-music-info"><span class="tl-record">${icon('music')}</span><div class="tl-music-copy"><strong id="tl-track-name"></strong><small id="tl-track-meta"></small></div><button class="tl-next-track" data-action="next-track" aria-label="Musique suivante">${icon('next')}</button></div><div class="tl-music-volume"><button class="tl-mute" data-action="mute" aria-label="Couper le son" aria-pressed="${progress.muted}">${icon('sound')}</button><input id="tl-volume" type="range" min="0" max="100" value="${Math.round(progress.volume * 100)}" aria-label="Volume de la musique"><output id="tl-volume-value">${Math.round(progress.volume * 100)}%</output></div><p class="tl-music-foot">Les cinq morceaux alternent, même si vous prenez votre temps.</p></section>`;
  $('#tl-live').textContent = announcement || (storageUnavailable ? 'La sauvegarde est indisponible ; vous pouvez continuer à jouer.' : 'Souris, tactile ou clavier. Prenez votre temps, il y a toujours une solution.');
  updateMusic();
  if (activeCar && !state.won) $<HTMLButtonElement>(`[data-car="${activeCar}"]`)?.focus({ preventScroll: true });
}

function victoryMarkup(): string {
  const final = level.id === LEVELS.at(-1)!.id, earned = stars(state.moves, level.par);
  return `<section class="tl-win" role="region" aria-label="Niveau réussi"><div class="tl-win-content"><span>LA VOIE EST LIBRE / NIVEAU ${String(level.id).padStart(2, '0')}</span><h3>${final && Object.keys(progress.best).length === LEVELS.length ? 'La ville vous dit merci.' : 'Et voilà, dehors !'}</h3><div class="tl-win-stars" aria-label="${earned} étoiles sur 3">${starText(earned)}</div><p>${state.moves} coups · idéal ${level.par}<br>${earned === 3 ? 'Le bon chemin, sans un détour de trop.' : 'Une belle évasion. À vous de trouver le chemin idéal.'}</p><button class="tl-primary" data-action="${final ? 'first-level' : 'next-level'}">${final ? 'Retour aux premiers détours' : level.id % 5 === 0 ? 'Découvrir le prochain monde' : 'Le détour suivant'}${icon('arrow')}</button><button class="tl-text-button" data-action="reset">Rejouer pour le plaisir</button></div></section>`;
}

function hintDescription(move: Move): string {
  const car = state.vehicles.find(candidate => candidate.id === move.id)!;
  if (car.target && car.x + move.delta === BOARD_SIZE) return 'La voie est libre : faites sortir la voiture rouge vers la droite.';
  const direction = car.axis === 'h' ? move.delta < 0 ? 'la gauche' : 'la droite' : move.delta < 0 ? 'le haut' : 'le bas';
  return `${carName(car)} : ${Math.abs(move.delta)} case${Math.abs(move.delta) > 1 ? 's' : ''} vers ${direction}.`;
}
function clearHint(): void { if (hintTimer) clearTimeout(hintTimer); hintTimer = undefined; hint = undefined; hintBusy = false; }
function changeLevel(id: number): void {
  const candidate = LEVELS.find(entry => entry.id === id);
  if (!candidate) return;
  clearHint(); level = candidate; progress.lastLevel = id; restoreRun(); save();
  announcement = `Niveau ${level.id} : ${level.name}. ${level.par} coups pour le chemin idéal.`;
  render();
}
function commit(id: string, delta: number): void {
  const next = moveVehicle(state, id, delta);
  if (next === state) return;
  const car = state.vehicles.find(candidate => candidate.id === id)!;
  clearHint(); state = next; selected = id;
  progress.runs[level.id] ??= [];
  progress.runs[level.id]!.push({ id, delta });
  if (state.won) {
    progress.best[level.id] = Math.min(progress.best[level.id] ?? Infinity, state.moves);
    announcement = `Niveau ${level.id} réussi en ${state.moves} coups. ${stars(state.moves, level.par)} étoiles sur 3.`;
    audio.sfx('win');
  } else { announcement = `${carName(car)} déplacée. ${state.moves} coup${state.moves > 1 ? 's' : ''}.`; audio.sfx('move'); }
  save(); render();
  if (state.won) document.querySelector<HTMLButtonElement>('.tl-win .tl-primary')?.focus({ preventScroll: true });
}
function undo(): void {
  const previous = undoMove(state);
  if (previous === state) return;
  clearHint(); state = previous; progress.runs[level.id]?.pop(); audio.sfx('undo');
  announcement = `Dernier déplacement annulé. ${state.moves} coups.`; save(); render();
}
function reset(): void {
  clearHint(); state = createPuzzle(level); progress.runs[level.id] = []; selected = state.vehicles.find(car => car.target)!.id;
  announcement = 'Le parking retrouve sa position de départ. Votre record est conservé.'; audio.sfx('select'); save(); render();
}
function requestHint(): void {
  if (state.won || hintBusy) return;
  hintBusy = true; announcement = 'Recherche du chemin le plus court depuis votre position…'; render();
  const initial = state;
  hintTimer = setTimeout(() => {
    hintTimer = undefined;
    if (destroyed || state !== initial) return;
    const solution = solvePuzzle(state.vehicles);
    hint = solution?.[0]; hintBusy = false;
    announcement = hint ? hintDescription(hint) : 'La voie est déjà libre.';
    if (hint) selected = hint.id;
    render();
  }, 24);
}
function selectCar(id: string): void {
  selected = id;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-car]')) {
    button.classList.toggle('selected', button.dataset.car === id);
    button.setAttribute('aria-pressed', String(button.dataset.car === id));
  }
}

interface Drag { pointer: number; id: string; button: HTMLButtonElement; origin: number; cells: number; delta: number; min: number; max: number; axis: 'h' | 'v' }
let drag: Drag | undefined;
interface TouchPress { pointer: number; button: HTMLButtonElement; x: number; y: number; cancelled: boolean }
let touchPress: TouchPress | undefined;
let lastTouchAction: { pointer: number; button: HTMLButtonElement; at: number } | undefined;
function cancelDrag(): void {
  touchPress = undefined;
  if (!drag) return;
  const current = drag; drag = undefined;
  current.button.style.transform = ''; current.button.classList.remove('is-dragging');
  if (current.button.hasPointerCapture(current.pointer)) current.button.releasePointerCapture(current.pointer);
}
function pointerDown(event: PointerEvent): void {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button || button.disabled || event.button !== 0 || drag || !event.isPrimary) return;
  if (!button.dataset.car) {
    if (event.pointerType === 'touch') touchPress = { pointer: event.pointerId, button, x: event.clientX, y: event.clientY, cancelled: false };
    return;
  }
  if (state.won) return;
  startAudio();
  const id = button.dataset.car!, car = state.vehicles.find(candidate => candidate.id === id)!;
  selectCar(id); button.focus({ preventScroll: true });
  const range = movementRange(state, id), board = $('#tl-board');
  drag = { pointer: event.pointerId, id, button, origin: car.axis === 'h' ? event.clientX : event.clientY, cells: board.clientWidth / 6, delta: 0, min: range.min, max: range.max, axis: car.axis };
  button.setPointerCapture(event.pointerId);
  button.classList.add('is-dragging');
  event.preventDefault();
}
function pointerMove(event: PointerEvent): void {
  if (touchPress?.pointer === event.pointerId && Math.hypot(event.clientX - touchPress.x, event.clientY - touchPress.y) > 12) touchPress.cancelled = true;
  if (!drag || event.pointerId !== drag.pointer) return;
  const offset = ((drag.axis === 'h' ? event.clientX : event.clientY) - drag.origin) / drag.cells;
  drag.delta = Math.max(drag.min, Math.min(drag.max, offset));
  drag.button.style.transform = `translate${drag.axis === 'h' ? 'X' : 'Y'}(${drag.delta * drag.cells}px)`;
  event.preventDefault();
}
function pointerEnd(event: PointerEvent): void {
  if (touchPress?.pointer === event.pointerId) {
    const press = touchPress; touchPress = undefined;
    const released = (event.target as Element).closest<HTMLButtonElement>('button');
    if (event.type === 'pointerup' && !press.cancelled && released === press.button && press.button.isConnected && !press.button.disabled) {
      // A touch drag can remove its original DOM target. Handle the next tap
      // directly instead of depending on a compatibility mouse click.
      lastTouchAction = { pointer: event.pointerId, button: press.button, at: performance.now() };
      event.preventDefault();
      activateButton(press.button);
    }
    return;
  }
  if (!drag || event.pointerId !== drag.pointer) return;
  const current = drag; drag = undefined;
  current.button.style.transform = ''; current.button.classList.remove('is-dragging');
  if (current.button.hasPointerCapture(event.pointerId)) current.button.releasePointerCapture(event.pointerId);
  if (event.type === 'pointercancel') return;
  let delta = Math.round(current.delta);
  const car = state.vehicles.find(candidate => candidate.id === current.id)!;
  if (car.target && car.x + delta > BOARD_SIZE - car.length) delta = BOARD_SIZE - car.x;
  commit(current.id, delta);
}

function click(event: MouseEvent): void {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  const pointer = event as PointerEvent;
  if (event.detail > 0 && lastTouchAction && performance.now() - lastTouchAction.at < 800
    && (pointer.pointerType === 'touch' || pointer.pointerId === lastTouchAction.pointer || button === lastTouchAction.button)) return;
  activateButton(button);
}
function activateButton(button: HTMLButtonElement): void {
  if (button.disabled) return;
  startAudio();
  if (button.dataset.car) { selectCar(button.dataset.car); return; }
  switch (button.dataset.action) {
    case 'world': if (button.dataset.world !== level.worldId) changeLevel(LEVELS.find(candidate => candidate.worldId === button.dataset.world)!.id); break;
    case 'level': changeLevel(Number(button.dataset.level)); break;
    case 'undo': undo(); break;
    case 'reset': reset(); break;
    case 'hint': requestHint(); break;
    case 'hide-hint': clearHint(); announcement = ''; render(); break;
    case 'apply-hint': if (hint) commit(hint.id, hint.delta); break;
    case 'exit': { const target = state.vehicles.find(car => car.target)!; commit(target.id, BOARD_SIZE - target.x); break; }
    case 'next-level': changeLevel(level.id + 1); break;
    case 'first-level': changeLevel(1); break;
    case 'next-track': audio.next(); updateMusic(); break;
    case 'mute': progress.muted = !progress.muted; audio.setMuted(progress.muted); button.setAttribute('aria-pressed', String(progress.muted)); save(); break;
    case 'help': $<HTMLDialogElement>('#tl-help').showModal(); break;
    case 'close-help': $<HTMLDialogElement>('#tl-help').close(); break;
  }
}
function keydown(event: KeyboardEvent): void {
  if ($<HTMLDialogElement>('#tl-help').open || (event.target instanceof HTMLInputElement) || event.altKey || event.metaKey) return;
  const arrow = event.key.startsWith('Arrow');
  if (!arrow && !['z', 'r', 'h'].includes(event.key.toLowerCase())) return;
  if (event.ctrlKey && event.key.toLowerCase() !== 'z') return;
  if (event.repeat && !arrow) return;
  event.preventDefault(); startAudio();
  const key = event.key.toLowerCase();
  if (key === 'z') { undo(); return; }
  if (key === 'r') { reset(); return; }
  if (key === 'h') { requestHint(); return; }
  if (state.won) return;
  const focused = (document.activeElement as HTMLElement | null)?.dataset.car;
  if (focused) selectCar(focused);
  const car = state.vehicles.find(candidate => candidate.id === selected)!;
  if ((car.axis === 'h' && !['ArrowLeft', 'ArrowRight'].includes(event.key)) || (car.axis === 'v' && !['ArrowUp', 'ArrowDown'].includes(event.key))) return;
  const sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
  const range = movementRange(state, car.id);
  let delta = event.shiftKey ? sign < 0 ? range.min : range.max : sign;
  if (car.target && sign > 0 && car.x + delta > BOARD_SIZE - car.length) delta = BOARD_SIZE - car.x;
  commit(car.id, delta);
}
function volume(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.id !== 'tl-volume') return;
  progress.volume = Number(input.value) / 100; audio.setVolume(progress.volume);
  $('#tl-volume-value').textContent = `${input.value}%`; save(); startAudio();
}
function focus(event: FocusEvent): void {
  const id = (event.target as HTMLElement).dataset.car;
  if (id) selectCar(id);
}
function destroy(): void {
  destroyed = true; clearHint(); audio.destroy();
  document.removeEventListener('pointerdown', pointerDown); document.removeEventListener('pointermove', pointerMove);
  document.removeEventListener('pointerup', pointerEnd); document.removeEventListener('pointercancel', pointerEnd);
  document.removeEventListener('click', click); document.removeEventListener('keydown', keydown); document.removeEventListener('input', volume); document.removeEventListener('focusin', focus);
  window.removeEventListener('pagehide', pageHidden); window.removeEventListener('pageshow', pageShown);
}
function pageHidden(event: PageTransitionEvent): void { cancelDrag(); if (event.persisted) audio.pause(); else destroy(); }
function pageShown(event: PageTransitionEvent): void { if (event.persisted && audioStarted && !destroyed) audio.resume(); }
document.addEventListener('pointerdown', pointerDown);
document.addEventListener('pointermove', pointerMove, { passive: false });
document.addEventListener('pointerup', pointerEnd); document.addEventListener('pointercancel', pointerEnd);
document.addEventListener('click', click); document.addEventListener('keydown', keydown); document.addEventListener('input', volume); document.addEventListener('focusin', focus);
window.addEventListener('pagehide', pageHidden); window.addEventListener('pageshow', pageShown);
render();
if (import.meta.env.DEV) (window as unknown as { __TRAFFIC__: object }).__TRAFFIC__ = { state: () => structuredClone(state), level: () => structuredClone(level), progress: () => structuredClone(progress) };
