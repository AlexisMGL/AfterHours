import { Random } from '../../core/random';
import { buildNavigation } from '../maps/maps';
import { clamp, type HazardZone, type MatchState, type Platform, type Vec } from './types';
import { damageSoldier } from './combat';
import { overlaps, soldierBox } from './physics';

const EVENT_NAMES = {
  aircraft: ['TURBULENCE / RAMP ALERT', 'Cabin pressure is falling near the cargo ramp. Brace for turbulence and damaged service paths.'],
  factory: ['PRESSURE SURGE / POWER FAILURE', 'Vents are charging. Emergency lighting and the lift circuits remain operational.'],
  forest: ['STORM FRONT / FALLING TIMBER', 'Rain and fog are moving in. Marked timber falls into new cover; avoid the wildfire zone.'],
  city: ['STRUCTURAL ALERT / BLACKOUT', 'A damaged optional walkway is collapsing. Main ladders and objective routes remain open.'],
  harbor: ['CRANE DELIVERY / HIGH WINDS', 'The cargo crane is moving cover. Keep the marked container delivery lane clear.'],
  ship: ['STORM SURGE / FLOOD WARNING', 'The ship is rolling. Lower compartments flood gradually; move to higher decks.'],
} as const;

/** Events alter authoritative geometry and hazards; effects read the same warning times. */
export class EnvironmentSystem {
  private activatedCycle = 0;
  private nextPlatformId = 10000;
  private temporary: { id: number; until: number }[] = [];
  private readonly lootVelocity = new Map<number, number>();
  constructor(private readonly random: Random) {}

  private floor(state: MatchState): number {
    return Math.max(...state.arena.platforms.filter(p => p.active && !p.oneWay && p.w > state.arena.width * 0.5).map(p => p.y), state.arena.height - 80);
  }

  private clearSite(state: MatchState, x: number, y: number, width: number, height: number): boolean {
    const rect = { x, y, w: width, h: height };
    return !state.soldiers.some(s => s.alive && overlaps(soldierBox(s), rect))
      && !state.arena.platforms.some(p => p.active && !p.oneWay && overlaps(p, rect))
      && !state.arena.ladders.some(l => overlaps({ x: l.x - 50, y: l.y, w: l.w + 100, h: l.h }, rect))
      && !state.flags.some(f => Math.abs(f.x - (x + width / 2)) < 180 && Math.abs(f.y - (y + height)) < 130)
      && !state.arena.spawns.some(s => Math.abs(s.x - (x + width / 2)) < 250);
  }

  private addCover(state: MatchState, preferred: number, width: number, height: number, material: Platform['material'], moving = false): void {
    const floor = this.floor(state);
    const candidates = [preferred, preferred + 240, preferred - 240, preferred + 480, preferred - 480];
    const y = moving ? floor - 320 : floor - height;
    const actualHeight = moving ? 70 : height;
    const x = candidates.find(candidate => candidate > 200 && candidate + width < state.arena.width - 200
      && this.clearSite(state, candidate, y, width, actualHeight));
    if (x === undefined) return;
    const platform: Platform = { id: this.nextPlatformId++, x, y, w: width, h: actualHeight, material, oneWay: false, active: true, hp: moving ? undefined : 160 };
    if (moving) {
      platform.y = floor - 320; platform.h = 70;
      platform.moving = { axis: 'x', from: x - 220, to: x + 480, period: 20, phase: 0 };
    }
    state.arena.platforms.push(platform);
    this.temporary.push({ id: platform.id, until: state.time + (moving ? 45 : 32) });
    state.arena.nav = buildNavigation(state.arena);
  }

  private collapseOptional(state: MatchState): void {
    const candidates = state.arena.platforms.filter(p => p.active && p.hp !== undefined && p.id < 10000 && p.w < 500
      && !state.flags.some(f => Math.abs(f.y - p.y) < 70 && f.x >= p.x - 120 && f.x <= p.x + p.w + 120)
      && !state.arena.ladders.some(l => overlaps({ x: l.x - 35, y: l.y, w: l.w + 70, h: l.h }, p)));
    if (!candidates.length) return;
    const platform = candidates[this.random.int(candidates.length)]!;
    platform.active = false;
    for (const soldier of state.soldiers) if (soldier.platformId === platform.id) { soldier.grounded = false; soldier.platformId = null; }
    state.arena.nav = buildNavigation(state.arena);
  }

  private warnings(state: MatchState, starts: number, ends: number): void {
    const floor = this.floor(state), width = state.arena.width;
    const hazard = (zone: Omit<HazardZone, 'starts'|'ends'>): void => { state.arena.hazards.push({ ...zone, starts, ends }); };
    if (state.arena.id === 'factory') {
      for (const x of [width * 0.31, width * 0.69]) hazard({ x, y: floor - 110, w: 170, h: 110, kind: 'steam', damage: 18 });
    } else if (state.arena.id === 'forest') {
      hazard({ x: width * 0.61, y: floor - 90, w: 180, h: 90, kind: 'fire', damage: 12 });
    } else if (state.arena.id === 'aircraft') {
      hazard({ x: width - 620, y: floor - 230, w: 420, h: 230, kind: 'wind', damage: 6 });
    } else if (state.arena.id === 'harbor') {
      // A zero-damage zone still exposes the delivery footprint during warning.
      hazard({ x: width * 0.64, y: floor - 95, w: 175, h: 95, kind: 'wind', damage: 0 });
    }
    state.events.push({ type: 'warning', x: width / 2, y: floor - 200, value: 3 });
  }

  update(state: MatchState, dt: number): void {
    const interval = state.config.eventFrequency === 'reduced' ? 120 : 60;
    const elapsed = state.time - state.roundStartTime;
    const cycle = Math.floor((elapsed + 3) / interval);
    if (cycle > state.eventCycle) {
      state.eventCycle = cycle;
      const starts = state.roundStartTime + cycle * interval;
      const [name, description] = EVENT_NAMES[state.arena.id];
      state.environment = { name, description, warningUntil: starts, activeUntil: starts + 18 };
      this.warnings(state, starts, starts + 18);
    }
    if (state.eventCycle > this.activatedCycle && state.time >= state.environment.warningUntil) {
      this.activatedCycle = state.eventCycle;
      if (state.arena.id === 'aircraft' || state.arena.id === 'city') this.collapseOptional(state);
      if (state.arena.id === 'forest') this.addCover(state, state.arena.width * 0.45, 220, 85, 'wood');
      if (state.arena.id === 'city') this.addCover(state, state.arena.width * 0.47, 170, 35, 'stone');
      if (state.arena.id === 'harbor') {
        this.addCover(state, state.arena.width * 0.42, 200, 85, 'metal', true);
        this.addCover(state, state.arena.width * 0.64, 175, 95, 'metal');
      }
    }
    const active = state.eventCycle > 0 && state.time >= state.environment.warningUntil && state.time < state.environment.activeUntil;
    const weather = state.weather;
    weather.wind = active ? state.arena.id === 'aircraft' ? Math.sin(state.time * 4.3) * 55
      : state.arena.id === 'ship' ? Math.sin(state.time * 1.6) * 75
        : state.arena.id === 'harbor' ? 35 + Math.sin(state.time) * 25 : 0 : 0;
    weather.lighting = active && (state.arena.id === 'factory' || state.arena.id === 'city') ? 0.48 : active && state.arena.id === 'aircraft' ? 0.72 : 1;
    weather.rain = (state.arena.id === 'forest' || state.arena.id === 'harbor') ? active ? 0.8 : 0.12 : 0;
    weather.fog = state.arena.id === 'forest' ? active ? 0.3 : 0.08 : active && state.arena.id === 'city' ? 0.12 : 0;
    if (state.arena.id === 'ship') {
      weather.rain = clamp(elapsed / 210, 0.15, 0.95);
      weather.fog = 0.08 + weather.rain * 0.1;
      if (state.eventCycle > 0 && state.time >= state.environment.warningUntil) {
        weather.floodY = Math.max(this.floor(state) - 150, this.floor(state) + 50 - (elapsed - interval) * 2.4);
      }
      if (Math.floor(elapsed) % 17 === 0 && elapsed % 1 < 0.13) weather.lighting = 1.35;
    }
    for (const soldier of state.soldiers) {
      if (!soldier.alive) continue;
      for (const hazard of state.arena.hazards) {
        if (hazard.starts <= state.time && hazard.ends > state.time && overlaps(soldierBox(soldier), hazard)) {
          damageSoldier(state, soldier, hazard.damage * dt, -1, hazard, 'environment');
          if (hazard.kind === 'wind' && hazard.damage > 0) soldier.vx += 180 * dt;
        }
      }
      if (soldier.y > weather.floodY + 28) damageSoldier(state, soldier, 8 * dt, -1, { x: soldier.x, y: weather.floodY }, 'environment');
    }
    state.arena.hazards = state.arena.hazards.filter(h => h.ends > state.time);
    let changed = false;
    for (const temporary of this.temporary) {
      if (temporary.until > state.time) continue;
      const platform = state.arena.platforms.find(p => p.id === temporary.id);
      if (!platform?.active) continue;
      if (state.soldiers.some(s => s.alive && s.platformId === platform.id)) { temporary.until = state.time + 3; continue; }
      platform.active = false; changed = true;
    }
    this.temporary = this.temporary.filter(t => t.until > state.time);
    if (changed) {
      state.arena.platforms = state.arena.platforms.filter(p => p.id < 10000 || p.active);
      state.arena.nav = buildNavigation(state.arena);
    }
    this.moveLoot(state, dt);
  }

  private moveLoot(state: MatchState, dt: number): void {
    for (const loot of state.loot) {
      let velocity = Math.min(600, (this.lootVelocity.get(loot.id) ?? 0) + 1500 * dt);
      const oldY = loot.y;
      loot.y += velocity * dt;
      let belt = 0;
      for (const platform of state.arena.platforms) {
        if (platform.active && loot.x >= platform.x && loot.x <= platform.x + platform.w && oldY <= platform.y + 1 && loot.y >= platform.y) {
          loot.y = platform.y; velocity = 0; belt = platform.conveyor ?? 0;
        }
      }
      loot.x = clamp(loot.x + (belt + state.weather.wind * 0.25) * dt, 20, state.arena.width - 20);
      this.lootVelocity.set(loot.id, velocity);
    }
    const ids = new Set(state.loot.map(loot => loot.id));
    for (const id of this.lootVelocity.keys()) if (!ids.has(id)) this.lootVelocity.delete(id);
  }
}
