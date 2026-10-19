import { Random } from '../../core/random';
import { createArena } from '../maps/maps';
import { CLASSES, PHYSICS, WEAPONS } from './config';
import { FIXED_DT, clamp, distance, type Action, type ClassId, type MatchConfig, type MatchState, type Soldier, type Team, type Vec, type WeaponId } from './types';
import { CombatSystem, killSoldier, weaponSlot } from './combat';
import { lineOfSight, moveSoldier, updateMovingPlatforms } from './physics';
import { EnvironmentSystem } from './environment';
import { updateMode } from './modes';

export { damageSoldier, killSoldier, muzzlePoint, weaponSlot } from './combat';
export { lineOfSight, raycastGeometry, rayRect, soldierBox } from './physics';

const CLASS_ORDER: ClassId[] = ['assault', 'support', 'defense', 'sniper'];
const CALLSIGNS = ['NOVA', 'ROOK', 'EMBER', 'ATLAS', 'FINCH', 'COBALT', 'LYNX', 'TALON', 'ECHO', 'ONYX', 'SABLE', 'VIPER', 'REED', 'FROST', 'KITE', 'SPARK'];
const initialWeather = () => ({ rain: 0, fog: 0, wind: 0, lighting: 1, floodY: Infinity });

export class ShooterMatch {
  readonly state: MatchState;
  private readonly random: Random;
  private readonly combat: CombatSystem;
  private environment: EnvironmentSystem;
  private readonly held = new Map<number, Action>();
  private nextLootId = 100000;

  constructor(config: MatchConfig) {
    const normalized: MatchConfig = { ...config, botCount: Math.floor(clamp(config.botCount, 3, 15)), scoreLimit: Math.max(1, Math.floor(config.scoreLimit)), rounds: config.rounds === 5 ? 5 : 3, timeLimit: Math.max(0, config.timeLimit) };
    this.random = new Random(config.seed);
    this.combat = new CombatSystem(this.random);
    this.environment = new EnvironmentSystem(this.random);
    const arena = createArena(config.mapId, config.seed);
    this.state = { config: normalized, tick: 0, time: 0, arena, soldiers: [], projectiles: [], tracers: [], loot: [], crates: [], stations: [],
      flags: arena.flagSpawns.map((point, id) => ({ ...point, id, label: ['A', 'B', 'C'][id]!, owner: null, capturing: null, progress: 0, contested: false })),
      scores: [0, 0], round: 1, roundWins: [0, 0], roundUntil: 0, roundStartTime: 0, phase: 'playing', winnerTeam: null, events: [], eventCycle: 0,
      environment: { name: 'ALL CLEAR', description: 'Environmental conditions stable.', warningUntil: 0, activeUntil: 0 }, weather: initialWeather() };
    for (let id = 0; id <= normalized.botCount; id++) this.state.soldiers.push(this.makeSoldier(id));
    this.resetCrates();
  }

  private makeSoldier(id: number): Soldier {
    const state = this.state, config = state.config;
    const classId = id === 0 ? config.humanClass : CLASS_ORDER[Math.floor(id / 2) % CLASS_ORDER.length]!;
    const definition = CLASSES[classId], team = (id % 2) as Team;
    const spawn = this.spawnPoint(team, id);
    return { ...spawn, id, name: CALLSIGNS[id]!, team, classId, human: id === 0 && config.human !== false,
      difficulty: id > 0 ? config.individualDifficulties?.[id - 1] ?? config.difficulty : config.difficulty,
      vx: 0, vy: 0, aim: team === 0 ? 0 : Math.PI, grounded: true, platformId: this.state.arena.platforms.find(p => p.active && Math.abs(p.y - spawn.y) < 2 && spawn.x >= p.x && spawn.x <= p.x + p.w)?.id ?? null,
      climbing: false, coyoteUntil: PHYSICS.coyote, jumpBufferUntil: -1, dropUntil: 0, health: definition.health, maxHealth: definition.health,
      alive: true, respawnAt: 0, protectedUntil: state.time + PHYSICS.spawnProtection, weapons: [weaponSlot(definition.primary), weaponSlot(definition.secondary)],
      activeWeapon: 0, grenades: classId === 'assault' ? 2 : 1, abilityReadyAt: state.time, abilityUntil: 0, shieldHealth: 0,
      lastDamageAt: -99, lastShotAt: -99, recoil: 0, hurtUntil: 0, deathAt: 0,
      stats: { kills: 0, deaths: 0, shots: 0, hits: 0, damage: 0, healing: 0, objective: 0, score: 0 } };
  }

  private spawnPoint(team: Team, id: number): Vec {
    const candidates = this.state.arena.spawns.filter(spawn => spawn.team === team);
    const fallback = candidates[id % candidates.length] ?? this.state.arena.spawns[0] ?? { x: 120, y: this.state.arena.height - 80 };
    if (this.state.time < 0.1) return { x: fallback.x, y: fallback.y };
    let best = fallback, bestScore = -Infinity;
    for (const point of candidates) {
      let score = 2000;
      for (const enemy of this.state.soldiers.filter(soldier => soldier.alive && soldier.team !== team)) {
        const range = distance(enemy, point);
        const exposed = range < 1000 && lineOfSight(this.state.arena, { x: point.x, y: point.y - 30 }, { x: enemy.x, y: enemy.y - 30 });
        score = Math.min(score, range - (exposed ? 450 : 0));
      }
      if (score > bestScore) { bestScore = score; best = point; }
    }
    return { x: best.x, y: best.y };
  }

  private randomWeapon(): WeaponId {
    const weapons = Object.values(WEAPONS);
    const weights = { common: 6, uncommon: 4, rare: 2, epic: 1 };
    let roll = this.random.next() * weapons.reduce((sum, weapon) => sum + weights[weapon.rarity], 0);
    for (const weapon of weapons) { roll -= weights[weapon.rarity]; if (roll < 0) return weapon.id; }
    return 'vanguard';
  }

  private resetCrates(): void {
    this.state.crates = this.state.arena.crateSpawns.map((point, id) => ({ ...point, id, weapon: this.randomWeapon(), readyAt: 0 }));
  }

  step(actions: Record<number, Action>, dt = FIXED_DT): void {
    const state = this.state;
    if (state.phase === 'finished' || !Number.isFinite(dt) || dt <= 0) return;
    state.events = [];
    const steps = Math.max(1, Math.ceil(dt / FIXED_DT - 1e-9));
    for (let i = 0; i < steps; i++) {
      this.advance(actions, dt / steps);
      if ((state.phase as MatchState['phase']) === 'finished') break;
    }
  }

  private advance(actions: Record<number, Action>, dt: number): void {
    const state = this.state;
    state.time += dt; state.tick++;
    state.tracers = state.tracers.filter(tracer => tracer.until > state.time);
    state.loot = state.loot.filter(loot => loot.until > state.time && (loot.ammo > 0 || !!loot.weapon));
    if (state.phase === 'round-over') { if (state.time >= state.roundUntil) this.startRound(); return; }
    for (const soldier of state.soldiers) {
      if (!soldier.alive && soldier.respawnAt <= state.time) {
        const stats = soldier.stats;
        Object.assign(soldier, this.makeSoldier(soldier.id)); soldier.stats = stats;
      }
    }
    this.environment.update(state, dt);
    updateMovingPlatforms(state);
    for (const soldier of state.soldiers) {
      if (!soldier.alive) continue;
      const action = actions[soldier.id] ?? {};
      if (Number.isFinite(action.aim)) soldier.aim = action.aim!;
      if (action.switchWeapon === 0 || action.switchWeapon === 1) soldier.activeWeapon = action.switchWeapon;
      const previous = this.held.get(soldier.id) ?? {};
      moveSoldier(state, soldier, action, dt, !!action.jump && !previous.jump);
      if (soldier.y > state.arena.height + 120) killSoldier(state, soldier);
    }
    for (const soldier of state.soldiers) {
      const action = actions[soldier.id] ?? {}, previous = this.held.get(soldier.id) ?? {};
      if (soldier.alive) {
        this.combat.updateSoldier(state, soldier, { ...action, ability: action.ability && !previous.ability, grenade: action.grenade && !previous.grenade });
        this.collectAmmo(soldier);
        if (action.interact && !previous.interact) this.interact(soldier);
      }
      this.held.set(soldier.id, { jump: !!action.jump, grenade: !!action.grenade, ability: !!action.ability, interact: !!action.interact });
    }
    this.combat.updateProjectiles(state, dt);
    this.combat.updateHealing(state, dt);
    updateMode(state, dt);
  }

  private collectAmmo(soldier: Soldier): void {
    const state = this.state;
    for (const loot of state.loot) {
      if (loot.ammo <= 0 || distance(loot, soldier) > 46 || (loot.weapon && !soldier.weapons.some(slot => slot.id === loot.weapon))) continue;
      const slots = [...soldier.weapons].sort((a, b) => (a.id === loot.weapon ? -1 : 0) - (b.id === loot.weapon ? -1 : 0));
      for (const slot of slots) {
        const added = Math.min(loot.ammo, WEAPONS[slot.id].reserve - slot.reserve);
        slot.reserve += added; loot.ammo -= added;
      }
    }
  }

  private replaceWeapon(soldier: Soldier, id: WeaponId, ammo?: number): void {
    const old = soldier.weapons[soldier.activeWeapon];
    if (old.ammo + old.reserve > 0) this.state.loot.push({ id: this.nextLootId++, x: soldier.x, y: soldier.y, weapon: old.id, ammo: old.ammo + old.reserve, until: this.state.time + 20 });
    const next = weaponSlot(id);
    if (ammo !== undefined) { next.ammo = Math.min(next.ammo, ammo); next.reserve = Math.min(WEAPONS[id].reserve, Math.max(0, ammo - next.ammo)); }
    soldier.weapons[soldier.activeWeapon] = next;
    if (this.state.loot.length > 64) this.state.loot.shift();
    this.state.events.push({ type: 'crate', x: soldier.x, y: soldier.y, soldierId: soldier.id, weapon: id });
  }

  private interact(soldier: Soldier): void {
    const crate = this.state.crates.find(item => item.readyAt <= this.state.time && distance(item, soldier) < 80);
    if (crate) {
      this.replaceWeapon(soldier, crate.weapon);
      crate.readyAt = this.state.config.mode === 'elimination' ? Infinity : this.state.time + 35;
      crate.weapon = this.randomWeapon();
      return;
    }
    const loot = this.state.loot.find(item => item.weapon && distance(item, soldier) < 70);
    if (loot?.weapon) {
      this.state.loot.splice(this.state.loot.indexOf(loot), 1);
      this.replaceWeapon(soldier, loot.weapon, loot.ammo);
    }
  }

  private startRound(): void {
    const state = this.state;
    state.round++; state.roundStartTime = state.time; state.phase = 'playing'; state.roundUntil = 0;
    state.arena = createArena(state.config.mapId, state.config.seed);
    state.projectiles = []; state.tracers = []; state.loot = []; state.stations = [];
    state.weather = initialWeather(); state.eventCycle = 0;
    state.environment = { name: 'ALL CLEAR', description: 'Environmental conditions stable.', warningUntil: 0, activeUntil: 0 };
    this.environment = new EnvironmentSystem(this.random); this.held.clear();
    for (const soldier of state.soldiers) { const stats = soldier.stats; Object.assign(soldier, this.makeSoldier(soldier.id)); soldier.stats = stats; }
    this.resetCrates();
    state.events.push({ type: 'round', x: state.arena.width / 2, y: 400, value: state.round });
  }
}

export const createShooterMatch = (config: MatchConfig): ShooterMatch => new ShooterMatch(config);
