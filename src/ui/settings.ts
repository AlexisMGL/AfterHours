export interface Settings { music: number; sfx: number; musicMuted: boolean; sfxMuted: boolean; reducedMotion: boolean }
const defaults: Settings = { music:.35,sfx:.65,musicMuted:false,sfxMuted:false,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches };
export function loadSettings(): Settings {
  try {
    const data: unknown = JSON.parse(localStorage.getItem('blast-arena-settings') ?? '{}');
    if (typeof data !== 'object' || data === null) return { ...defaults };
    const value = data as Partial<Settings>;
    return { music:volume(value.music,defaults.music),sfx:volume(value.sfx,defaults.sfx),musicMuted:value.musicMuted === true,sfxMuted:value.sfxMuted === true,reducedMotion:typeof value.reducedMotion === 'boolean' ? value.reducedMotion : defaults.reducedMotion };
  } catch { return { ...defaults }; }
}
function volume(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1,value)) : fallback; }
export function saveSettings(settings: Settings) { try { localStorage.setItem('blast-arena-settings',JSON.stringify(settings)); } catch { /* Preferences remain usable when browser storage is unavailable. */ } }
