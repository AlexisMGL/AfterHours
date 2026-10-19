import { Action, Controller, Direction, MatchState } from '../core/types';

export class LocalHumanController implements Controller {
  private keys = new Map<string, number>();
  private order = 0;
  private bomb = false;
  private ability = false;
  private boundDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    const code = event.code;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyE'].includes(code)) event.preventDefault();
    if (!event.repeat) {
      this.keys.set(code, ++this.order);
      if (code === 'Space') this.bomb = true;
      if (code === 'KeyE') this.ability = true;
    }
  };
  private boundUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private boundBlur = () => this.reset();
  constructor() {
    window.addEventListener('keydown', this.boundDown);
    window.addEventListener('keyup', this.boundUp);
    window.addEventListener('blur', this.boundBlur);
  }
  getAction(_state: MatchState, _playerId: number): Action {
    const mappings: Record<string, Direction> = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
    let latest = -1;
    let move: Direction | undefined;
    for (const [code, at] of this.keys) if (mappings[code] && at > latest) { move = mappings[code]; latest = at; }
    const action: Action = { move, bomb: this.bomb, ability: this.ability };
    this.bomb = false; this.ability = false;
    return action;
  }
  touch(direction?: Direction) { this.keys.clear(); if (direction) this.keys.set({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction], ++this.order); }
  trigger(action: 'bomb'|'ability') { this[action] = true; }
  reset() { this.keys.clear(); this.bomb = false; this.ability = false; }
  destroy() { window.removeEventListener('keydown',this.boundDown); window.removeEventListener('keyup',this.boundUp); window.removeEventListener('blur',this.boundBlur); }
}
