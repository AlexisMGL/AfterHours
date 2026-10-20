import { Random } from '../../core/random';
import { buildNavigation } from '../maps/maps';
import { CLASSES, PHYSICS, WEAPONS } from './config';
import { clamp, distance, type Action, type MatchState, type MedicStation, type Projectile, type Soldier, type Vec, type WeaponId, type WeaponSlot } from './types';
import { clipSegmentToRect, lineOfSight, pointInCombatView, raycastGeometry, rayRect, soldierBox, soldierInCombatView } from './physics';

export const weaponSlot = (id: WeaponId): WeaponSlot => ({ id, ammo: WEAPONS[id].magazine, reserve: WEAPONS[id].reserve, reloadUntil: 0, readyAt: 0 });
export const muzzlePoint = (soldier: Soldier): Vec => ({ x: soldier.x + Math.cos(soldier.aim) * 32, y: soldier.y - 34 + Math.sin(soldier.aim) * 32 });
const mayFire = (state: MatchState, soldier: Soldier): boolean => soldierInCombatView(state, soldier)
  && pointInCombatView(state, { x: soldier.x, y: soldier.y - 34 }) && pointInCombatView(state, muzzlePoint(soldier));
const outsideContact = (hit: NonNullable<ReturnType<typeof raycastGeometry>>, padding = 3, body?: Vec): { point: Vec; normal: Vec } => {
  const platform = hit.platform, point = hit.point;
  let normal = hit.normal;
  const inside = point.x > platform.x && point.x < platform.x + platform.w && point.y > platform.y && point.y < platform.y + platform.h;
  if (inside) {
    // Slab entry normals describe where an extended ray entered the rectangle,
    // which may be hundreds of pixels away when the actual ray starts inside.
    // Keep a clipped throw on the body's side; other invalid starts recover to
    // their closest boundary instead of teleporting along the aiming axis.
    const faces = [
      { distance: point.y - platform.y, normal: { x: 0, y: -1 } },
      { distance: platform.y + platform.h - point.y, normal: { x: 0, y: 1 } },
      { distance: point.x - platform.x, normal: { x: -1, y: 0 } },
      { distance: platform.x + platform.w - point.x, normal: { x: 1, y: 0 } },
    ];
    if (body && body.y >= platform.y + platform.h) normal = { x: 0, y: 1 };
    else if (body && body.y <= platform.y) normal = { x: 0, y: -1 };
    else normal = faces.reduce((nearest, face) => face.distance < nearest.distance ? face : nearest).normal;
  }
  return {
    point: {
      x: normal.x < 0 ? platform.x - padding : normal.x > 0 ? platform.x + platform.w + padding : point.x,
      y: normal.y < 0 ? platform.y - padding : normal.y > 0 ? platform.y + platform.h + padding : point.y,
    }, normal,
  };
};

export function killSoldier(state: MatchState, target: Soldier, ownerId = -1): void {
  if (!target.alive) return;
  target.alive = false; target.health = 0; target.deathAt = state.time;
  target.respawnAt = state.config.mode === 'elimination' ? Infinity : state.time + PHYSICS.respawnDelay;
  target.stats.deaths++; target.abilityUntil = 0; target.shieldHealth = 0;
  const owner = state.soldiers.find(soldier => soldier.id === ownerId);
  if (owner && owner.team !== target.team) {
    owner.stats.kills++; owner.stats.score += 100;
    if (state.config.mode === 'deathmatch') state.scores[owner.team]++;
  }
  state.events.push({ type: 'death', x: target.x, y: target.y, soldierId: owner?.id, targetId: target.id });
  const active = target.weapons[target.activeWeapon];
  const amount = Math.min(100, active.ammo + active.reserve);
  if (amount > 0) {
    const id = state.tick * 32 + target.id;
    state.loot.push({ id, x: target.x, y: target.y, ammo: amount, weapon: target.id % 3 === 0 ? active.id : undefined, until: state.time + 24 });
    if (state.loot.length > 64) state.loot.shift();
  }
}

/** Returns actual health damage; allies and protected respawns are never damaged. */
export function damageSoldier(state: MatchState, target: Soldier, amount: number, ownerId: number, source: Vec, kind: 'bullet'|'explosion'|'environment' = 'bullet'): number {
  const owner = state.soldiers.find(soldier => soldier.id === ownerId);
  if (!target.alive || target.protectedUntil > state.time || amount <= 0 || (owner && owner.id !== target.id && owner.team === target.team)) return 0;
  if (kind !== 'environment' && (!pointInCombatView(state, source) || !pointInCombatView(state, { x: target.x, y: target.y - 28 }))) return 0;
  let damage = amount;
  if (kind !== 'environment' && target.classId === 'defense' && target.abilityUntil > state.time && target.shieldHealth > 0) {
    const angle = Math.atan2(source.y - (target.y - 32), source.x - target.x);
    if (Math.cos(angle - target.aim) > 0.1) {
      const blocked = Math.min(target.shieldHealth, damage * (kind === 'bullet' ? 0.9 : 0.35));
      target.shieldHealth -= blocked; damage -= blocked;
      state.events.push({ type: 'impact', x: target.x, y: target.y - 30, soldierId: target.id, material: 'shield', value: blocked });
    }
  }
  const actual = Math.min(target.health, damage);
  target.health -= actual; target.lastDamageAt = state.time; target.hurtUntil = state.time + 0.18;
  if (owner && owner.team !== target.team) { owner.stats.damage += actual; owner.stats.score += actual * 0.1; }
  state.events.push({ type: 'damage', x: target.x, y: target.y - 40, soldierId: owner?.id, targetId: target.id, value: actual });
  if (target.health <= 1e-7) killSoldier(state, target, ownerId);
  return actual;
}

export class CombatSystem {
  private nextId = 1;
  private terrainChanged = false;
  constructor(private readonly random: Random) {}

  updateSoldier(state: MatchState, soldier: Soldier, action: Action): void {
    if (Number.isFinite(action.aim)) soldier.aim = action.aim!;
    if (action.switchWeapon === 0 || action.switchWeapon === 1) soldier.activeWeapon = action.switchWeapon;
    for (const slot of soldier.weapons) {
      if (slot.reloadUntil > 0 && slot.reloadUntil <= state.time + 1e-7) {
        const count = Math.min(WEAPONS[slot.id].magazine - slot.ammo, slot.reserve);
        slot.ammo += count; slot.reserve -= count; slot.reloadUntil = 0;
      }
    }
    soldier.recoil = Math.max(0, soldier.recoil - 0.012);
    const slot = soldier.weapons[soldier.activeWeapon];
    if (action.reload && slot.reloadUntil === 0 && slot.ammo < WEAPONS[slot.id].magazine && slot.reserve > 0) {
      const multiplier = soldier.classId === 'assault' && soldier.abilityUntil > state.time ? 0.65 : 1;
      slot.reloadUntil = state.time + WEAPONS[slot.id].reload * multiplier;
      state.events.push({ type: 'reload', x: soldier.x, y: soldier.y - 30, soldierId: soldier.id, weapon: slot.id });
    }
    if (action.ability && soldier.abilityReadyAt <= state.time) this.ability(state, soldier);
    if (action.fire && slot.reloadUntil === 0 && slot.readyAt <= state.time + 1e-7) this.fire(state, soldier);
    if (action.grenade && soldier.grenades > 0 && mayFire(state, soldier)) {
      const point = muzzlePoint(soldier);
      // Throwing out of solid cover starts on the visible side of that cover.
      const blocked = raycastGeometry(state.arena, { x: soldier.x, y: soldier.y - 34 }, point);
      const origin = blocked ? outsideContact(blocked, 4, soldier).point : point;
      if (!pointInCombatView(state, origin)) return;
      soldier.grenades--; soldier.lastShotAt = state.time;
      soldier.stats.shots++;
      state.projectiles.push({ ...origin, id: this.nextId++, owner: soldier.id, team: soldier.team, vx: Math.cos(soldier.aim) * 520,
        vy: Math.sin(soldier.aim) * 520 - 120, kind: 'grenade', damage: 85, radius: 135, expires: state.time + 2.6, gravity: 950, weapon: 'thumper' });
      state.events.push({ type: 'shot', ...origin, soldierId: soldier.id, weapon: 'thumper' });
    }
  }

  private ability(state: MatchState, soldier: Soldier): void {
    const definition = CLASSES[soldier.classId];
    soldier.abilityReadyAt = state.time + definition.cooldown;
    soldier.abilityUntil = state.time + definition.duration;
    if (soldier.classId === 'defense') soldier.shieldHealth = 180;
    if (soldier.classId === 'support') {
      state.stations.push({ id: this.nextId++, owner: soldier.id, team: soldier.team, x: soldier.x, y: soldier.y, health: 90, capacity: 250, until: soldier.abilityUntil });
    }
    state.events.push({ type: 'ability', x: soldier.x, y: soldier.y - 28, soldierId: soldier.id });
  }

  private fire(state: MatchState, soldier: Soldier): void {
    if (!mayFire(state, soldier)) return;
    const slot = soldier.weapons[soldier.activeWeapon], weapon = WEAPONS[slot.id];
    if (slot.ammo <= 0) {
      slot.readyAt = state.time + 0.3;
      state.events.push({ type: 'dry', x: soldier.x, y: soldier.y - 30, soldierId: soldier.id, weapon: slot.id });
      return;
    }
    slot.ammo--; slot.readyAt = state.time + weapon.interval;
    soldier.lastShotAt = state.time; soldier.protectedUntil = 0;
    soldier.stats.shots += weapon.pellets;
    const focus = soldier.abilityUntil > state.time && soldier.classId === 'sniper';
    const rush = soldier.abilityUntil > state.time && soldier.classId === 'assault';
    const stability = focus ? 0.23 : rush ? 0.72 : 1;
    const shoulder = { x: soldier.x, y: soldier.y - 34 };
    const muzzle = muzzlePoint(soldier);
    state.events.push({ type: 'shot', ...muzzle, soldierId: soldier.id, weapon: slot.id });
    const obstruction = raycastGeometry(state.arena, shoulder, muzzle);
    if (obstruction) {
      this.damageCover(state, obstruction.platform.id, weapon.damage * weapon.pellets);
      state.events.push({ type: 'impact', ...obstruction.point, soldierId: soldier.id, material: obstruction.platform.material });
      return;
    }
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const movement = Math.abs(soldier.vx) / CLASSES[soldier.classId].speed;
      const turbulence = state.arena.id === 'aircraft' ? Math.abs(state.weather.wind) / 5000 : 0;
      const spread = weapon.spread * (1 + movement * 0.45 + (soldier.grounded ? 0 : 0.5)) * stability + soldier.recoil * 0.14 * stability + turbulence;
      const aim = soldier.aim + (this.random.next() * 2 - 1) * spread;
      if (weapon.speed > 0) {
        state.projectiles.push({ ...muzzle, id: this.nextId++, owner: soldier.id, team: soldier.team, vx: Math.cos(aim) * weapon.speed,
          vy: Math.sin(aim) * weapon.speed, kind: weapon.category === 'rocket' ? 'rocket' : 'grenade', damage: weapon.damage,
          radius: weapon.explosion, expires: state.time + Math.min(3, weapon.range / weapon.speed), gravity: weapon.category === 'launcher' ? 600 : 0, weapon: weapon.id });
        continue;
      }
      const rawEnd = { x: muzzle.x + Math.cos(aim) * weapon.range, y: muzzle.y + Math.sin(aim) * weapon.range };
      const end = state.combatView ? clipSegmentToRect(muzzle, rawEnd, state.combatView)!.to : rawEnd;
      const cover = raycastGeometry(state.arena, muzzle, end);
      let t = cover?.t ?? 1, point = cover?.point ?? end;
      let target: Soldier | undefined, station: MedicStation | undefined;
      for (const enemy of state.soldiers) {
        if (!enemy.alive || enemy.team === soldier.team || !pointInCombatView(state, { x: enemy.x, y: enemy.y - 28 })) continue;
        const hit = rayRect(muzzle, end, soldierBox(enemy));
        if (hit && hit.t < t) { t = hit.t; point = hit.point; target = enemy; station = undefined; }
      }
      for (const candidate of state.stations) {
        if (candidate.team === soldier.team || candidate.health <= 0 || !pointInCombatView(state, { x: candidate.x, y: candidate.y - 16 })) continue;
        const hit = rayRect(muzzle, end, { x: candidate.x - 22, y: candidate.y - 32, w: 44, h: 32 });
        if (hit && hit.t < t) { t = hit.t; point = hit.point; target = undefined; station = candidate; }
      }
      if (target) {
        const headshot = point.y <= target.y - 38;
        const falloff = clamp(1 - Math.max(0, distance(muzzle, point) / weapon.range - 0.5) * 0.55, 0.65, 1);
        const damage = weapon.damage * falloff * (headshot ? weapon.category === 'sniper' ? 2 : 1.6 : 1);
        if (damageSoldier(state, target, damage, soldier.id, muzzle) > 0) soldier.stats.hits++;
      } else if (station) station.health -= weapon.damage;
      else if (cover) this.damageCover(state, cover.platform.id, weapon.damage);
      state.tracers.push({ id: this.nextId++, owner: soldier.id, from: { ...muzzle }, to: point, until: state.time + 0.09, weapon: weapon.id, hit: !!target });
      if (target || station || cover) state.events.push({ type: 'impact', ...point, soldierId: soldier.id, material: target ? 'cloth' : station ? 'metal' : cover!.platform.material });
    }
    soldier.recoil = Math.min(0.7, soldier.recoil + weapon.recoil * stability);
  }

  private damageCover(state: MatchState, id: number, amount: number): void {
    const cover = state.arena.platforms.find(platform => platform.id === id);
    if (!cover || cover.hp === undefined || !cover.active) return;
    cover.hp -= amount;
    if (cover.hp <= 0) { cover.active = false; this.terrainChanged = true; }
  }

  updateProjectiles(state: MatchState, dt: number): void {
    const expired = new Set<number>();
    for (const projectile of state.projectiles) {
      if (!pointInCombatView(state, projectile)) { expired.add(projectile.id); continue; }
      const start = { x: projectile.x, y: projectile.y };
      projectile.vy += projectile.gravity * dt;
      const rawEnd = { x: start.x + projectile.vx * dt, y: start.y + projectile.vy * dt };
      const clipped = state.combatView ? clipSegmentToRect(start, rawEnd, state.combatView) : null;
      if (state.combatView && !clipped) { expired.add(projectile.id); continue; }
      const end = clipped?.to ?? rawEnd;
      const view = state.combatView;
      const reachesBoundary = !!view && (rawEnd.x <= view.x || rawEnd.x >= view.x + view.w || rawEnd.y <= view.y || rawEnd.y >= view.y + view.h);
      const cover = raycastGeometry(state.arena, start, end);
      let impact = cover?.point;
      let t = cover?.t ?? Infinity;
      let target: Soldier | undefined, hitStation: MedicStation | undefined;
      for (const enemy of state.soldiers) {
        if (!enemy.alive || enemy.team === projectile.team || !pointInCombatView(state, { x: enemy.x, y: enemy.y - 28 })) continue;
        const hit = rayRect(start, end, soldierBox(enemy));
        if (hit && hit.t < t) { t = hit.t; impact = hit.point; target = enemy; hitStation = undefined; }
      }
      for (const station of state.stations) {
        if (station.team === projectile.team || station.health <= 0 || !pointInCombatView(state, { x: station.x, y: station.y - 16 })) continue;
        const hit = rayRect(start, end, { x: station.x - 22, y: station.y - 32, w: 44, h: 32 });
        if (hit && hit.t < t) { t = hit.t; impact = hit.point; target = undefined; hitStation = station; }
      }
      // Reaching the camera edge removes a round even if an obstacle happens
      // to share that boundary; there is no splash from a discarded round.
      if (reachesBoundary && (!impact || t >= 1 - 1e-9)) { expired.add(projectile.id); continue; }
      if (impact && projectile.kind === 'bullet') {
        if (target) {
          if (damageSoldier(state, target, projectile.damage, projectile.owner, start) > 0) {
            const owner = state.soldiers.find(soldier => soldier.id === projectile.owner);
            if (owner) owner.stats.hits++;
          }
        } else if (hitStation) hitStation.health -= projectile.damage;
        else if (cover) this.damageCover(state, cover.platform.id, projectile.damage);
        state.events.push({ type: 'impact', ...impact, soldierId: projectile.owner, material: target ? 'cloth' : hitStation ? 'metal' : cover!.platform.material });
        expired.add(projectile.id); continue;
      }
      if (impact && (projectile.kind === 'rocket' || !cover || t < cover.t)) {
        projectile.x = impact.x; projectile.y = impact.y;
        if (cover && t === cover.t) Object.assign(projectile, outsideContact(cover).point);
        this.explode(state, projectile); expired.add(projectile.id); continue;
      }
      if (cover) {
        const contact = outsideContact(cover);
        Object.assign(projectile, contact.point);
        if (contact.normal.x) projectile.vx = contact.normal.x * Math.abs(projectile.vx) * 0.48;
        if (contact.normal.y) { projectile.vy = contact.normal.y * Math.abs(projectile.vy) * 0.4; projectile.vx *= 0.72; }
      } else {
        projectile.x = end.x; projectile.y = end.y;
        if (reachesBoundary) { expired.add(projectile.id); continue; }
      }
      if (!pointInCombatView(state, projectile)) { expired.add(projectile.id); continue; }
      if (projectile.expires <= state.time || projectile.x < -100 || projectile.x > state.arena.width + 100 || projectile.y > state.arena.height + 100) {
        if (projectile.kind !== 'bullet') this.explode(state, projectile);
        expired.add(projectile.id);
      }
    }
    state.projectiles = state.projectiles.filter(projectile => !expired.has(projectile.id));
    if (this.terrainChanged) { state.arena.nav = buildNavigation(state.arena); this.terrainChanged = false; }
  }

  private explode(state: MatchState, projectile: Projectile): void {
    if (!pointInCombatView(state, projectile)) return;
    let hit = false;
    for (const target of state.soldiers) {
      const point = { x: target.x, y: target.y - 28 };
      const range = distance(projectile, point);
      if (!pointInCombatView(state, point) || range > projectile.radius || !lineOfSight(state.arena, projectile, point)) continue;
      const amount = projectile.damage * (1 - 0.7 * range / projectile.radius);
      if (damageSoldier(state, target, amount, projectile.owner, projectile, 'explosion') > 0 && target.team !== projectile.team) hit = true;
    }
    const owner = state.soldiers.find(s => s.id === projectile.owner);
    if (owner && hit) owner.stats.hits++;
    for (const station of state.stations) {
      const point = { x: station.x, y: station.y - 16 };
      if (pointInCombatView(state, point) && station.team !== projectile.team && distance(point, projectile) < projectile.radius && lineOfSight(state.arena, projectile, point)) station.health -= projectile.damage;
    }
    // Resolve occlusion before destroying anything so one blast cannot pass
    // through the obstacle it has just destroyed to damage the next obstacle.
    const visibleCover = state.arena.platforms.filter(cover => {
      if (!cover.active || cover.hp === undefined) return false;
      const point = { x: clamp(projectile.x, cover.x, cover.x + cover.w), y: clamp(projectile.y, cover.y, cover.y + cover.h) };
      if (!pointInCombatView(state, point) || distance(projectile, point) >= projectile.radius) return false;
      const obstruction = raycastGeometry(state.arena, projectile, point);
      return !obstruction || obstruction.platform.id === cover.id;
    });
    for (const cover of visibleCover) this.damageCover(state, cover.id, projectile.damage);
    state.events.push({ type: 'explosion', x: projectile.x, y: projectile.y, soldierId: projectile.owner, weapon: projectile.weapon, value: projectile.radius });
  }

  updateHealing(state: MatchState, dt: number): void {
    state.stations = state.stations.filter(station => station.health > 0 && station.capacity > 0 && station.until > state.time);
    for (const station of state.stations) {
      for (const soldier of state.soldiers) {
        if (!soldier.alive || soldier.team !== station.team || soldier.health >= soldier.maxHealth || distance(station, soldier) > 145
          || !lineOfSight(state.arena, { x: station.x, y: station.y - 20 }, { x: soldier.x, y: soldier.y - 30 })) continue;
        const healing = Math.min(20 * dt, station.capacity, soldier.maxHealth - soldier.health);
        soldier.health += healing; station.capacity -= healing;
        const owner = state.soldiers.find(s => s.id === station.owner);
        if (owner) { owner.stats.healing += healing; owner.stats.score += healing * 0.2; }
        if (Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) state.events.push({ type: 'heal', x: soldier.x, y: soldier.y - 28, soldierId: station.owner, targetId: soldier.id, value: healing });
      }
    }
  }
}
