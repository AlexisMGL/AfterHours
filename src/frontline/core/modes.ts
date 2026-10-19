import { distance, type MatchState, type Team } from './types';

export function finishMatch(state: MatchState, winner: Team | null): void {
  if (state.phase === 'finished') return;
  state.phase = 'finished'; state.winnerTeam = winner;
  state.events.push({ type: 'victory', x: state.arena.width / 2, y: 400, value: winner ?? -1 });
}

export function updateFlags(state: MatchState, dt: number): void {
  for (const flag of state.flags) {
    const occupants = state.soldiers.filter(soldier => soldier.alive && distance(soldier, flag) < 110);
    const blue = occupants.filter(soldier => soldier.team === 0), red = occupants.filter(soldier => soldier.team === 1);
    flag.contested = blue.length > 0 && red.length > 0;
    if (flag.contested) continue;
    const team: Team | null = blue.length ? 0 : red.length ? 1 : null;
    if (team === null || team === flag.owner) {
      flag.progress = Math.max(0, flag.progress - dt * 0.13);
      if (flag.progress === 0) flag.capturing = null;
      continue;
    }
    if (flag.capturing !== team) { flag.progress = Math.max(0, flag.progress - dt * 0.3); if (flag.progress > 0) continue; flag.capturing = team; }
    flag.progress = Math.min(1, flag.progress + dt * 0.16 * Math.sqrt(Math.min(3, occupants.length)));
    if (flag.progress >= 1 - 1e-7) {
      flag.owner = team; flag.capturing = null; flag.progress = 0;
      for (const soldier of occupants) { soldier.stats.objective += 100; soldier.stats.score += 100; }
      state.events.push({ type: 'capture', x: flag.x, y: flag.y, soldierId: occupants[0]?.id, value: flag.id });
    }
  }
  if (Math.floor(state.time - state.roundStartTime + 1e-7) > Math.floor(state.time - state.roundStartTime - dt + 1e-7)) {
    for (const flag of state.flags) if (flag.owner !== null) state.scores[flag.owner]++;
  }
}

export function updateMode(state: MatchState, dt: number): boolean {
  if (state.config.mode === 'flags') updateFlags(state, dt);
  if (state.config.mode === 'elimination') {
    const living = [state.soldiers.filter(s => s.alive && s.team === 0), state.soldiers.filter(s => s.alive && s.team === 1)];
    const roundLimit = Math.min(180, state.config.timeLimit || 180);
    if (living[0]!.length && living[1]!.length && state.time - state.roundStartTime + 1e-7 < roundLimit) return false;
    const counts = living.map(team => team.length);
    const health = living.map(team => team.reduce((sum, s) => sum + s.health / s.maxHealth, 0));
    const winner: Team | null = counts[0] !== counts[1] ? counts[0]! > counts[1]! ? 0 : 1
      : Math.abs(health[0]! - health[1]!) > 0.001 ? health[0]! > health[1]! ? 0 : 1 : null;
    if (winner !== null) state.roundWins[winner]++;
    const target = Math.floor(state.config.rounds / 2) + 1;
    state.events.push({ type: 'round', x: state.arena.width / 2, y: 400, value: winner ?? -1 });
    if (state.roundWins.some(wins => wins >= target) || state.round >= state.config.rounds + 4) {
      finishMatch(state, state.roundWins[0] === state.roundWins[1] ? null : state.roundWins[0] > state.roundWins[1] ? 0 : 1);
    } else { state.phase = 'round-over'; state.roundUntil = state.time + 4; }
    return true;
  }
  const scoreEnd = state.scores.some(score => score >= state.config.scoreLimit);
  const timeEnd = state.config.timeLimit > 0 && state.time + 1e-7 >= state.config.timeLimit;
  if (scoreEnd || timeEnd) {
    finishMatch(state, state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1);
    return true;
  }
  return false;
}
