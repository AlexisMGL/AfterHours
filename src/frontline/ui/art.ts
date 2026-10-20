import type { ClassId, MapId } from '../core/types';
export function soldierArt(classId:ClassId='assault',color='#779988',suffix='hero'):string {
 const defense=classId==='defense',sniper=classId==='sniper',support=classId==='support';
 const accent=support?'#71e0be':sniper?'#bbadf2':defense?'#f3bd6c':'#8eddf0';
 return `<svg viewBox="0 0 440 420" xmlns="http://www.w3.org/2000/svg" class="soldier-art" role="img" aria-label="${classId} cartoon soldier illustration"><defs>
 <linearGradient id="armor-${suffix}" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#b7d3c9"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="#304c53"/></linearGradient>
 <linearGradient id="cloth-${suffix}" x2=".7" y2="1"><stop stop-color="#59737c"/><stop offset="1" stop-color="#253d50"/></linearGradient>
 <linearGradient id="skin-${suffix}" x2=".85" y2="1"><stop stop-color="#ffe1b4"/><stop offset=".6" stop-color="#e6aa7c"/><stop offset="1" stop-color="#bb7455"/></linearGradient>
 <linearGradient id="glass-${suffix}" x2=".8" y2="1"><stop stop-color="#d1f6f7"/><stop offset=".4" stop-color="#7ccee2"/><stop offset="1" stop-color="#307c9c"/></linearGradient>
 <linearGradient id="gun-${suffix}" x2=".2" y2="1"><stop stop-color="#708896"/><stop offset=".5" stop-color="#354c60"/><stop offset="1" stop-color="#1b2d41"/></linearGradient>
 </defs><ellipse cx="230" cy="388" rx="134" ry="16" fill="#102b38" opacity=".18"/>
 <g stroke="#203746" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
 <path d="m177 175-29 10q-12 42-1 86l34 12 17-63z" fill="#556c64"/><path d="m150 201 22 6m-24 11 24 7m-24 14 22 7" stroke="#93a899" stroke-width="3"/>
 <path d="m184 260-8 59-16 42 40 10 22-43 15-58m1 5 11 49 20 39 39-15-19-47-10-43" fill="url(#cloth-${suffix})"/>
 <path d="m179 302 28 8-7 28-30-7zm78 5 28-8 9 28-29 10z" fill="${color}"/>
 <path d="m179 309 20 6-4 13m72-13 13-4 4 13" fill="none" stroke="#b9c6bb" stroke-width="2.5"/>
 <path d="m160 354-16 18q-10 17 7 17h47l10-11-9-19zm109-2-2 22 11 13h52q10-7-2-16l-22-17" fill="#263747"/>
 <path d="m146 381 48 1m84-3 47 1m-161-15 26 5m-29 2 25 5m92-14 23-2m-22 10 28-3" fill="none" stroke="#83959b" stroke-width="3"/>
 <path d="M185 166q40-12 85 6l15 100q-41 28-101 1l-11-83z" fill="url(#cloth-${suffix})"/>
 <path d="m190 169 20-2-5 37-24 56-8-54m84-35-19-4 2 39 28 60 14-47" fill="#8fa092"/>
 <path d="m199 188 48-1 21 24-2 45q-31 12-70-1l-6-42z" fill="url(#armor-${suffix})"/>
 <path d="m203 201 38-2 14 14-4 13-46 2-9-13z" fill="#d4dec6" opacity=".32" stroke-width="2"/>
 <path d="m194 240 21-1 1 25-21-1zm26-1h21l2 26-22 1zm26-2 18-2 3 25-19 4z" fill="#728c81" stroke-width="3"/>
 <path d="m201 243 9-1m18 1h8m16-2 7-1" stroke="#cad3bb" stroke-width="2.5"/>
 <path d="m185 267q47 17 89-2l2 15q-45 17-91 0z" fill="#233a43"/><rect x="222" y="270" width="20" height="15" rx="3" fill="#b1b5a0" stroke-width="3"/>
 <path d="m193 163 7-26 47-2 8 32-27 19z" fill="url(#skin-${suffix})"/><path d="m199 149 46-7 1 17-29 10z" fill="#ad775d" stroke="none"/>
 <path d="M188 84q9-28 40-24 36-1 39 32l-1 34-16 27q-14 15-33 6l-22-17-12-23z" fill="url(#skin-${suffix})"/>
 <path d="m254 112 14 11-15 5m-38 12q15 8 28-2" fill="none" stroke="#a16c55" stroke-width="3"/>
 <path d="m209 112 16-3m18-3 12 1" stroke="#674e45" stroke-width="4"/><ellipse cx="219" cy="119" rx="3" ry="4" fill="#243d49" stroke="none"/><ellipse cx="249" cy="116" rx="3" ry="4" fill="#243d49" stroke="none"/>
 <path d="M176 94q-5-58 47-65 53-5 61 54l-17 21-66 4z" fill="url(#armor-${suffix})"/>
 <path d="M190 72q13-30 40-28m-35 37 20-7m31-37 12 24" stroke="#d6e3ce" opacity=".65" stroke-width="3.5" fill="none"/>
 <path d="m178 84 100-7 5 16-103 15z" fill="#344c5a"/><path d="m200 83 48-4 14 4-6 19-48 5-12-7z" fill="url(#glass-${suffix})" stroke-width="3"/>
 <path d="m210 86-5 12m19-13-6 14" stroke="#edfcf3" opacity=".9" stroke-width="3"/>
 <rect x="172" y="99" width="20" height="34" rx="9" fill="#3c5663"/><rect x="177" y="105" width="10" height="20" rx="4" fill="${accent}" stroke-width="2"/>
 <path d="m181 132 7 13 18 4" fill="none" stroke-width="3"/><ellipse cx="209" cy="150" rx="6" ry="4" fill="#31414b" stroke-width="2"/>
 <path d="M183 180q-25-1-34 26l-7 33q0 13 14 17l34 4 9-23-28-9 10-20 17-17" fill="url(#cloth-${suffix})"/>
 <path d="m152 197 22 5-4 20-26-3z" fill="url(#armor-${suffix})"/><path d="m152 208 14 4" stroke="${accent}" stroke-width="4"/>
 <path d="m269 177 24 16 20 29 35-15 12 23-53 25q-12 4-20-9l-33-37" fill="url(#cloth-${suffix})"/>
 <path d="m270 181 19 14-13 21-19-14z" fill="url(#armor-${suffix})"/><path d="m299 224 12 15m-150-2 21 8" stroke="#8faaa6" stroke-width="3"/>
 <path d="m184 231 90-20 38 4 14 22-45 10-8 28-22 2 2-31-54 12-18-2z" fill="url(#gun-${suffix})"/>
 <path d="m305 216 83-10 9 8-3 10-77 11" fill="#4e6878"/><path d="m389 204 18 1 2 19-16 2" fill="#273f51"/>
 <path d="m203 228 74-13 10 10-80 16z" fill="#a3b3b4" stroke-width="2.5"/><path d="m224 215 4-13 29-5 7 13" fill="#435b65"/><path d="m232 204 17-3" stroke="${accent}" stroke-width="3"/>
 <path d="m293 229 15-2m9-2 15-2m9-1 15-2m-136 29 11-2 1 9-11 3z" stroke="#c6d0c5" stroke-width="2.5"/>
 <path d="m176 240 13-5 18 6 1 13-13 10-20-9z" fill="#394f5b"/><path d="m183 241 8 8 10-2" stroke="#90a7a2" stroke-width="2.5"/>
 <path d="m339 209 8-11 17 2 11 13-15 20-19-3z" fill="#3b5361"/><path d="m352 202 9 9m-15-5 9 10m-12-2 8 10" stroke="#a2b1a8" stroke-width="2.5"/>
 ${defense?'<path d="m115 188-49 28-1 112 55 29 37-31-9-113z" fill="#386a82"/><path d="m80 232 44-8 7 33-50 7z" fill="#9cdeec"/><path d="m82 283 44-7m-41 19 43-7m-42 20 40-6" stroke="#8fc4d4" stroke-width="4"/><path d="m75 220 5-3m53 108 5-5" stroke="#e1e1bd" stroke-width="6"/>':''}
 ${support?'<path d="m249 178 21 4-3 23-20-4z" fill="#d7f0d9" stroke-width="2.5"/><path d="m258 185-1 12m-5-7 12 2" stroke="#308e78" stroke-width="4"/>':''}
 ${sniper?'<path d="m179 70 13-32q31-15 57-1l29 36-22 5-24-24-30 15z" fill="#7c8c72" stroke-width="3"/><path d="m282 202 22-3 3 10-23 4" fill="#314b60"/><path d="m287 201 11-1" stroke="#9ee7de" stroke-width="3"/>':''}
 </g><path d="m213 40 19-1 3 7-18 3z" fill="#d6debc"/><circle cx="251" cy="192" r="2" fill="${accent}"/>
 </svg>`;
}
export const shortMapNames:Record<MapId,string>={aircraft:'Cargo aircraft',factory:'Factory',forest:'Forest',city:'City',harbor:'Harbor',ship:'Ship'};
export function battlefieldArt(id:MapId):string {
 const colors:Record<MapId,[string,string,string]>={aircraft:['#263d57','#678ca1','#c2dce1'],factory:['#2f343b','#6e6155','#e3a36c'],forest:['#263f38','#638272','#bbd2a5'],city:['#3a404b','#737986','#e3b887'],harbor:['#294450','#6c919a','#dec08a'],ship:['#25394b','#5d7b93','#abd5d8']};
 const [sky,near,light]=colors[id];
 if(id==='aircraft')return `<svg viewBox="0 0 500 240" aria-hidden="true"><defs><linearGradient id="cargo-preview" x2="0" y2="1"><stop stop-color="#345c79"/><stop offset="1" stop-color="#172b42"/></linearGradient></defs><rect width="500" height="240" fill="url(#cargo-preview)"/><path d="M5 22h56v175H5zM425 40h85v143h-85z" fill="#91c9de"/><path d="M4 130q25-25 56-8m365 0q38-30 82-11" stroke="#e5f3e6" stroke-width="26"/><path d="M0 200Q4-34 250 4q241 17 250 196" fill="none" stroke="#6c90a5" stroke-width="16"/>
 ${[78,165,250,337,416].map((x,i)=>`<path d="M${x} 202V${22+i%2*12}q15-12 30-8" fill="none" stroke="#a3bac1" stroke-opacity=".55" stroke-width="7"/>`).join('')}
 <path d="M62 40h328m-328 9h328" stroke="#e4ac5e" stroke-width="3"/><path d="M115 76h53m60 0h52m60 0h52" stroke="#c8f0e2" stroke-width="5"/>
 <path d="M0 218h500M45 156h156m30-31h149m17 31h103" stroke="#a6c2ca" stroke-width="8"/>
 <path d="M44 164h150m41-31h137m26 31h102" stroke="#3c6075" stroke-width="6"/>
 <g stroke="#233d55" stroke-width="3"><rect x="80" y="171" width="79" height="42" rx="4" fill="#d68650"/><path d="M91 177v30m13-30v30m14-30v30m14-30v30m14-30v30" stroke="#f0b66c"/><rect x="167" y="184" width="49" height="29" rx="3" fill="#58a9b3"/><path d="m175 187 32 22m-1-22-32 22" stroke="#9dd1cf"/>
 <rect x="242" y="82" width="54" height="38" rx="4" fill="#547faa"/><path d="m252 86 2 31m24-31 2 31" stroke="#acd1dc"/>
 <rect x="326" y="179" width="35" height="33" rx="6" fill="#cb6260"/><path d="M327 188h32m-32 16h32" stroke="#efbb86"/>
 <rect x="381" y="178" width="49" height="35" rx="4" fill="#6fada0"/><path d="M406 183v19m-10-9h19" stroke="#e3ead8" stroke-width="5"/>
 <path d="M61 216v-59m0 12h20m-20 14h20m-20 14h20m0 19v-59M305 215v-86m0 16h19m-19 15h19m-19 15h19m-19 15h19m0 25v-86" fill="none" stroke="#c2b780" stroke-width="3"/></g>
 <path d="m218 47 1 23h43V47" fill="#22394a" stroke="#78969f" stroke-width="2"/><path d="M226 57h25" stroke="#8ce8cf" stroke-width="3"/>
 <path d="M0 225h500" stroke="#172a3e" stroke-width="10"/><path d="M0 226h500" stroke="#e5b567" stroke-dasharray="16 12" stroke-width="3"/><path d="M222 159v-30m0 0 25 5-25 9" stroke="#8ae1d1" stroke-width="3" fill="#8ae1d1"/></svg>`;
 let scenery='';
 if(id==='forest')scenery=Array.from({length:9},(_,i)=>`<path d="M${i*57-10} 190V${60+i%3*15}l30-45 30 45v130" fill="${near}" opacity="${.35+i%3*.2}"/><path d="m${i*57+8} 200 8-107h9l10 107" fill="#233c32"/>`).join('');
 else scenery=Array.from({length:8},(_,i)=>`<path d="M${i*72-10} 200v-${60+i%3*40}h${50+i%2*12}v${60+i%3*40}" fill="${near}" opacity="${.3+i%3*.2}"/><path d="M${i*72} 160h20m-20-17h20m-20-17h20" stroke="${light}" opacity=".25" stroke-width="5"/>`).join('');
 if(id==='harbor')scenery+='<path d="M380 190V10h90m-80 0-55 90m46-80 48 80m-2-80v100" stroke="#a2b6b2" fill="none" stroke-width="6"/>';
 if(id==='ship')scenery+='<path d="m65 195 12-42h225l32 42m-175-42V70h114v83m-70-83V45h58v25" fill="#4d6a7b" stroke="#b1c3bf" stroke-width="4"/><path d="M12 220q15-10 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" fill="none" stroke="#89b6bf" stroke-width="3"/>';
 return `<svg viewBox="0 0 500 240" aria-hidden="true"><rect width="500" height="240" fill="${sky}"/><circle cx="394" cy="47" r="37" fill="${light}" opacity=".13"/>${scenery}<path d="M0 221h500M30 165h150m62-38h139m17 38h102" stroke="${light}" stroke-width="9"/><path d="M75 220v-55m0 15h25m-25 14h25m-25 14h25m0 12v-55M283 220v-90m0 12h24m-24 14h24m-24 14h24m-24 14h24m-24 14h24m0 22v-90" stroke="${near}" stroke-width="5"/><g fill="${light}"><rect x="142" y="190" width="48" height="28" rx="3"/><rect x="340" y="191" width="60" height="29" rx="3"/><path d="m211 162 5-17h10l7 17v25h-22z"/></g><path d="M220 148v-27m0 0 27 5-27 8" stroke="#82d1bd" stroke-width="3" fill="#82d1bd"/></svg>`;
}
