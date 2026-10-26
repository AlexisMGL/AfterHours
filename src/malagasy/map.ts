import coastline from './madagascar-coast.json';
import type { World } from './types';

export { MAP_SOURCES } from './map-sources';

type Point = [number, number];
/** Natural Earth coordinates are [longitude, latitude]; public APIs take [latitude, longitude]. */
export const COAST_RINGS: number[][][] = coastline.geometry.coordinates.map(polygon => polygon[0]);
const LONGITUDE_FACTOR = Math.cos(18.5 * Math.PI / 180);
const SCALE = 41.25;
const WEST = 42.8, NORTH = -11.5;
/** Local equirectangular projection, shared by coast, islands, routes and city anchors. */
export function projectCoordinates(latitude: number, longitude: number): Point {
  return [101 + (longitude - WEST) * LONGITUDE_FACTOR * SCALE, 68 + (NORTH - latitude) * SCALE];
}
const fixed = (number: number): string => number.toFixed(2);
export const COAST_PATH = COAST_RINGS.map(ring => ring.map(([longitude, latitude], i) => {
  const [x, y] = projectCoordinates(latitude, longitude);
  return `${i ? 'L' : 'M'}${fixed(x)},${fixed(y)}`;
}).join('') + 'Z').join('');
const esc = (value: string | number): string => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Leader lines retain the actual location when two curriculum stops share one city. */
export function markerPosition(world: World): { anchor: Point; marker: Point } {
  const anchor = projectCoordinates(...world.coordinates);
  const displacement: Record<number, Point> = { 7: [17, 11], 15: [-30, -16], 19: [42, 20] };
  const [dx, dy] = displacement[world.number] ?? [0, 0];
  return { anchor, marker: [anchor[0] + dx, anchor[1] + dy] };
}

function palm(x: number, y: number, scale = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="ma-map-palm"><path d="M0 17Q5 6 2-7" fill="none" stroke="#a1814b" stroke-width="3.5"/><path d="M2-7Q-8-18-18-9Q-5-11 1-5M2-7Q13-20 21-10Q9-11 3-5M2-7Q4-24-6-23Q0-17 1-6M2-7Q-11-8-12 1Q-3-6 2-5M2-7Q15-6 16 2Q8-4 2-5" fill="#548a62" stroke="#548a62" stroke-width="1.2" stroke-linecap="round"/></g>`;
}
function ridge(x: number, y: number, scale = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="ma-map-ridge"><path d="m-14 10 14-24 16 24Z" fill="#a9b775"/><path d="M0-14 16 10H2Z" fill="#92a866"/><path d="m-5-5 5-9 6 9-6-3Z" fill="#e1deb6"/></g>`;
}
function coastDecorations(): string {
  return `<g clip-path="url(#ma-real-land-clip)"><path d="M377 134Q327 208 301 320T235 566" fill="none" stroke="#d2c88f" stroke-width="72" opacity=".38"/><path d="M391 148Q356 245 326 335T285 495" fill="none" stroke="#7da775" stroke-width="35" opacity=".45"/><path d="M275 355q-34 7-48 39t-16 95" fill="none" stroke="#ead9aa" stroke-width="24" opacity=".45"/>${ridge(323, 198, .8)}${ridge(291, 274, .95)}${ridge(280, 298, .75)}${ridge(252, 380, 1)}${ridge(228, 441, .9)}${ridge(204, 512, .8)}${palm(356, 219, .8)}${palm(332, 283, .65)}${palm(300, 402, .75)}${palm(263, 525, .8)}${palm(178, 482, .7)}${palm(229, 227, .75)}<path d="M264 371q-15 21-17 42t-22 43M295 289q-14 11-17 35" fill="none" stroke="#86b4a7" stroke-width="2" opacity=".8"/></g>`;
}
function marker(world: World): string {
  const { anchor: [ax, ay], marker: [x, y] } = markerPosition(world), isOpen = world.implemented;
  const displaced = ax !== x || ay !== y;
  const label = `${world.number}. ${world.name} — ${world.subtitle}${isOpen ? ', explorer' : ', destination en préparation'}`;
  return `<g class="ma-map-stop ${isOpen ? 'is-open' : 'is-planned'}" role="button" tabindex="0" data-world="${esc(world.id)}" aria-label="${esc(label)}"><title>${esc(label)}</title>${displaced ? `<path class="ma-map-leader" d="M${fixed(ax)} ${fixed(ay)}L${fixed(x)} ${fixed(y)}"/><circle class="ma-map-anchor" cx="${fixed(ax)}" cy="${fixed(ay)}" r="2.5"/>` : ''}<circle class="ma-map-target" cx="${fixed(x)}" cy="${fixed(y)}" r="21"/>${isOpen ? `<circle class="ma-map-current-halo" cx="${fixed(x)}" cy="${fixed(y)}" r="21"/>` : ''}<circle class="ma-map-stop-shadow" cx="${fixed(x)}" cy="${fixed(y + 3)}" r="${isOpen ? 16 : 10}"/><circle class="ma-map-stop-dot" cx="${fixed(x)}" cy="${fixed(y)}" r="${isOpen ? 16 : 10}"/><text class="ma-map-stop-number" x="${fixed(x)}" y="${fixed(y + .5)}">${String(world.number).padStart(2, '0')}</text></g>`;
}
function geographicLabel(latitude: number, longitude: number, title: string, dx: number, dy: number, direction: 'start' | 'end' = 'start', emphasis = false): string {
  const [x, y] = projectCoordinates(latitude, longitude);
  return `<g class="ma-map-city-label ${emphasis ? 'is-capital' : ''}" aria-hidden="true"><path d="M${fixed(x)} ${fixed(y)}l${dx > 0 ? dx - 6 : dx + 6} ${dy}"/><text x="${fixed(x + dx)}" y="${fixed(y + dy + 3)}" text-anchor="${direction}">${esc(title)}</text></g>`;
}

export function renderWorldMap(worlds: World[]): string {
  const first = worlds.find(world => world.number === 1), finalWorld = worlds.find(world => world.number === 20);
  const route = [1, 2, 3, 4, 5].map(number => worlds.find(world => world.number === number)).filter((world): world is World => !!world);
  const routePath = route.map((world, i) => { const [x, y] = projectCoordinates(...world.coordinates); return `${i ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`; }).join('');
  return `<section class="ma-journey-map" aria-label="Carte interactive de Madagascar"><div class="ma-map-heading"><span>LE GRAND VOYAGE</span><strong>Madagascar</strong><small>Une île, vingt rencontres.</small></div><svg class="ma-real-map" viewBox="0 0 520 735" role="group" aria-label="Destinations du parcours sur la côte réelle de Madagascar"><defs><linearGradient id="ma-map-sea" x2="0" y2="1"><stop stop-color="#d6eeea"/><stop offset="1" stop-color="#bfe2dc"/></linearGradient><linearGradient id="ma-map-land" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#d6d99a"/><stop offset=".55" stop-color="#bed092"/><stop offset="1" stop-color="#9fbd83"/></linearGradient><pattern id="ma-map-water" width="49" height="46" patternUnits="userSpaceOnUse"><path d="M9 21q6-4 12 0t12 0" fill="none" stroke="#88beb4" stroke-opacity=".24" stroke-width="1" stroke-linecap="round"/></pattern><clipPath id="ma-real-land-clip"><path d="${COAST_PATH}"/></clipPath></defs><rect width="520" height="735" rx="21" fill="url(#ma-map-sea)"/><rect width="520" height="735" rx="21" fill="url(#ma-map-water)"/><path class="ma-map-shallows" d="${COAST_PATH}" transform="translate(1 4)"/><path class="ma-map-coast-shadow" d="${COAST_PATH}" transform="translate(1 6)"/><path class="ma-map-land" d="${COAST_PATH}" fill="url(#ma-map-land)"/>${coastDecorations()}<path d="${routePath}" class="ma-map-itinerary"/><g class="ma-map-ocean-label" aria-hidden="true"><text x="423" y="415" transform="rotate(-73 423 415)">OCÉAN INDIEN</text><text x="84" y="333" transform="rotate(-73 84 333)">CANAL DU MOZAMBIQUE</text></g><g class="ma-map-compass" transform="translate(453 92)" aria-hidden="true"><circle r="25"/><path d="M0-18 6 4 0 0-6 4Z"/><path d="M0 18-6-4 0 0 6-4Z"/><text y="-34">N</text><path d="M-33 0h14M19 0h14"/></g><g aria-hidden="true">${geographicLabel(-12.28, 49.29, 'Antsiranana', -22, -25, 'end')}${geographicLabel(-13.33, 48.25, 'Nosy Be', -27, -2, 'end')}${geographicLabel(-15.72, 46.32, 'Mahajanga', -29, 3, 'end')}${geographicLabel(-18.15, 49.40, 'Toamasina', 25, 2)}${geographicLabel(-20.28, 44.28, 'Morondava', -27, -5, 'end')}${geographicLabel(-23.35, 43.67, 'Toliara', -27, -1, 'end')}${geographicLabel(-25.03, 46.99, 'Tôlanaro', -23, 22, 'end')}</g>${worlds.filter(world => world.number !== 1 && world.number !== 20).map(marker).join('')}${first ? marker(first) : ''}<g class="ma-map-capital-callout" aria-hidden="true"><path d="M${fixed(projectCoordinates(-18.91, 47.53)[0] - 16)} ${fixed(projectCoordinates(-18.91, 47.53)[1])}H143q-8 0-8-8v-23"/><rect x="21" y="297" width="173" height="47" rx="9"/><text x="35" y="316">VOUS COMMENCEZ ICI</text><text x="35" y="333">Antananarivo</text></g>${finalWorld ? `<g class="ma-map-finale" data-world="${esc(finalWorld.id)}" role="button" tabindex="0" aria-label="20. Madagascar — Le grand voyage, destination en préparation"><rect x="316" y="638" width="179" height="67" rx="12"/><circle cx="339" cy="661" r="12"/><text class="ma-map-finale-number" x="339" y="662">20</text><text class="ma-map-finale-title" x="359" y="663">Le grand voyage</text><text class="ma-map-finale-caption" x="331" y="687">Tout Madagascar · à venir</text><title>Monde 20 : une aventure sur toute l’île</title></g>` : ''}<g class="ma-map-sailboat" transform="translate(435 526) rotate(9)" aria-hidden="true"><path d="m-16 14 32 0-6 8H-9Z" fill="#af7860"/><path d="M0 11V-22L-16 8Z" fill="#fff4d9"/><path d="M3-13 17 9H3Z" fill="#e7a078"/><path d="M-23 29q10-4 20 0t20 0" stroke="#79b2a5" stroke-width="2" fill="none"/></g></svg><div class="ma-map-bottom"><span><i></i>Votre première escale</span><span><i></i>À découvrir plus tard</span></div><p class="ma-map-instruction">Touchez une escale pour découvrir son programme.</p></section>`;
}

export function miniIslandArt(): string {
  return `<svg viewBox="0 0 520 735" aria-hidden="true"><path d="${COAST_PATH}" fill="#c1d59a" stroke="#83a775" stroke-width="3"/><path d="M320 181Q282 298 240 492" fill="none" stroke="#9dbb84" stroke-width="26" opacity=".6"/><circle cx="${projectCoordinates(-18.91, 47.53)[0]}" cy="${projectCoordinates(-18.91, 47.53)[1]}" r="14" fill="#dc8052" stroke="#f5edd3" stroke-width="5"/></svg>`;
}
