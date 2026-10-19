import './style.css';
import { Match } from './core/engine';
import { Action, Difficulty, FIXED_DT, MapId, MatchConfig, PowerUp } from './core/types';
import { MAPS } from './maps/maps';
import { AIController } from './ai/controller';
import { ArenaRenderer } from './render/ArenaRenderer';
import { AudioManager } from './audio/AudioManager';
import { LocalHumanController } from './ui/input';
import { loadSettings, saveSettings } from './ui/settings';

const icon = (name: string, size=20) => {
  const paths: Record<string,string> = {
    bomb:'<circle cx="10" cy="14" r="7"/><path d="m14 8 3-4m-1-2 1 2 3-1M6 12a4 4 0 0 1 4-3"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    sound:'<path d="M4 9h4l5-4v14l-5-4H4zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    gear:'<path d="m10 3-1 3-3 1-3 3 2 2-2 2 3 3 3 1 1 3h4l1-3 3-1 3-3-2-2 2-2-3-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    shuffle:'<path d="M3 6h3c5 0 6 12 11 12h4m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-5c1-2 2-3 4-3h3m-4-4 4 4-4 4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3c0 3 2 4 5 4m7-7h4v3c0 3-2 4-5 4m-3 2v6m-5 0h10"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.bolt}</svg>`;
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const app = $('#app');
app.innerHTML = `<div class="shell">
  <header class="topbar"><button class="brand" data-action="home" aria-label="Blast Arena home"><span class="brand-mark">${icon('bomb',25)}</span>BLAST<span>ARENA</span><small>ARCADE CLUB</small></button><div class="top-status"><span class="live-dot"></span> ALL PLAY. NO DOWNLOAD.</div><div class="top-actions"><a class="arcade-return" href="/" aria-label="Back to arcade">← ARCADE</a><button class="icon-button" data-action="sound" aria-label="Toggle music" title="Toggle music">${icon('sound')}</button><button class="icon-button" data-action="settings" aria-label="Settings" title="Settings">${icon('gear')}</button></div></header>
  <main class="layout"><section id="panel" class="panel"></section><section class="stage-column"><div class="stage-heading"><div><span class="live-dot"></span><span id="stage-mode">LIVE ARENA</span></div><span id="stage-label"></span></div><div class="arena-frame"><div class="arena-corner corner-tl"></div><div class="arena-corner corner-tr"></div><div class="arena-corner corner-bl"></div><div class="arena-corner corner-br"></div><div id="arena" aria-label="Game arena"></div><div id="arena-overlay" class="arena-overlay" hidden></div><div class="arena-coordinate coord-top">01 — 15</div><div class="arena-coordinate coord-side">BLAST ZONE</div></div><div id="stage-bottom" class="stage-bottom"></div></section></main>
  <section id="map-strip" class="map-strip"></section><footer><span>BUILT FOR <strong>ONE MORE ROUND.</strong></span><div class="key-hints"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>SPACE</kbd> BOMB</span><span><kbd>E</kbd> ABILITY</span><span><kbd>ESC</kbd> PAUSE</span></div><span class="version">LOCAL ARCADE / V1.0</span></footer>
</div><dialog id="dialog"></dialog><div id="toast" class="toast" role="status"></div>`;
const settings = loadSettings();
const audio = new AudioManager();
const human = new LocalHumanController();
const renderer = new ArenaRenderer($('#arena'), { reducedMotion: settings.reducedMotion });
let screen: 'menu'|'setup'|'game' = 'menu';
let selected: MapId = 'mall';
let opponents = 3;
let difficulties: Difficulty[] = ['normal','normal','normal'];
let seed = 2026;
let randomMap = false;
let paused = false;
let countdown = 0;
let match: Match;
let bots: AIController[] = [];
let config: MatchConfig;
let previousTime = performance.now();
let accumulator = 0;
let hudAt = 0;
let endAt = 0;
let resultsShown = false;
let lastTickSound = -1;
const dialog = $('#dialog') as HTMLDialogElement;
const displayNames = ['YOU / NOVA','PIXEL','BOLT','MISO'];
const tones = ['#ff855c','#62d4e7','#b6a1ff','#f9d56e'];
const difficultyOptions = (value: Difficulty) => ['easy','normal','hard','expert'].map(d=>`<option ${d === value ? 'selected' : ''} value="${d}">${d[0].toUpperCase()+d.slice(1)}</option>`).join('');
const mapMeta = () => MAPS.find(m=>m.id === selected)!;
const mechanicName = (id:MapId) => ({mall:'Conveyor walkways',airport:'Baggage express',jungle:'Living overgrowth',factory:'Steam vents',boat:'Ship rolling'})[id];
function applySettings() { audio.setVolumes(settings.musicMuted?0:settings.music,settings.sfxMuted?0:settings.sfx); renderer.setReducedMotion(settings.reducedMotion); $('.top-actions [data-action="sound"]').classList.toggle('muted',settings.musicMuted); saveSettings(settings); }
applySettings();
function freshSeed() { return crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000; }
function makeMatch(demo: boolean) {
  config = { mapId:selected, seed, opponents:demo?3:opponents, difficulties:[...difficulties] };
  match = new Match(config);
  bots = match.state.players.map((p,i)=>new AIController(demo ? (i===0?'hard':'normal') : difficulties[Math.max(0,i-1)],seed+i*193));
  if (demo) for (const p of match.state.players) p.human = false;
  human.reset(); accumulator = 0; endAt = 0; resultsShown = false;
}
function showMenu() { closeDialog(); screen='menu'; paused=false; countdown=0; makeMatch(true); audio.playTheme('menu'); renderScreen(); }
function showSetup() { closeDialog(); screen='setup'; paused=false; makeMatch(true); audio.playTheme(selected); renderScreen(); }
function startMatch(reuseSeed = false) {
  closeDialog();
  if (randomMap && !reuseSeed) selected = MAPS[freshSeed()%MAPS.length].id;
  screen='game'; paused=false; makeMatch(false); countdown=3; audio.playTheme(selected); audio.sfx('select'); renderScreen();
}
function avatar(index:number,small=false) { return `<span class="avatar ${small?'small':''} avatar-${index}" style="--character:${tones[index]}"><i></i><b></b></span>`; }
function renderScreen() {
  document.body.dataset.screen = screen;
  const meta = mapMeta();
  $('#stage-mode').textContent = screen==='game'?'MATCH IN PROGRESS':'LIVE ARENA / DEMO';
  $('#stage-label').textContent = `${meta.name.toUpperCase()} / ${meta.subtitle.toUpperCase()}`;
  if (screen==='menu') {
    $('#panel').innerHTML = `<div class="eyebrow"><span class="tiny-cross">✦</span> A LITTLE CHAOS. A LOT OF FUN.</div><h1>BLAST<br><span>ARENA<span class="title-period">.</span></span></h1><p class="hero-description">Small bombs. Big energy.<br>Outsmart your rivals. Own the arena.<br>Be the last little legend standing.</p><div class="hero-actions"><button class="button primary play-button" data-action="play">LET'S PLAY ${icon('arrow',23)}</button><button class="button secondary" data-action="help">HOW TO PLAY <span>?</span></button></div><div class="hero-meta"><span>${icon('bolt',16)} 5 ARENAS</span><i></i><span>1–3 AI RIVALS</span><i></i><span>PURE ARCADE</span></div><div class="menu-links"><button data-action="settings">SETTINGS</button><span>/</span><button data-action="credits">CREDITS</button></div><div class="player-note">${avatar(0,true)}<div><strong>MEET NOVA. THAT'S YOU.</strong><span>Big plans. Very small fuse.</span></div></div>`;
  } else if (screen==='setup') {
    $('#panel').innerHTML = `<button class="back-link" data-action="home">← BACK TO ARCADE</button><div class="eyebrow">MAKE SOME TROUBLE</div><h2>Your arena.<br><span>Your rules.</span></h2><p class="setup-description">Choose a world below. Pick your rivals.<br>Then make an explosive entrance.</p><div class="setup-row"><label for="opponents">AI RIVALS</label><div class="segmented">${[1,2,3].map(n=>`<button data-action="opponents" data-value="${n}" class="${opponents===n?'active':''}" aria-pressed="${opponents===n}">${n}</button>`).join('')}</div></div><div class="setup-row"><label for="global-difficulty">DIFFICULTY PRESET</label><select id="global-difficulty">${difficultyOptions(difficulties[0])}</select></div><div class="opponent-list">${Array.from({length:opponents},(_,i)=>`<div class="opponent-row">${avatar(i+1,true)}<span>${displayNames[i+1]}</span><select aria-label="${displayNames[i+1]} difficulty" data-ai="${i}">${difficultyOptions(difficulties[i])}</select></div>`).join('')}</div><div class="setup-row seed-row"><label for="seed">MAP SEED</label><input id="seed" type="number" min="0" max="4294967295" value="${seed}" aria-label="Map seed"><button class="icon-button" data-action="seed" aria-label="Generate random seed">${icon('shuffle',18)}</button></div><label class="check-row"><input type="checkbox" id="random-map" ${randomMap?'checked':''}> Surprise me with a random arena</label><button class="button primary" data-action="start">ENTER ARENA ${icon('arrow',22)}</button><div class="setup-tip">${icon('check',16)} No accounts. No loading screens. Just play.</div>`;
  } else {
    $('#panel').innerHTML = `<div class="eyebrow">${meta.name.toUpperCase()}</div><div class="match-title"><h2>Stay<br><span>dangerous.</span></h2><button class="icon-button" data-action="pause" aria-label="Pause game">${icon('pause',24)}</button></div><div class="match-clock"><span id="match-clock">00:00</span><div><span class="live-dot"></span><strong id="alive-count">${opponents+1} ALIVE</strong><small id="death-timer">SUDDEN DEATH IN 3:00</small></div></div><div id="players" class="player-list"></div><div id="abilities" class="abilities"></div><div class="map-tip"><span>FIELD NOTES</span><strong>${mechanicName(meta.id)}</strong><p>${meta.mechanic}</p></div><div class="touch-controls" aria-label="Touch controls"><div class="dpad"><button data-move="up" aria-label="Move up">↑</button><button data-move="left" aria-label="Move left">←</button><button data-move="down" aria-label="Move down">↓</button><button data-move="right" aria-label="Move right">→</button></div><button data-action="bomb" aria-label="Place bomb">${icon('bomb')}</button><button data-action="ability" aria-label="Use ability">E</button></div>`;
  }
  $('#map-strip').hidden = screen==='game';
  renderMaps(); updateHud();
}
function mapArt(id:MapId) {
  const meta = MAPS.find(m=>m.id===id)!;
  const palette = meta.colors;
  const extra:Record<MapId,string> = {
    mall:'<path d="M35 16h52l-5 17H40z" fill="#fc9979"/><path d="M103 15h55v30h-55z" fill="#6bd7c5"/><text x="130" y="35" font-family="monospace" font-size="12" text-anchor="middle" fill="#183638">OPEN</text><path d="M168 16h39v9h-39zm4 13h31v23h-31z" fill="#ad88c3"/>',
    airport:'<path d="M120 8v32m-24-17 24-8 24 8m-33 13 9-5 9 5" stroke="#c5eaff" stroke-width="4"/><rect x="28" y="18" width="52" height="22" fill="#22334e"/><path d="M34 24h36m-36 7h29" stroke="#f9d56e" stroke-width="2"/>',
    jungle:'<path d="m28 44 17-35 18 35zm147-2 15-37 19 37z" fill="#559e7d"/><path d="M95 45V19h45v26m-38-6V26h31v13" fill="#8d9e6e" stroke="#b7c58d" stroke-width="3"/>',
    factory:'<path d="M26 45V18h23v27m5-30h29v29h-29m107 0V9h19v36m7-20h28v19" fill="#8a7185"/><path d="M34 15V6m134-1V0M0 50h240" stroke="#e3aa64" stroke-width="4"/><path d="m103 13 16 28H87z" fill="#efbc67"/>',
    boat:'<path d="M0 33q10-9 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="#69bad1" stroke-width="3"/><path d="M165 14h38l-8 20h-23z" fill="#e5bba0"/><path d="M183 13V0l14 10z" fill="#fae2bb"/>',
  };
  return `<svg viewBox="0 0 240 112" class="map-art" aria-hidden="true"><rect width="240" height="112" fill="${palette.bg}"/>${extra[id]}<path d="m20 59 99-17 103 17-101 45z" fill="${palette.floor}" stroke="${palette.accent}" stroke-opacity=".4"/><path d="m53 53 103 34m-73-40 103 33m-69-37 103 30M46 71l101-24M78 83l101-26m-67 37 101-26" stroke="${palette.floorAlt}" stroke-width="2"/>${[0,1,2,3,4,5,6].map((_,i)=>`<path d="m${55+i%4*33} ${60+Math.floor(i/4)*16} 12-3 12 3v12l-12 4-12-4z" fill="${i%2?palette.block:palette.wall}" stroke="${palette.accent}" stroke-opacity=".3"/>`).join('')}</svg>`;
}
function renderMaps() {
  $('#map-strip').innerHTML = `<div class="section-label"><span>FIVE WORLDS. SAME BEAUTIFUL CHAOS.</span><span>CHOOSE YOUR ARENA ↘</span></div><div class="map-cards">${MAPS.map((m,i)=>`<button class="map-card ${m.id===selected?'selected':''}" data-action="map" data-map="${m.id}" aria-label="Select ${m.name}" aria-pressed="${m.id===selected}">${mapArt(m.id)}<span class="map-number">0${i+1}</span><span class="map-card-name">${m.name}<span class="map-selected">${m.id===selected?icon('check',16):icon('arrow',16)}</span></span><span class="map-card-feature">${mechanicName(m.id)}</span></button>`).join('')}</div><div class="map-music"><span>${icon('sound',14)} EVERY WORLD HAS ITS OWN ORIGINAL SOUNDTRACK.</span><button data-action="preview-music">PREVIEW ${mapMeta().name.toUpperCase()} ${icon('arrow',14)}</button></div>`;
}
function formatTime(time:number) { const seconds=Math.max(0,Math.floor(time)); return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`; }
function updateHud() {
  if (!match) return;
  const state=match.state;
  if (screen==='game') {
    $('#match-clock').textContent=formatTime(state.time);
    $('#alive-count').textContent=`${state.players.filter(p=>p.alive).length} ALIVE`;
    $('#death-timer').textContent=state.time>=state.suddenDeathAt?'SUDDEN DEATH':`SUDDEN DEATH IN ${formatTime(state.suddenDeathAt-state.time)}`;
    $('#players').innerHTML=state.players.map((p,i)=>`<div class="player-row ${!p.alive?'eliminated':''}">${avatar(i,true)}<div><strong>${displayNames[i]}</strong><span>${p.human?'LOCAL HERO':difficulties[i-1].toUpperCase()+' AI'}</span></div><span class="player-state">${p.alive?'IN':'OUT'}</span></div>`).join('');
    const p=state.players[0];
    const effects = [p.push?'PUSH':'',p.kick?'POWER KICK':'',p.shield?'SHIELD':'',p.invincibleUntil>state.time?`INVINCIBLE ${(p.invincibleUntil-state.time).toFixed(1)}s`:'',p.remoteUntil>state.time?`REMOTE ${Math.ceil(p.remoteUntil-state.time)}s`:'',p.rapidUntil>state.time?`RAPID ${Math.ceil(p.rapidUntil-state.time)}s`:'',p.portalCharges?`PORTAL ×${p.portalCharges}`:'',p.portalAnchor?'E: PLACE EXIT':''].filter(Boolean);
    $('#abilities').innerHTML=`<div class="ability-base"><div>${icon('bomb',21)}<strong>${p.capacity}</strong><span>BOMBS</span></div><div>${icon('bolt',21)}<strong>${p.range}</strong><span>RANGE</span></div><div><strong>${(p.speed/3.4).toFixed(1)}×</strong><span>SPEED</span></div></div><div class="effect-tags">${effects.map(e=>`<span>${e}</span>`).join('') || '<span class="no-upgrades">BREAK BLOCKS. FIND YOUR EDGE.</span>'}</div>`;
    $('#stage-bottom').innerHTML=`<span><span class="live-dot"></span> ${p.alive?'KEEP MOVING. STAY CLEVER.':'YOU’RE OUT. WATCH THE FINAL SHOWDOWN.'}</span><button data-action="help">FIELD GUIDE ↗</button>`;
  } else $('#stage-bottom').innerHTML=`<span><span class="live-dot"></span> REAL BOTS. REAL BOMBS. REAL BAD DECISIONS.</span><span class="demo-tag">WATCHING AI PLAY</span>`;
}
function toast(message:string) { $('#toast').textContent=message; $('#toast').classList.add('visible'); window.setTimeout(()=>$('#toast').classList.remove('visible'),3200); }
function showDialog(content:string,label:string) {
  human.reset();
  dialog.innerHTML=`<button class="dialog-close icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button>${content}`;
  dialog.setAttribute('aria-label',label);
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { if(dialog.open) dialog.close(); human.reset(); }
function pauseGame() { if(screen!=='game'||match.state.status==='finished') return; paused=true; human.reset(); showDialog(`<div class="eyebrow">TAKE A BREATHER</div><h2>Chaos can<br><span>wait.</span></h2><div class="dialog-buttons"><button class="button primary" data-action="resume">RESUME ${icon('arrow')}</button><button class="button secondary" data-action="restart">RESTART ROUND</button><button class="button secondary" data-action="settings">SETTINGS</button><button class="text-button" data-action="home">QUIT TO ARCADE</button></div>`,'Game paused'); }
function showSettings() {
  if(screen==='game'&&match.state.status==='playing') paused=true;
  showDialog(`<div class="eyebrow">TUNE YOUR ARCADE</div><h2>Good vibes.<br><span>Your volume.</span></h2><div class="settings-field"><label for="music-volume">MUSIC <output id="music-output">${Math.round(settings.music*100)}%</output></label><input id="music-volume" data-setting="music" type="range" min="0" max="1" step="0.01" value="${settings.music}"><label class="check-row"><input data-setting="musicMuted" type="checkbox" ${settings.musicMuted?'checked':''}> Mute music</label></div><div class="settings-field"><label for="sfx-volume">SOUND EFFECTS <output id="sfx-output">${Math.round(settings.sfx*100)}%</output></label><input id="sfx-volume" data-setting="sfx" type="range" min="0" max="1" step="0.01" value="${settings.sfx}"><label class="check-row"><input data-setting="sfxMuted" type="checkbox" ${settings.sfxMuted?'checked':''}> Mute sound effects</label></div><label class="check-row"><input data-setting="reducedMotion" type="checkbox" ${settings.reducedMotion?'checked':''}> Reduce motion, particles & camera shake</label><p class="dialog-note">Preferences save automatically on this browser.</p><button class="button primary" data-action="close">ALL SET ${icon('check')}</button>`,'Settings');
}
const powerHelp: [PowerUp,string,string,string][] = [
 ['bomb','B+','Extra Bomb','Carry one more active bomb, up to 6.'],['fire','F+','Fire Up','Extend each blast by one tile, up to 7.'],['speed','S+','Speed Up','Move faster, up to 1.5× base speed.'],['push','↔','Bomb Push','Walk into a bomb to send it sliding.'],['kick','K','Power Kick','Unlock a faster, longer bomb kick.'],['shield','◇','Shield','Absorb a blast and get a brief escape window.'],['invincible','★','Invincibility','Ignore explosion damage for 5 seconds.'],['remote','R','Remote Bomb','For 18 seconds, place remote bombs. E detonates yours; a safety fuse still runs.'],['rapid','!»','Rapid Fuse','For 16 seconds, new bombs have a shorter fuse.'],['portal','P','Portal Charge','Press E on two clear tiles to link them for 25 seconds. Place portals before detonating remotes.'],
];
function showHelp() {
  if(screen==='game'&&match.state.status==='playing') paused=true;
  showDialog(`<div class="eyebrow">THE FIELD GUIDE</div><h2>Make a blast.<br><span>Make an escape.</span></h2><p>Be the last survivor. Break blocks to open routes and uncover upgrades. Your bombs are just as dangerous to you.</p><div class="help-controls"><span><kbd>WASD / ↑↓←→</kbd> Move</span><span><kbd>SPACE</kbd> Place bomb</span><span><kbd>E</kbd> Portals / remote detonation</span><span><kbd>ESC</kbd> Pause</span></div><p class="help-callout">A standard bomb burns for 2.5 seconds, then blasts 2 tiles in a cross. Stone walls stop fire. A destroyed block stops that blast. Leave your bomb’s tile before the fuse runs out.</p><div class="power-guide">${powerHelp.map(([type,symbol,name,description])=>`<div><span class="power-symbol power-${type}">${symbol}</span><section><strong>${name}</strong><p>${description}</p></section></div>`).join('')}</div><p>Matching portals transport players and sliding bombs. Step off the exit to re-enter; flames do not travel through. Conveyor arrows carry you. Jungle plants warn before regrowing, factory vents flash before steaming, and the ship signals its roll before bombs shift.</p><p>After 3 minutes, warning tiles mark the next ring to close. Escape inward. A simultaneous final elimination is a draw.</p><button class="button primary" data-action="close">GOT IT ${icon('check')}</button>`,'How to play');
}
function showCredits() { showDialog(`<div class="eyebrow">MADE FOR THE ARCADE</div><h2>Original art.<br><span>Original chaos.</span></h2><p>BLAST ARENA is an original Bomberman-inspired browser game. All character designs, procedural pixel artwork, map illustrations, sound effects, and six synthesized compositions were created for this project.</p><p>Built with TypeScript, Phaser 3, Vite, and the Web Audio API. Phaser is released under the MIT license. No external images, recordings, accounts, or runtime services are required.</p><p class="dialog-note">Inspired by the joyful browser arcade era. No affiliation with Bomberman or its rights holders.</p><button class="button primary" data-action="close">BACK TO THE FUN ${icon('arrow')}</button>`,'Credits'); }
function showResults() {
  resultsShown=true;
  const s=match.state;
  const winner=s.winner===null?null:s.players.find(p=>p.id===s.winner);
  audio.sfx(winner?.id===0?'victory':'defeat');
  showDialog(`<div class="eyebrow">${winner?.id===0?'THAT’S HOW LEGENDS ARE MADE':'ONE MORE ROUND?'}</div><div class="result-trophy">${icon('trophy',48)}</div><h2>${winner?.id===0?'You brought':'The dust'}<br><span>${winner?.id===0?'the boom.':'has settled.'}</span></h2><p>${winner?`${winner.id===0?'NOVA':displayNames[winner.id]} is the last survivor.`:'Mutual destruction. This round is a draw.'} Round time: ${formatTime(s.time)}.</p><div class="results-table"><table><thead><tr><th>PLAYER</th><th title="Bombs placed">BOMB</th><th title="Blocks destroyed">BREAK</th><th title="Power-ups collected">UP</th><th title="Eliminations">KO</th><th title="Largest chain reaction">CHAIN</th><th>SURVIVED</th></tr></thead><tbody>${s.players.map(p=>`<tr class="${p.id===s.winner?'winner-row':''}"><th>${p.id===0?'YOU':displayNames[p.id]}</th><td>${p.stats.bombs}</td><td>${p.stats.blocks}</td><td>${p.stats.pickups}</td><td>${p.stats.kills}</td><td>${p.stats.largestChain}</td><td>${formatTime(p.stats.survival)}</td></tr>`).join('')}</tbody></table></div><div class="dialog-buttons"><button class="button primary" data-action="rematch">RUN IT BACK ${icon('arrow')}</button><button class="button secondary" data-action="setup">CHANGE ARENA</button><button class="text-button" data-action="home">BACK TO ARCADE</button></div>`,'Round results');
}
function handleAction(action:string,target:HTMLElement) {
  audio.sfx('select');
  switch(action) {
    case 'play': case 'setup': showSetup(); break;
    case 'home': showMenu(); break;
    case 'start': startMatch(); break;
    case 'rematch': seed=(seed+1)>>>0; startMatch(true); break;
    case 'restart': startMatch(true); break;
    case 'pause': pauseGame(); break;
    case 'resume': closeDialog(); paused=false; break;
    case 'settings': showSettings(); break;
    case 'help': showHelp(); break;
    case 'credits': showCredits(); break;
    case 'close': if(screen==='game'&&match.state.status==='finished') showSetup(); else { closeDialog(); paused=false; } break;
    case 'sound': settings.musicMuted=!settings.musicMuted; applySettings(); toast(settings.musicMuted?'Music muted. Sound effects stay on.':'Music on. Let’s make some noise.'); break;
    case 'opponents': opponents=Number(target.dataset.value); renderScreen(); break;
    case 'seed': seed=freshSeed(); makeMatch(true); renderScreen(); break;
    case 'map': selected=target.dataset.map as MapId; makeMatch(true); audio.playTheme(selected); renderScreen(); break;
    case 'preview-music': audio.playTheme(selected); toast(`Now playing: ${mapMeta().name}.`); break;
    case 'bomb': human.trigger('bomb'); break;
    case 'ability': human.trigger('ability'); break;
  }
}
document.addEventListener('click',event=> {
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if(target) handleAction(target.dataset.action!,target);
});
document.addEventListener('pointerover',event=> {
  const target=(event.target as HTMLElement).closest('button');
  if(target && !target.contains((event as PointerEvent).relatedTarget as Node|null)) audio.sfx('hover');
});
document.addEventListener('pointerdown',()=>{ void audio.unlock(); },{once:true});
document.addEventListener('keydown',()=>{ void audio.unlock(); },{once:true});
document.addEventListener('input',event=> {
  const target=event.target as HTMLInputElement;
  if(!target.dataset.setting) return;
  const key=target.dataset.setting;
  if(key==='music'||key==='sfx') { settings[key]=Number(target.value); $(`#${key}-output`).textContent=`${Math.round(settings[key]*100)}%`; }
  else if(key==='musicMuted'||key==='sfxMuted'||key==='reducedMotion') settings[key]=target.checked;
  applySettings();
});
document.addEventListener('change',event=> {
  const target=event.target as HTMLInputElement;
  if(target.id==='opponents') { opponents=Number(target.value); renderScreen(); }
  else if(target.id==='global-difficulty') { difficulties=[target.value,target.value,target.value] as Difficulty[]; renderScreen(); }
  else if(target.dataset.ai!==undefined) difficulties[Number(target.dataset.ai)]=target.value as Difficulty;
  else if(target.id==='seed') { const value=Number(target.value); seed=Number.isFinite(value)?Math.max(0,Math.min(4294967295,Math.floor(value))):2026; target.value=String(seed); makeMatch(true); }
  else if(target.id==='random-map') randomMap=target.checked;
});
document.addEventListener('keydown',event=> {
  if(event.code!=='Escape') return;
  event.preventDefault();
  if(dialog.open) { if(screen==='game'&&match.state.status==='finished') showSetup(); else { closeDialog(); paused=false; } }
  else if(screen==='game') pauseGame();
});
dialog.addEventListener('cancel',event=> { event.preventDefault(); if(screen==='game'&&match.state.status==='finished') showSetup(); else { closeDialog(); paused=false; } });
document.addEventListener('visibilitychange',()=> { if(document.hidden&&screen==='game'&&!paused&&match.state.status==='playing') pauseGame(); previousTime=performance.now(); accumulator=0; });
window.addEventListener('blur',()=>{ if(screen==='game'&&!paused&&match.state.status==='playing') pauseGame(); });
document.addEventListener('pointerdown',event=> {
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-move]');
  if(target) { event.preventDefault(); target.setPointerCapture(event.pointerId); human.touch(target.dataset.move as 'up'|'down'|'left'|'right'); }
});
document.addEventListener('pointerup',event=> { if((event.target as HTMLElement).closest('[data-move]')) human.touch(); });
document.addEventListener('pointercancel',()=>human.touch());
function tick(now:number) {
  const delta=Math.min(.15,(now-previousTime)/1000); previousTime=now;
  if(!paused) {
    if(screen==='game'&&countdown>0) {
      const before=Math.ceil(countdown); countdown=Math.max(0,countdown-delta);
      if(Math.ceil(countdown)!==before) audio.sfx(countdown>0?'countdown':'select');
    } else if(match.state.status==='playing') {
      accumulator+=delta;
      let steps=0;
      while(accumulator>=FIXED_DT&&steps++<9) {
        const actions:Record<number,Action>={};
        for(const p of match.state.players) if(p.alive) actions[p.id]=screen==='game'&&p.id===0?human.getAction(match.state,p.id):bots[p.id].getAction(match.state,p.id);
        match.step(actions);
        if(screen==='game') {
          for(const event of match.state.events) {
            if(event.type!=='victory') audio.sfx(event.type);
            if(event.type==='combo'&&(event.value??0)>1) toast(`CHAIN REACTION ×${event.value}`);
          }
          const fuseTick=Math.floor(match.state.time*3);
          if(match.state.bombs.some(b=>b.detonateAt-match.state.time<1)&&fuseTick!==lastTickSound) { audio.sfx('countdown'); lastTickSound=fuseTick; }
        }
        accumulator-=FIXED_DT;
      }
      if((match.state.status as string)==='finished') endAt=now;
    } else if(screen!=='game'&&now-endAt>2800) { makeMatch(true); }
    else if(screen==='game'&&!resultsShown&&now-endAt>2400) showResults();
  }
  audio.setIntensity(screen==='game'&&match.state.time>=match.state.suddenDeathAt);
  renderer.render(match.state,settings.reducedMotion?0:delta);
  const overlay=$('#arena-overlay');
  if(screen==='game'&&countdown>0) { overlay.hidden=false; overlay.innerHTML=`<span>GET READY</span><strong>${Math.ceil(countdown)}</strong><small>MAKE YOUR FIRST MOVE.</small>`; }
  else if(screen==='game'&&match.state.status==='finished'&&!resultsShown) { overlay.hidden=false; overlay.innerHTML=`<span>ROUND COMPLETE</span><strong class="winner-text">${match.state.winner===0?'NOVA WINS':match.state.winner===null?'DRAW':displayNames[match.state.winner]+' WINS'}</strong><small>THAT WAS A BLAST.</small>`; }
  else overlay.hidden=true;
  if(now-hudAt>120) { updateHud(); hudAt=now; }
  requestAnimationFrame(tick);
}
if(import.meta.env.DEV) {
  (window as unknown as { __BLAST__: { state:()=>unknown;screen:()=>string;paused:()=>boolean } }).__BLAST__={ state:()=>structuredClone(match.state),screen:()=>screen,paused:()=>paused };
}
showMenu();
requestAnimationFrame(tick);
window.addEventListener('beforeunload',()=>{ human.destroy(); renderer.destroy(); audio.destroy(); });



