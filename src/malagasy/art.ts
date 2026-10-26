/** Original vector artwork: no third-party image requests or media licenses. */
export function townArt(): string {
  const windows = (x: number, y: number, count: number, color = '#efd9b0') => Array.from({ length: count }, (_, i) => `<rect x="${x + i * 21}" y="${y}" width="10" height="17" rx="1" fill="${color}"/>`).join('');
  const house = (x: number, y: number, w: number, h: number, color: string) => `<g><path d="M${x} ${y}h${w}v${h}h-${w}z" fill="${color}"/><path d="m${x - 7} ${y} ${w / 2 + 7} -28 ${w / 2 + 7} 28z" fill="#8c4938"/><rect x="${x + w / 2 - 7}" y="${y + h - 26}" width="14" height="26" fill="#705647"/>${windows(x + 9, y + 12, Math.max(1, Math.floor((w - 10) / 21)))}</g>`;
  return `<svg viewBox="0 0 640 440" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration originale des collines et maisons d’Antananarivo"><defs><linearGradient id="ma-sky" x2="0" y2="1"><stop stop-color="#e9bd8c"/><stop offset="1" stop-color="#f5dfb6"/></linearGradient><pattern id="ma-fields" width="31" height="18" patternUnits="userSpaceOnUse"><path d="M0 16h31" stroke="#fcf0c2" stroke-width="1" opacity=".25"/></pattern></defs><rect width="640" height="440" fill="url(#ma-sky)"/><circle cx="468" cy="116" r="62" fill="#faedc7"/><path d="M-20 256Q77 121 185 208T398 211T667 160V440H0" fill="#b5b292"/><path d="M0 274Q104 202 191 243T377 232T640 213V440H0" fill="#8b9a7c"/><path d="M0 326Q170 262 308 270T640 280V440H0" fill="#647d67"/><path d="M0 374Q149 305 300 337T640 322V440H0" fill="#436a58"/><path d="M-10 400Q133 339 316 368T662 360V460H0" fill="#315546"/><path d="M0 329Q163 281 351 307T640 287" fill="none" stroke="#ead7ac" stroke-width="12"/><path d="M246 440Q364 380 311 336T312 290" fill="none" stroke="#d7b482" stroke-width="26"/><g opacity=".7"><path d="M2 371q90-34 171-22m-161 47q106-35 193-21m213-44q86-4 201-32m-177 56q83-9 189-29" stroke="#a8b787" stroke-width="2" fill="none"/></g><g>${house(317, 168, 75, 87, '#c48c65')}${house(398, 211, 57, 60, '#e3bc85')}${house(233, 232, 64, 48, '#d6a47b')}${house(134, 263, 66, 51, '#e5c292')}${house(470, 249, 71, 62, '#c88e67')}${house(67, 308, 55, 58, '#d9b17e')}${house(354, 290, 69, 57, '#e1b37e')}</g><g fill="#345446"><path d="m547 323 15-76 17 76z"/><rect x="560" y="305" width="4" height="40"/><path d="m196 342 14-70 17 70z"/><rect x="209" y="321" width="4" height="44"/><path d="m19 321 13-56 13 56z"/><rect x="30" y="306" width="4" height="34"/></g><path d="M337 168v-29h34v29m-27-29v-18h20v18m-11-18v-20" stroke="#805b45" stroke-width="3" fill="#c9aa80"/><path d="m76 105 10-5 11 5m20 27 8-5 9 5" fill="none" stroke="#725f4d" stroke-width="2" stroke-linecap="round"/><g fill="#fae7bb" opacity=".6"><ellipse cx="128" cy="155" rx="56" ry="3"/><ellipse cx="532" cy="69" rx="43" ry="3"/></g><rect x="481" y="372" width="127" height="35" rx="4" fill="#f7ebcd" transform="rotate(-5 540 390)"/><text x="544" y="394" text-anchor="middle" fill="#46604b" font-size="11" font-family="monospace" letter-spacing="2" transform="rotate(-5 540 390)">18.88° S · 47.51° E</text></svg>`;
}

export function icon(name: string, size = 20): string {
  const paths: Record<string, string> = {
    path: '<path d="M4 6h6a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12"/><circle cx="4" cy="6" r="2"/><path d="m17 19 3 3-3 3"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
    review: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/><path d="M12 8v5l3 2"/>',
    book: '<path d="M12 5Q6 1 3 4v15q4-2 9 1 5-3 9-1V4q-3-3-9 1v15"/>',
    stats: '<path d="M4 20h16M6 16v-4M12 16V5M18 16V9"/>',
    source: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    save: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    leaf: '<path d="M20 3Q2 2 4 15q8 9 16-12ZM5 19 15 9"/>',
    flame: '<path d="M12 3q0 6 5 7l1-4q8 14-6 16C0 20 4 10 8 7l1 6q4-3 3-10Z"/>',
    star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    sound: '<path d="m3 10 4 0 5-5v14l-5-5H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.compass}</svg>`;
}
