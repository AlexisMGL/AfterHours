import type { CharacterId } from './types';

export type CharacterMood = 'neutral' | 'speaking' | 'happy' | 'thinking' | 'encouraging';

/** Original, code-native cast. No external illustrations, fonts or image assets. */
export function characterArt(id: CharacterId, mood: CharacterMood = 'neutral', size = 160): string {
  const lova = id === 'lova';
  const skin = lova ? '#a8653d' : '#d99267', shade = lova ? '#8d5030' : '#c77c54';
  const hair = lova ? '#263d37' : '#263b45', shirt = lova ? '#269b97' : '#ed785d';
  const celebrating = mood === 'happy', speaking = mood === 'speaking', thoughtful = mood === 'thinking';
  const face = celebrating || mood === 'encouraging'
    ? '<path d="M76 91q7-9 14 0m22 0q7-9 14 0" fill="none" stroke="#283832" stroke-width="3.3" stroke-linecap="round"/>'
    : `<g class="ma-character-eyes"><ellipse cx="83" cy="92" rx="6" ry="8" fill="#fff7e9"/><ellipse cx="118" cy="92" rx="6" ry="8" fill="#fff7e9"/><circle cx="${lova ? 85 : 81}" cy="93" r="3.2" fill="#263b33"/><circle cx="${lova ? 120 : 116}" cy="93" r="3.2" fill="#263b33"/></g>`;
  const mouth = celebrating
    ? '<path d="M86 112q15 26 30 0Z" fill="#643e32"/><path d="M89 114h24l-3 5H92Z" fill="#fff8df"/><path d="M94 128q7-7 14 0" fill="#e98a73"/>'
    : speaking
      ? '<ellipse cx="101" cy="117" rx="9" ry="11" fill="#6c4031"/><path d="M94 111h14v4H94Z" fill="#fff8e8"/><path d="M96 124q5-4 10 0" fill="#df8e7b"/>'
      : thoughtful
        ? '<path d="M94 119q8-5 15-1" fill="none" stroke="#6c4031" stroke-width="3" stroke-linecap="round"/>'
        : '<path d="M88 113q13 14 26-1" fill="none" stroke="#693f2e" stroke-width="3" stroke-linecap="round"/>';
  const brows = thoughtful
    ? '<path d="m75 77 15-2m20 6 14 3" stroke="#3b3f31" stroke-width="3.4" stroke-linecap="round"/>'
    : '<path d="M75 78q8-4 15 0m21 0q8-4 15 0" stroke="#3b3f31" stroke-width="3.3" stroke-linecap="round" fill="none"/>';
  const leftArm = celebrating
    ? `<g class="ma-character-arm ma-character-arm-up"><path d="M68 159Q40 153 29 120" fill="none" stroke="${shirt}" stroke-width="21" stroke-linecap="round"/><path d="m29 122-5-14m5 14 3-16m-3 16-10-5" fill="none" stroke="${skin}" stroke-width="10" stroke-linecap="round"/></g>`
    : `<g class="ma-character-arm"><path d="M67 161Q43 174 49 202" fill="none" stroke="${shirt}" stroke-width="21" stroke-linecap="round"/><ellipse cx="50" cy="204" rx="10" ry="12" fill="${skin}"/></g>`;
  const rightArm = celebrating || speaking
    ? `<g class="ma-character-wave"><path d="M133 159q25 4 31-29" fill="none" stroke="${shirt}" stroke-width="21" stroke-linecap="round"/><path d="m164 132 3-17m-3 17 10-12m-10 12 14-3" fill="none" stroke="${skin}" stroke-width="9" stroke-linecap="round"/></g>`
    : thoughtful
      ? `<path d="M134 163q12 19-15 21l-14-55" fill="none" stroke="${shirt}" stroke-width="19" stroke-linecap="round"/><path d="m105 131-4-10" stroke="${skin}" stroke-width="12" stroke-linecap="round"/>`
      : `<g class="ma-character-arm"><path d="M135 159q21 18 16 43" fill="none" stroke="${shirt}" stroke-width="21" stroke-linecap="round"/><ellipse cx="150" cy="204" rx="10" ry="12" fill="${skin}"/></g>`;
  const hairstyle = lova
    ? `<path d="M56 91Q37 38 70 32q29-33 67 1 29 7 10 60l-11-30q-21 13-58-2L65 90Z" fill="${hair}"/><g fill="${hair}"><circle cx="60" cy="55" r="16"/><circle cx="74" cy="37" r="17"/><circle cx="97" cy="29" r="17"/><circle cx="122" cy="35" r="17"/><circle cx="140" cy="52" r="17"/></g><path d="M61 46q14-23 33-19m16 3q13-1 23 14" fill="none" stroke="#3a5144" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M52 105Q34 39 72 27q36-17 66 14 22 21 10 72l-19-13-6-44Q87 82 67 69l-7 41Z" fill="${hair}"/><path d="M60 55q8-30 43-26" fill="none" stroke="#3f535a" stroke-width="7" stroke-linecap="round"/><path d="m128 47 5 25" stroke="#ecbb79" stroke-width="5" stroke-linecap="round"/>`;
  return `<svg class="ma-character ma-character-${id} ma-character-${mood}" width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 200 250" role="img" aria-label="${lova ? 'Lova' : 'Mia'}${celebrating ? ', enthousiaste' : speaking ? ', parle' : thoughtful ? ', réfléchit' : ', sourit'}"><ellipse cx="101" cy="237" rx="48" ry="8" fill="#254c4320"/><g class="ma-character-body">${!lova ? '<path d="M59 150q-16-9-18 17v39q10 16 29 7l5-47Z" fill="#8fbca8" stroke="#659783" stroke-width="3"/>' : ''}<path d="m75 199-5 31h22l9-25 9 25h23l-7-31Z" fill="#35505b"/><path d="m70 228-10 5q-5 7 5 8h28v-13Zm40 0v13h30q9-1 2-8l-10-5Z" fill="#f6e2b9"/><path d="M67 149q32-12 66 0l6 58q-36 12-76 0Z" fill="${shirt}"/><path d="M73 149q9 25 28 27 19-4 28-27" fill="${lova ? '#69c7b7' : '#f6ad83'}"/><path d="M87 131h26v21q-13 14-26 0Z" fill="${shade}"/>${leftArm}${rightArm}${lova ? '<path d="m122 146-38 63" stroke="#f2b757" stroke-width="8"/><rect x="68" y="184" width="31" height="26" rx="8" fill="#e9a74e" stroke="#c88a36" stroke-width="2"/><path d="M74 190h18" stroke="#fff0ba" stroke-width="2" stroke-linecap="round"/>' : '<path d="m69 149-8 39m68-38 9 34" stroke="#6a9e89" stroke-width="7" stroke-linecap="round"/><path d="M84 196h33" stroke="#f4b596" stroke-width="3" stroke-linecap="round"/>'}<ellipse cx="60" cy="97" rx="10" ry="14" fill="${skin}"/><ellipse cx="141" cy="97" rx="10" ry="14" fill="${skin}"/><path d="M60 75q0-37 40-37t41 37v29q-3 38-41 39-35-1-40-39Z" fill="${skin}"/><path d="M63 107q3 28 22 30" fill="none" stroke="${shade}" stroke-width="4" stroke-linecap="round" opacity=".45"/>${hairstyle}${brows}${face}<path d="m101 94-4 13q4 3 9 0" fill="none" stroke="${shade}" stroke-width="2.6" stroke-linecap="round"/>${mouth}<ellipse cx="74" cy="107" rx="7" ry="4" fill="${lova ? '#d17c58' : '#ed9b82'}" opacity=".55"/><ellipse cx="128" cy="107" rx="7" ry="4" fill="${lova ? '#d17c58' : '#ed9b82'}" opacity=".55"/>${!lova ? '<circle cx="143" cy="111" r="4" fill="#edbc66"/>' : ''}</g></svg>`;
}
