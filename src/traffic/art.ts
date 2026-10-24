import type { Vehicle } from './core';

export const icons = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',
  hint: '<path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7M8 18h8m-7 4h6"/>',
  music: '<path d="M9 18V5l12-3v13M9 9l12-3"/><ellipse cx="5" cy="18" rx="4" ry="3"/><ellipse cx="17" cy="15" rx="4" ry="3"/>',
  next: '<path d="m5 5 10 7-10 7V5Zm14 0v14"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1"/>',
} as const;
export const icon = (name: keyof typeof icons): string => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

/** The entire illustration stays within its interactive vehicle's rectangle. */
export function vehicleArt(car: Vehicle): string {
  const w = car.length * 100, truck = car.length === 3;
  const drawing = `<g fill="#203c40"><rect x="28" y="3" width="34" height="16" rx="5"/><rect x="${w - 62}" y="3" width="34" height="16" rx="5"/><rect x="28" y="81" width="34" height="16" rx="5"/><rect x="${w - 62}" y="81" width="34" height="16" rx="5"/></g>
  <rect x="8" y="15" width="${w - 16}" height="79" rx="22" fill="#173338" opacity=".2"/>
  <rect x="8" y="8" width="${w - 16}" height="80" rx="22" fill="${car.color}"/>
  <path d="M30 13H${w - 29}q14 0 14 14v3H18v-3q0-14 12-14Z" fill="#fff" opacity=".22"/>
  <path d="M20 72h${w - 40}v4q0 8-12 8H32q-12 0-12-8Z" fill="#173338" opacity=".16"/>
  ${truck ? `<rect x="28" y="20" width="${w - 105}" height="53" rx="9" fill="#fff" opacity=".18"/><path d="M48 26v41m24-41v41m24-41v41m24-41v41m24-41v41" stroke="#173338" stroke-opacity=".12" stroke-width="4"/><path d="M${w - 78} 20v54" stroke="#173338" stroke-opacity=".18" stroke-width="3"/>` : `<rect x="59" y="19" width="${w - 119}" height="54" rx="15" fill="#fff" opacity=".2"/>`}
  <path d="M${w - 65} 22h26l8 11v26l-8 12h-26l6-16V38Z" fill="#244b57"/>
  <path d="M${w - 58} 26h16l5 7v12l-13 14Z" fill="#a7d9dc" opacity=".8"/>
  ${truck ? '' : '<path d="M40 22h15l-5 15v19l5 15H40l-9-12V34Z" fill="#315a63"/><path d="m37 34 6-7h6l-4 13v15l-8 9Z" fill="#a7d9dc" opacity=".45"/>'}
  <path d="M${w - 19} 25v12m0 22v12" stroke="#fff2be" stroke-width="7" stroke-linecap="round"/>
  <path d="M19 27v11m0 20v11" stroke="#9c413a" stroke-width="6" stroke-linecap="round"/>
  <rect x="${w - 88}" y="9" width="13" height="6" rx="3" fill="#28474c"/><rect x="${w - 88}" y="81" width="13" height="6" rx="3" fill="#28474c"/>
  ${car.target ? '<path d="M83 41h28m-9-9 10 9-10 10" fill="none" stroke="#fff4d6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' : `<text x="${truck ? w * .35 : w * .5}" y="52" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#fff" opacity=".65">${car.id}</text>`}`;
  return `<svg viewBox="0 0 ${car.axis === 'h' ? `${w} 100` : `100 ${w}`}" aria-hidden="true">${car.axis === 'v' ? `<g transform="translate(100 0) rotate(90)">${drawing}</g>` : drawing}</svg>`;
}

export function worldArt(world: 'city' | 'coast' | 'night'): string {
  const city = '<path d="M5 75V23h29v52m7 0V8h42v67m8 0V32h31v43m10 0V17h33v58" fill="#698b7b"/><path d="M13 33h12m-12 12h12m-12 12h12M51 21h21m-21 13h21m-21 13h21m-21 13h21m27-17h12m-12 13h12m30-27h14m-14 14h14m-14 14h14" stroke="#c1cfad" stroke-width="5"/><path d="M3 79h168" stroke="#3d6259" stroke-width="6"/>';
  const coast = '<circle cx="129" cy="25" r="19" fill="#e4bd73"/><path d="M5 64q31-20 62 0t62 0t62 0v24H5Z" fill="#86b9bb"/><path d="M4 76q23-9 46 0t46 0t46 0t46 0" fill="none" stroke="#d6e5d1" stroke-width="4"/><path d="M43 68V28m0 1Q14 8 7 35m36-6Q61 3 75 29M43 29Q21 26 17 51m26-22q25-1 26 22" stroke="#688a66" stroke-width="7" fill="none" stroke-linecap="round"/>';
  const night = '<circle cx="134" cy="20" r="16" fill="#e6cc97"/><path d="M139 3a17 17 0 0 0 13 27 18 18 0 1 1-13-27Z" fill="#d4bfc4"/><path d="M5 77V31h35v46m8 0V11h39v66m8 0V44h28v33m9 0V38h34v39" fill="#59637e"/><path d="M17 40v23m44-42v44m12-44v44m31-12h10m29-6h14m-14 13h14" stroke="#e4a8ab" stroke-width="4"/><path d="M5 81h162" stroke="#515574" stroke-width="4"/><g fill="#f1d3a5"><circle cx="20" cy="13" r="2"/><circle cx="105" cy="17" r="2"/><circle cx="163" cy="9" r="2"/></g>';
  return `<svg viewBox="0 0 175 90" aria-hidden="true">${world === 'city' ? city : world === 'coast' ? coast : night}</svg>`;
}
