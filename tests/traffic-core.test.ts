import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE, EXIT_ROW, canMove, createPuzzle, moveVehicle, movementRange, solvePuzzle, undoMove, validateLevel,
  type Level, type PuzzleState, type Vehicle,
} from '../src/traffic/core';
import { LEVELS, WORLDS } from '../src/traffic/levels';

function car(id: string, x: number, y: number, axis: 'h' | 'v', length: 2 | 3 = 2, target = false): Vehicle {
  return { id, x, y, axis, length, target, color: target ? '#ff5c60' : '#64baf1' };
}
function fixture(vehicles: Vehicle[] = [car('R', 0, 2, 'h', 2, true), car('A', 3, 1, 'v'), car('B', 0, 4, 'h', 3), car('C', 5, 3, 'v', 3)]): Level {
  return { id: 100, worldId: 'city', name: 'Test', brief: 'Libérer la sortie.', par: 2, vehicles };
}
function state(vehicles?: Vehicle[]): PuzzleState { return createPuzzle(fixture(vehicles)); }

describe('Rush Hour movement rules', () => {
  it('creates a fresh puzzle without sharing authored vehicle objects', () => {
    const level = fixture();
    const puzzle = createPuzzle(level);
    expect(puzzle).toMatchObject({ moves: 0, won: false, history: [] });
    puzzle.vehicles[0]!.x = 1;
    expect(level.vehicles[0]!.x).toBe(0);
  });

  it('finds horizontal and vertical ranges using the whole vehicle footprint', () => {
    const puzzle = state();
    expect(movementRange(puzzle, 'R')).toEqual({ min: 0, max: 1 });
    expect(movementRange(puzzle, 'A')).toEqual({ min: -1, max: 3 });
    expect(movementRange(puzzle, 'B')).toEqual({ min: 0, max: 2 });
    expect(movementRange(puzzle, 'C')).toEqual({ min: -3, max: 0 });
    expect(movementRange(puzzle, 'missing')).toEqual({ min: 0, max: 0 });
  });

  it('keeps every ordinary vehicle inside the board', () => {
    const puzzle = state();
    expect(canMove(puzzle, 'A', -2)).toBe(false);
    expect(canMove(puzzle, 'A', 4)).toBe(false);
    expect(canMove(puzzle, 'B', -1)).toBe(false);
    expect(canMove(puzzle, 'C', 1)).toBe(false);
  });

  it('rejects moves that jump over a blocking vehicle', () => {
    const puzzle = state();
    expect(moveVehicle(puzzle, 'R', 4)).toBe(puzzle);
    expect(moveVehicle(puzzle, 'B', 3)).toBe(puzzle);
  });

  it('rejects absent vehicles, zero distances and fractional or nonfinite distances', () => {
    const puzzle = state();
    for (const delta of [0, 0.5, NaN, Infinity, -Infinity]) {
      expect(canMove(puzzle, 'R', delta)).toBe(false);
      expect(moveVehicle(puzzle, 'R', delta)).toBe(puzzle);
    }
    expect(moveVehicle(puzzle, 'missing', 1)).toBe(puzzle);
  });

  it('counts a complete slide as one move and changes only the permitted coordinate', () => {
    const original = state();
    const vertical = moveVehicle(original, 'A', 3);
    expect(vertical.moves).toBe(1);
    expect(vertical.vehicles.find(vehicle => vehicle.id === 'A')).toMatchObject({ x: 3, y: 4 });
    const horizontal = moveVehicle(vertical, 'R', 1);
    expect(horizontal.moves).toBe(2);
    expect(horizontal.vehicles.find(vehicle => vehicle.id === 'R')).toMatchObject({ x: 1, y: 2 });
    expect(original.vehicles.find(vehicle => vehicle.id === 'A')!.y).toBe(1);
    expect(original.moves).toBe(0);
    expect(original.history).toEqual([]);
  });

  it('lets only the red target use the right exit, after the complete lane is clear', () => {
    const original = state();
    expect(canMove(original, 'R', 6)).toBe(false);
    const cleared = moveVehicle(original, 'A', -1);
    expect(movementRange(cleared, 'R')).toEqual({ min: 0, max: BOARD_SIZE });
    const won = moveVehicle(cleared, 'R', BOARD_SIZE);
    expect(won).toMatchObject({ won: true, moves: 2 });
    expect(won.vehicles.find(vehicle => vehicle.target)).toMatchObject({ x: BOARD_SIZE, y: EXIT_ROW });
    expect(canMove(cleared, 'B', 6)).toBe(false);
  });

  it('requires a complete exit and disallows stopping halfway outside', () => {
    const puzzle = state([car('R', 4, 2, 'h', 2, true)]);
    expect(movementRange(puzzle, 'R')).toEqual({ min: -4, max: 2 });
    expect(canMove(puzzle, 'R', 1)).toBe(false);
    expect(moveVehicle(puzzle, 'R', 1)).toBe(puzzle);
    expect(moveVehicle(puzzle, 'R', 2).won).toBe(true);
  });

  it('freezes a completed puzzle until a move is undone', () => {
    const cleared = moveVehicle(state(), 'A', -1);
    const won = moveVehicle(cleared, 'R', 6);
    expect(moveVehicle(won, 'A', 1)).toBe(won);
    expect(movementRange(won, 'A')).toEqual({ min: 0, max: 0 });
    expect(canMove(won, 'R', -1)).toBe(false);
  });

  it('undoes the exit, move counter and all previous slides without mutating history', () => {
    const original = state();
    const cleared = moveVehicle(original, 'A', -1);
    const won = moveVehicle(cleared, 'R', 6);
    expect(won.history).toHaveLength(2);
    expect(undoMove(won)).toEqual(cleared);
    expect(undoMove(undoMove(won))).toEqual(original);
    expect(undoMove(original)).toBe(original);
    expect(won.history).toHaveLength(2);
    expect(cleared.history).toHaveLength(1);
  });
});

describe('Rush Hour shortest-path solver', () => {
  it('finds a minimal solution with a full slide rather than counting every square', () => {
    const vehicles = [car('R', 0, 2, 'h', 2, true), car('A', 3, 1, 'v')];
    expect(solvePuzzle(vehicles)).toEqual([{ id: 'A', delta: -1 }, { id: 'R', delta: 6 }]);
  });

  it('exits directly in one move when the lane is already clear', () => {
    expect(solvePuzzle([car('R', 0, 2, 'h', 2, true)])).toEqual([{ id: 'R', delta: 6 }]);
    expect(solvePuzzle([car('R', 4, 2, 'h', 2, true)])).toEqual([{ id: 'R', delta: 2 }]);
    expect(solvePuzzle([car('R', 6, 2, 'h', 2, true)])).toEqual([]);
  });

  it('proves an impossible same-lane blockage unsolvable', () => {
    const level = fixture([car('R', 0, 2, 'h', 2, true), car('A', 4, 2, 'h')]);
    expect(solvePuzzle(level.vehicles)).toBeNull();
    expect(validateLevel(level).join(' ')).toContain('ne permet pas');
  });

  it('rejects malformed boards instead of searching invalid positions', () => {
    expect(solvePuzzle([])).toBeNull();
    expect(solvePuzzle([car('R', 0, 1, 'h', 2, true)])).toBeNull();
    expect(solvePuzzle([car('R', 0, 2, 'h', 2, true), car('A', 1, 2, 'v')])).toBeNull();
    expect(solvePuzzle([car('R', 0, 2, 'h', 2, true), car('R', 4, 0, 'v')])).toBeNull();
    expect(solvePuzzle([car('R', 0.5, 2, 'h', 2, true)])).toBeNull();
  });

  it('keeps cached solutions and puzzle inputs protected from caller edits', () => {
    const vehicles = fixture().vehicles;
    const before = JSON.stringify(vehicles);
    const solution = solvePuzzle(vehicles)!;
    solution[0]!.delta = 999;
    solution.pop();
    expect(solvePuzzle(vehicles)).toHaveLength(2);
    expect(solvePuzzle(vehicles)![0]!.delta).toBe(-1);
    expect(JSON.stringify(vehicles)).toBe(before);
  });
});

describe('15 original puzzles across three worlds', () => {
  it('provides exactly five levels per world, with unique names and board structures', () => {
    expect(LEVELS).toHaveLength(15);
    expect(WORLDS.map(world => world.id)).toEqual(['city', 'coast', 'night']);
    expect(LEVELS.map(level => level.id)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(new Set(LEVELS.map(level => level.name)).size).toBe(15);
    for (const world of WORLDS) expect(LEVELS.filter(level => level.worldId === world.id)).toHaveLength(5);
    const structures = LEVELS.map(level => JSON.stringify(level.vehicles.map(vehicle => [vehicle.axis, vehicle.length, vehicle.axis === 'h' ? vehicle.y : vehicle.x]).sort()));
    expect(new Set(structures).size).toBe(15);
  });

  it('increases the proven minimum number of complete slides at every level', () => {
    expect(LEVELS.map(level => level.par)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 18, 21, 22]);
    for (let index = 1; index < LEVELS.length; index++) expect(LEVELS[index]!.par).toBeGreaterThan(LEVELS[index - 1]!.par);
  });

  it.each(LEVELS.map(level => [level.id, level] as const))('validates and legally solves level %i at its exact par', (_id, level) => {
    const before = JSON.stringify(level);
    expect(validateLevel(level)).toEqual([]);
    const solution = solvePuzzle(level.vehicles);
    expect(solution).not.toBeNull();
    expect(solution).toHaveLength(level.par);
    let puzzle = createPuzzle(level);
    for (const move of solution!) {
      expect(canMove(puzzle, move.id, move.delta)).toBe(true);
      const next = moveVehicle(puzzle, move.id, move.delta);
      expect(next).not.toBe(puzzle);
      puzzle = next;
    }
    expect(puzzle.won).toBe(true);
    expect(puzzle.moves).toBe(level.par);
    expect(solution!.at(-1)!.id).toBe('R');
    expect(JSON.stringify(level)).toBe(before);
    while (puzzle.history.length) puzzle = undoMove(puzzle);
    expect(puzzle).toEqual(createPuzzle(level));
  });

  it('reports incorrect pars and invalid authored footprints', () => {
    expect(validateLevel({ ...LEVELS[0]!, par: 99 }).join(' ')).toContain('minimum');
    const level = fixture([car('R', 0, 2, 'h', 2, true), car('A', 5, 5, 'h')]);
    expect(validateLevel(level).join(' ')).toContain('hors de la grille');
    expect(validateLevel({ ...LEVELS[0]!, name: '' }).join(' ')).toContain('nom');
  });
});
