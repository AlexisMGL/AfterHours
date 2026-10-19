import { createArena } from '../maps/maps';
import { FIXED_DT, cellKey, sameCell, tileAt, type Action, type Bomb, type MatchConfig, type MatchState, type Player, type PowerUp } from './types';
import { GAMEPLAY } from './tuning';
import { clearBombExitPermissions, moveBomb, movePlayer, portalDestination, validBombPortalExit, validPlayerPortalExit } from './physics';
import { hasPortalEscape } from './portals';
import { damagePlayers, resolveExplosions } from './explosions';
import { updateEnvironment, updateSuddenDeath } from './environment';

export { canOccupy } from './physics';
export { explosionTiles } from './explosions';

export function applyPowerUp(state: MatchState, player: Player, type: PowerUp): void {
  switch (type) {
    case 'bomb': player.capacity = Math.min(GAMEPLAY.maxBombs, player.capacity + 1); break;
    case 'fire': player.range = Math.min(GAMEPLAY.maxRange, player.range + 1); break;
    case 'speed': player.speed = Math.min(GAMEPLAY.maxSpeed, player.speed + 0.28); break;
    case 'push': player.push = true; break;
    case 'kick': player.kick = true; player.push = true; break;
    case 'shield': player.shield = true; break;
    case 'invincible': player.invincibleUntil = Math.max(player.invincibleUntil, state.time + GAMEPLAY.invincibilityDuration); break;
    case 'remote': player.remoteUntil = state.time + GAMEPLAY.remoteDuration; break;
    case 'rapid': player.rapidUntil = state.time + GAMEPLAY.rapidDuration; break;
    case 'portal': player.portalCharges = Math.min(3, player.portalCharges + 1); break;
  }
  player.stats.pickups++;
  state.events.push({ type: 'pickup', x: player.x, y: player.y, player: player.id, powerUp: type });
}

/** Authoritative, fixed-step rules. Rendering and controller implementations are independent. */
export class Match {
  readonly state: MatchState;
  private nextBombId = 1;
  private nextPortalId = 1000;
  private readonly playerPortalLocks = new Map<number, string>();
  private readonly bombPortalLocks = new Map<number, string>();
  private readonly abilityHeld = new Set<number>();

  constructor(config: MatchConfig) {
    const arena = createArena(config.mapId, config.seed);
    const names = ['NOVA', 'PIXEL', 'BOLT', 'MISO'];
    const colors = ['#ff855c', '#62d4e7', '#b6a1ff', '#f9d56e'];
    const players: Player[] = arena.spawns.slice(0, Math.max(2, Math.min(4, Math.floor(config.opponents) + 1))).map((spawn, id) => ({
      ...spawn, id, name: names[id]!, color: colors[id]!, alive: true, human: id === 0, facing: 'down',
      capacity: 1, range: 2, speed: GAMEPLAY.baseSpeed, push: false, kick: false, shield: false,
      invincibleUntil: 0, remoteUntil: 0, rapidUntil: 0, portalCharges: 0, portalCooldown: 0,
      stats: { bombs: 0, blocks: 0, pickups: 0, kills: 0, largestChain: 0, survival: 0 },
    }));
    this.state = {
      tick: 0, time: 0, seed: config.seed, arena, players, bombs: [], flames: [], pickups: [],
      portals: arena.portals.map(portal => ({ ...portal, a: { ...portal.a }, b: { ...portal.b } })),
      regrowth: [], events: [], status: 'playing', winner: null,
      suddenDeathAt: config.suddenDeathAt ?? GAMEPLAY.suddenDeath,
      closingTiles: [], closingAt: 0, closedRing: 0,
    };
  }

  step(actions: Record<number, Action>, dt = FIXED_DT): void {
    if (this.state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.state.events = [];
    // A caller may fast-forward tests without tunnelling or missing fuse boundaries.
    const steps = Math.max(1, Math.ceil(dt / FIXED_DT - 1e-9));
    const stepSize = dt / steps;
    for (let step = 0; step < steps && this.state.status === 'playing'; step++) this.advance(actions, stepSize);
  }

  private advance(actions: Record<number, Action>, dt: number): void {
    const state = this.state;
    const previousTime = state.time;
    state.time += dt;
    state.tick++;
    state.flames = state.flames.filter(flame => flame.until > state.time + 1e-7);
    state.portals = state.portals.filter(portal => portal.until > state.time);
    clearBombExitPermissions(state);
    for (const player of state.players) {
      if (!player.alive) continue;
      player.stats.survival = state.time;
      const action = actions[player.id] ?? {};
      if (action.move) movePlayer(state, player, action.move, player.speed * dt);
      if (action.bomb) this.placeBomb(player);
      if (action.ability && !this.abilityHeld.has(player.id)) this.useAbility(player);
      if (action.ability) this.abilityHeld.add(player.id);
      else this.abilityHeld.delete(player.id);
    }
    updateEnvironment(state, previousTime, dt);
    for (const bomb of state.bombs) {
      moveBomb(state, bomb, dt);
      this.teleportBomb(bomb);
    }
    for (const player of state.players) {
      if (!player.alive) continue;
      this.teleportPlayer(player);
      const pickup = state.pickups.find(item => item.revealedAt <= state.time && sameCell(item, player));
      if (pickup) {
        state.pickups.splice(state.pickups.indexOf(pickup), 1);
        applyPowerUp(state, player, pickup.type);
      }
    }
    clearBombExitPermissions(state);
    resolveExplosions(state);
    damagePlayers(state);
    updateSuddenDeath(state, previousTime);
    const survivors = state.players.filter(player => player.alive);
    if (survivors.length <= 1) {
      state.status = 'finished';
      state.winner = survivors[0]?.id ?? null;
      const winner = survivors[0];
      state.events.push({ type: 'victory', x: winner?.x ?? 7, y: winner?.y ?? 7, player: winner?.id });
    }
  }

  private placeBomb(player: Player): void {
    const state = this.state;
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    if (tileAt(state.arena, x, y) !== 'floor' || state.bombs.some(b => sameCell(b, { x, y }))
      || state.bombs.filter(b => b.owner === player.id).length >= player.capacity) return;
    const remote = player.remoteUntil > state.time;
    state.bombs.push({
      id: this.nextBombId++, owner: player.id, x, y, range: player.range,
      // Remote bombs retain an automatic safety fuse, so an eliminated owner cannot soft-lock a round.
      detonateAt: state.time + (remote ? Math.min(8, Math.max(GAMEPLAY.bombFuse, player.remoteUntil - state.time))
        : player.rapidUntil > state.time ? GAMEPLAY.rapidFuse : GAMEPLAY.bombFuse),
      remote, slideSpeed: 0, slideRemaining: 0, portalCooldown: 0,
      passThrough: state.players.filter(p => p.alive && Math.abs(p.x - x) < 0.5 + GAMEPLAY.playerRadius
        && Math.abs(p.y - y) < 0.5 + GAMEPLAY.playerRadius).map(p => p.id),
    });
    player.stats.bombs++;
    state.events.push({ type: 'bomb', x, y, player: player.id });
  }

  private useAbility(player: Player): void {
    const state = this.state;
    if (player.portalCharges > 0) {
      const point = { x: Math.round(player.x), y: Math.round(player.y) };
      if (!hasPortalEscape(state.arena, point)
        || state.bombs.some(bomb => sameCell(bomb, point))
        || state.portals.some(portal => sameCell(portal.a, point) || sameCell(portal.b, point))) return;
      if (!player.portalAnchor) {
        player.portalAnchor = point;
        state.events.push({ type: 'teleport', ...point, player: player.id, value: 0 });
      } else if (!sameCell(player.portalAnchor, point) && hasPortalEscape(state.arena, player.portalAnchor)) {
        state.portals.push({ id: this.nextPortalId++, a: player.portalAnchor, b: point, until: state.time + GAMEPLAY.portalDuration });
        player.portalAnchor = undefined;
        player.portalCharges--;
        // Creating an exit underfoot should not immediately teleport the player away.
        this.playerPortalLocks.set(player.id, cellKey(point.x, point.y));
        state.events.push({ type: 'teleport', ...point, player: player.id, value: 1 });
      } else if (!hasPortalEscape(state.arena, player.portalAnchor)) player.portalAnchor = point;
      return;
    }
    for (const bomb of state.bombs) if (bomb.owner === player.id && bomb.remote) bomb.detonateAt = state.time;
  }

  private teleportPlayer(player: Player): void {
    const state = this.state;
    const destination = portalDestination(state, player);
    const key = cellKey(player.x, player.y);
    if (!destination) { this.playerPortalLocks.delete(player.id); return; }
    if (this.playerPortalLocks.get(player.id) === key || player.portalCooldown > state.time
      || Math.abs(player.x - Math.round(player.x)) > 0.28 || Math.abs(player.y - Math.round(player.y)) > 0.28) return;
    if (!validPlayerPortalExit(state, player, destination)) return;
    player.x = destination.x; player.y = destination.y;
    player.portalCooldown = state.time + GAMEPLAY.portalCooldown;
    this.playerPortalLocks.set(player.id, cellKey(player.x, player.y));
    state.events.push({ type: 'teleport', x: player.x, y: player.y, player: player.id });
  }

  private teleportBomb(bomb: Bomb): void {
    const state = this.state;
    const destination = portalDestination(state, bomb);
    const key = cellKey(bomb.x, bomb.y);
    if (!destination) { this.bombPortalLocks.delete(bomb.id); return; }
    if (this.bombPortalLocks.get(bomb.id) === key || bomb.portalCooldown > state.time
      || Math.abs(bomb.x - Math.round(bomb.x)) > 0.12 || Math.abs(bomb.y - Math.round(bomb.y)) > 0.12) return;
    if (!validBombPortalExit(state, bomb, destination)) return;
    bomb.x = destination.x; bomb.y = destination.y;
    bomb.portalCooldown = state.time + GAMEPLAY.portalCooldown;
    this.bombPortalLocks.set(bomb.id, cellKey(bomb.x, bomb.y));
    state.events.push({ type: 'teleport', x: bomb.x, y: bomb.y, player: bomb.owner });
  }
}

export function createMatch(config: MatchConfig): Match { return new Match(config); }
