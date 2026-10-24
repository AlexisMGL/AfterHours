export const BOARD_SIZE = 6;
export const EXIT_ROW = 2;

export type Axis = 'h' | 'v';
export interface Vehicle {
  id: string;
  x: number;
  y: number;
  length: 2 | 3;
  axis: Axis;
  color: string;
  target?: boolean;
}
export interface Level {
  id: number;
  worldId: 'city' | 'coast' | 'night';
  name: string;
  brief: string;
  vehicles: Vehicle[];
  par: number;
}
export interface Move { id: string; delta: number }
export interface PuzzleSnapshot { vehicles: Vehicle[]; moves: number; won: boolean }
export interface PuzzleState extends PuzzleSnapshot { history: PuzzleSnapshot[] }

export function createPuzzle(level: Level): PuzzleState {
  return { vehicles: level.vehicles.map(vehicle => ({ ...vehicle })), moves: 0, won: false, history: [] };
}

function occupiedCells(vehicles: Vehicle[], ignoredId?: string): Int8Array {
  const occupied = new Int8Array(BOARD_SIZE * BOARD_SIZE);
  for (const vehicle of vehicles) {
    if (vehicle.id === ignoredId) continue;
    for (let offset = 0; offset < vehicle.length; offset++) {
      const x = vehicle.x + (vehicle.axis === 'h' ? offset : 0);
      const y = vehicle.y + (vehicle.axis === 'v' ? offset : 0);
      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) occupied[y * BOARD_SIZE + x] = 1;
    }
  }
  return occupied;
}

/** Signed slide distances. A clear target lane permits x=6; its partial exit x=5 is not a legal stop. */
export function movementRange(state: PuzzleState, id: string): { min: number; max: number } {
  const vehicle = state.vehicles.find(candidate => candidate.id === id);
  if (state.won || !vehicle) return { min: 0, max: 0 };
  const occupied = occupiedCells(state.vehicles, id);
  const horizontal = vehicle.axis === 'h';
  const position = horizontal ? vehicle.x : vehicle.y;
  const fixed = horizontal ? vehicle.y : vehicle.x;
  const cell = (coordinate: number) => occupied[horizontal ? fixed * BOARD_SIZE + coordinate : coordinate * BOARD_SIZE + fixed];
  let min = 0;
  let max = 0;
  while (position + min > 0 && !cell(position + min - 1)) min--;
  while (position + vehicle.length + max < BOARD_SIZE && !cell(position + vehicle.length + max)) max++;
  if (vehicle.target && horizontal && fixed === EXIT_ROW && position + vehicle.length + max === BOARD_SIZE) max = BOARD_SIZE - position;
  return { min, max };
}

export function canMove(state: PuzzleState, id: string, delta: number): boolean {
  if (!Number.isInteger(delta) || delta === 0) return false;
  const vehicle = state.vehicles.find(candidate => candidate.id === id);
  if (!vehicle || (vehicle.target && vehicle.x + delta === BOARD_SIZE - 1)) return false;
  const range = movementRange(state, id);
  return delta >= range.min && delta <= range.max;
}

export function moveVehicle(state: PuzzleState, id: string, delta: number): PuzzleState {
  if (!canMove(state, id, delta)) return state;
  let won = false;
  const vehicles = state.vehicles.map(vehicle => {
    if (vehicle.id !== id) return vehicle;
    const moved = { ...vehicle, x: vehicle.x + (vehicle.axis === 'h' ? delta : 0), y: vehicle.y + (vehicle.axis === 'v' ? delta : 0) };
    if (moved.target && moved.x === BOARD_SIZE) won = true;
    return moved;
  });
  return { vehicles, moves: state.moves + 1, won, history: [...state.history, { vehicles: state.vehicles, moves: state.moves, won: state.won }] };
}

export function undoMove(state: PuzzleState): PuzzleState {
  const previous = state.history.at(-1);
  return previous ? { ...previous, history: state.history.slice(0, -1) } : state;
}

function vehicleErrors(vehicles: Vehicle[], allowExited = false): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const occupied = new Set<number>();
  const targets = vehicles.filter(vehicle => vehicle.target);
  if (targets.length !== 1) errors.push('Il faut exactement une voiture à faire sortir.');
  for (const vehicle of vehicles) {
    if (!vehicle.id || ids.has(vehicle.id)) errors.push(`Identifiant de véhicule invalide : ${vehicle.id}.`);
    ids.add(vehicle.id);
    const exited = allowExited && vehicle.target && vehicle.x === BOARD_SIZE;
    const validShape = (vehicle.axis === 'h' || vehicle.axis === 'v') && (vehicle.length === 2 || vehicle.length === 3);
    if (!validShape || !Number.isInteger(vehicle.x) || !Number.isInteger(vehicle.y)) {
      errors.push(`Géométrie invalide : ${vehicle.id}.`);
      continue;
    }
    if (vehicle.target && (vehicle.axis !== 'h' || vehicle.y !== EXIT_ROW || vehicle.length !== 2)) errors.push('La voiture cible doit mesurer deux cases et faire face à la sortie.');
    if (vehicle.x < 0 || vehicle.y < 0 || vehicle.y + (vehicle.axis === 'v' ? vehicle.length : 1) > BOARD_SIZE || (!exited && vehicle.x + (vehicle.axis === 'h' ? vehicle.length : 1) > BOARD_SIZE)) {
      errors.push(`Véhicule hors de la grille : ${vehicle.id}.`);
      continue;
    }
    if (exited) continue;
    for (let offset = 0; offset < vehicle.length; offset++) {
      const cell = (vehicle.y + (vehicle.axis === 'v' ? offset : 0)) * BOARD_SIZE + vehicle.x + (vehicle.axis === 'h' ? offset : 0);
      if (occupied.has(cell)) errors.push(`Véhicules superposés : ${vehicle.id}.`);
      occupied.add(cell);
    }
  }
  return errors;
}

const solutionCache = new Map<string, Move[] | null>();
const cloneMoves = (moves: Move[] | null): Move[] | null => moves?.map(move => ({ ...move })) ?? null;
function cacheSolution(key: string, solution: Move[] | null): void {
  if (solutionCache.size >= 400) solutionCache.delete(solutionCache.keys().next().value!);
  solutionCache.set(key, solution);
}

/** Breadth-first search: every complete slide costs one move, including the final exit. */
export function solvePuzzle(vehicles: Vehicle[]): Move[] | null {
  if (vehicleErrors(vehicles, true).length) return null;
  const cacheKey = JSON.stringify(vehicles.map(vehicle => [vehicle.id, vehicle.axis, vehicle.length, vehicle.x, vehicle.y, !!vehicle.target]));
  if (solutionCache.has(cacheKey)) return cloneMoves(solutionCache.get(cacheKey)!);
  const targetIndex = vehicles.findIndex(vehicle => vehicle.target);
  if (vehicles[targetIndex]!.x === BOARD_SIZE) return [];
  const start = vehicles.map(vehicle => String.fromCharCode(48 + (vehicle.axis === 'h' ? vehicle.x : vehicle.y))).join('');
  const states = [start];
  const parents = [-1];
  const moves: Move[] = [{ id: '', delta: 0 }];
  const visited = new Set<string>(states);
  const occupied = new Int8Array(BOARD_SIZE * BOARD_SIZE);
  const positions = new Int8Array(vehicles.length);
  for (let head = 0; head < states.length; head++) {
    const state = states[head]!;
    occupied.fill(-1);
    for (let index = 0; index < vehicles.length; index++) {
      const vehicle = vehicles[index]!;
      const position = state.charCodeAt(index) - 48;
      positions[index] = position;
      for (let offset = 0; offset < vehicle.length; offset++) {
        const cell = vehicle.axis === 'h' ? vehicle.y * BOARD_SIZE + position + offset : (position + offset) * BOARD_SIZE + vehicle.x;
        occupied[cell] = index;
      }
    }
    const targetPosition = positions[targetIndex]!;
    let laneClear = true;
    for (let x = targetPosition + 2; x < BOARD_SIZE; x++) if (occupied[EXIT_ROW * BOARD_SIZE + x] !== -1) laneClear = false;
    if (laneClear) {
      const solution: Move[] = [{ id: vehicles[targetIndex]!.id, delta: BOARD_SIZE - targetPosition }];
      for (let index = head; parents[index] !== -1; index = parents[index]!) solution.push(moves[index]!);
      solution.reverse();
      cacheSolution(cacheKey, solution);
      return cloneMoves(solution);
    }
    for (let index = 0; index < vehicles.length; index++) {
      const vehicle = vehicles[index]!;
      const position = positions[index]!;
      for (const direction of [-1, 1]) {
        for (let delta = direction; ; delta += direction) {
          const leading = direction < 0 ? position + delta : position + vehicle.length - 1 + delta;
          if (leading < 0 || leading >= BOARD_SIZE) break;
          const cell = vehicle.axis === 'h' ? vehicle.y * BOARD_SIZE + leading : leading * BOARD_SIZE + vehicle.x;
          if (occupied[cell] !== -1) break;
          const next = state.slice(0, index) + String.fromCharCode(48 + position + delta) + state.slice(index + 1);
          if (visited.has(next)) continue;
          visited.add(next);
          states.push(next);
          parents.push(head);
          moves.push({ id: vehicle.id, delta });
        }
      }
    }
  }
  cacheSolution(cacheKey, null);
  return null;
}

export function validateLevel(level: Level): string[] {
  const errors = vehicleErrors(level.vehicles);
  if (!Number.isInteger(level.id) || level.id < 1) errors.push('Identifiant de niveau invalide.');
  if (!['city', 'coast', 'night'].includes(level.worldId)) errors.push('Monde inconnu.');
  if (!level.name.trim() || !level.brief.trim()) errors.push('Le niveau doit avoir un nom et une consigne.');
  if (!Number.isInteger(level.par) || level.par < 1) errors.push('Objectif de coups invalide.');
  if (errors.length) return errors;
  const solution = solvePuzzle(level.vehicles);
  if (!solution) errors.push('Ce puzzle ne permet pas de faire sortir la voiture.');
  else if (solution.length !== level.par) errors.push(`Le minimum est de ${solution.length} coups, pas ${level.par}.`);
  return errors;
}
