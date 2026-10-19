import Phaser from 'phaser';
import type { MatchState, MapId, PowerUp, Direction, Point } from '../core/types';
import { DIRECTIONS, POWER_UPS } from '../core/types';
import { GAMEPLAY } from '../core/tuning';

const TILE = 48;
const SIZE = TILE * 15;
const color = (value: string): number => Number.parseInt(value.replace('#', ''), 16);
const PALETTES: Record<MapId, { floor: number; alternate: number; wall: number; light: number; accent: number; block: number }> = {
  mall: { floor: 0x34324c, alternate: 0x3b3654, wall: 0x686182, light: 0xaaa0bf, accent: 0xff9dc9, block: 0xac704d },
  airport: { floor: 0x243b4d, alternate: 0x294255, wall: 0x536b80, light: 0xa2c5d5, accent: 0x58d8f3, block: 0x8b729b },
  jungle: { floor: 0x243f35, alternate: 0x29473b, wall: 0x55614b, light: 0x8b9b69, accent: 0xb6e279, block: 0x53804a },
  factory: { floor: 0x323b45, alternate: 0x39424a, wall: 0x5d6874, light: 0x9aa5ae, accent: 0xffb34e, block: 0x9e6551 },
  boat: { floor: 0x493d38, alternate: 0x51443c, wall: 0x435b6b, light: 0x7f9baa, accent: 0x73d2dc, block: 0x9b714d },
};
export const POWERUP_COLORS: Record<PowerUp, number> = {
  bomb: 0x7fd0ff, fire: 0xff9c52, speed: 0xffe178, push: 0x8de4ad, kick: 0xff8fa1,
  shield: 0x82d6ff, invincible: 0xd0a1ff, remote: 0xb5a1ff, rapid: 0xffcc76, portal: 0x6ff2df,
};
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number }
interface Actor { sprite: Phaser.GameObjects.Image; last: Point; movingUntil: number; actionUntil: number; hurtUntil: number; deadUntil: number; lastAlive: boolean }

/** Visual projection only. All collisions, fuse times, effects and wins belong to the simulation. */
export class ArenaRenderer {
  private game: Phaser.Game;
  private scene?: Phaser.Scene;
  private state?: MatchState;
  private reducedMotion: boolean;
  private clock = 0;
  private realClock = 0;
  private finishedAt?: number;
  private pendingCelebration?: { x: number; y: number; color: number };
  private previousTick = -1;
  private tileImages: Phaser.GameObjects.Image[][] = [];
  private tileKeys: string[][] = [];
  private map?: MapId;
  private actors = new Map<number, Actor>();
  private bombs = new Map<number, Phaser.GameObjects.Image>();
  private pickups = new Map<string, Phaser.GameObjects.Image>();
  private effects?: Phaser.GameObjects.Graphics;
  private groundEffects?: Phaser.GameObjects.Graphics;
  private decoration?: Phaser.GameObjects.Graphics;
  private borderAnimation?: Phaser.GameObjects.Graphics;
  private borderLabels: Phaser.GameObjects.Text[] = [];
  private particles: Particle[] = [];
  private combo?: Phaser.GameObjects.Text;
  private comboUntil = 0;

  constructor(container: HTMLElement, options: { reducedMotion?: boolean } = {}) {
    this.reducedMotion = options.reducedMotion ?? false;
    const owner = this;
    class ArenaScene extends Phaser.Scene {
      constructor() { super('arena'); }
      create(): void { owner.initialize(this); }
      update(_time: number, delta: number): void { owner.paint(Math.min(delta / 1000, 0.05)); }
    }
    this.game = new Phaser.Game({
      type: Phaser.AUTO, parent: container, width: SIZE, height: SIZE, transparent: true,
      pixelArt: true, roundPixels: true, antialias: false, banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: SIZE, height: SIZE },
      audio: { noAudio: true }, input: { keyboard: false }, scene: ArenaScene,
      render: { powerPreference: 'high-performance' },
    });
  }

  render(state: MatchState, _dt?: number): void { this.state = state; }
  setReducedMotion(value: boolean): void { this.reducedMotion = value; }
  destroy(): void { this.game.destroy(true); this.particles = []; }

  private initialize(scene: Phaser.Scene): void {
    this.scene = scene;
    const g = scene.make.graphics({ x: 0, y: 0 });
    for (const map of Object.keys(PALETTES) as MapId[]) {
      for (const type of ['floor', 'wall', 'block'] as const) {
        for (let variant = 0; variant < 4; variant++) {
          g.clear(); this.drawTile(g, map, type, variant); g.generateTexture(`${map}-${type}-${variant}`, TILE, TILE);
        }
      }
    }
    for (let id = 0; id < 4; id++) {
      for (const facing of ['up', 'down', 'left', 'right'] as Direction[]) {
        for (let frame = 0; frame < 4; frame++) {
          g.clear(); this.drawCharacter(g, id, facing, frame); g.generateTexture(`actor-${id}-${facing}-${frame}`, TILE, TILE);
        }
      }
    }
    g.clear(); this.drawBomb(g); g.generateTexture('bomb', TILE, TILE);
    for (const type of POWER_UPS) {
      g.clear(); this.drawPowerup(g, type); g.generateTexture(`power-${type}`, 36, 36);
    }
    g.destroy();
    this.groundEffects = scene.add.graphics().setDepth(2);
    this.decoration = scene.add.graphics().setDepth(5);
    this.borderAnimation = scene.add.graphics().setDepth(6);
    this.effects = scene.add.graphics().setDepth(40);
    this.combo = scene.add.text(SIZE / 2, 88, '', {
      fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffe1a0', stroke: '#192936', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60);
  }

  private drawTile(g: Phaser.GameObjects.Graphics, map: MapId, type: 'floor'|'wall'|'block', v: number): void {
    const p = PALETTES[map];
    g.fillStyle(v % 2 ? p.alternate : p.floor).fillRect(0, 0, 48, 48);
    g.lineStyle(1, 0x0d2029, 0.5).strokeRect(0, 0, 48, 48);
    g.fillStyle(0xffffff, 0.04).fillRect(2, 2, 44, 1);
    if (map === 'mall') {
      g.lineStyle(1, 0xb9dde0, 0.055).lineBetween(24, 0, 24, 48).lineBetween(0, 24, 48, 24);
      if (v === 1) g.fillStyle(0xe5caa0, 0.08).fillRect(21, 21, 6, 6);
    } else if (map === 'airport') {
      g.fillStyle(0x9cc7d5, 0.055).fillRect(4, 4, 3, 39).fillRect(25, 4, 1, 39);
      g.fillStyle(p.accent, 0.06).fillRect(8, 44, 34, 2);
    } else if (map === 'jungle') {
      g.fillStyle(0xa6b270, 0.12).fillRect(9 + v * 6, 16, 4, 3).fillRect(34 - v * 4, 37, 3, 2);
      g.lineStyle(1, 0x162d25, 0.4).lineBetween(1, 28, 11, 28).lineBetween(11, 28, 15, 34);
      g.fillStyle(0x729251, 0.3).fillRect(2, 1, 5, 3).fillRect(41, 40, 5, 4);
    } else if (map === 'factory') {
      g.lineStyle(1, 0x778491, 0.12).lineBetween(5, 5, 43, 43).lineBetween(3, 30, 17, 44).lineBetween(30, 3, 44, 17);
      g.fillStyle(0x92a2af, 0.35).fillRect(4, 4, 2, 2).fillRect(42, 42, 2, 2);
    } else {
      for (let x = 2; x < 48; x += 12) {
        g.fillStyle(0x171e23, 0.38).fillRect(x, 0, 1, 48);
        g.fillStyle(0xa28360, 0.16).fillRect(x + 2, 7 + (v * 9) % 28, 1, 29);
      }
      g.fillStyle(0xceb08a, 0.3).fillRect(5, 5, 2, 2).fillRect(41, 41, 2, 2);
    }
    if (type === 'floor') return;
    g.fillStyle(0x050d17, 0.4).fillRoundedRect(3, 10, 43, 37, 5);
    if (type === 'wall') {
      if (map === 'jungle') {
        g.fillStyle(0x2c3e32).fillRoundedRect(3, 4, 42, 40, 5);
        g.fillStyle(p.wall).fillRoundedRect(4, 2, 39, 36, 4);
        g.fillStyle(p.light, 0.6).fillRect(7, 4, 32, 3);
        g.lineStyle(2, 0x334536).lineBetween(7, 21, 39, 21).lineBetween(22, 6, 22, 20);
        g.fillStyle(0x739556).fillRect(3, 5, 8, 5).fillRect(32, 30, 10, 8);
        g.fillStyle(0xb0ba70, 0.6).fillRect(5, 4, 4, 3).fillRect(35, 30, 5, 3);
        if (v === 2) g.lineStyle(2, 0x8ca15c).lineBetween(35, 3, 37, 19).lineBetween(37, 19, 33, 28);
      } else if (map === 'mall') {
        g.fillStyle(0x314253).fillRoundedRect(3, 4, 42, 39, 5);
        g.fillStyle(p.wall).fillRoundedRect(4, 1, 40, 37, 5);
        g.fillStyle(p.light, 0.7).fillRoundedRect(8, 3, 32, 7, 2);
        g.fillStyle(0x233444).fillRoundedRect(10, 13, 28, 18, 2);
        g.fillStyle(v % 2 ? 0xf285a8 : 0x66c6cb).fillRect(13, 16, 7, 11);
        g.fillStyle(v % 2 ? 0xf9ca73 : 0xba9ff4).fillRect(22, 16, 12, 4).fillRect(22, 23, 9, 4);
        g.fillStyle(p.accent).fillRect(10, 34, 28, 2);
      } else if (map === 'airport') {
        g.fillStyle(0x31465c).fillRoundedRect(4, 5, 40, 38, 4);
        g.fillStyle(p.wall).fillRoundedRect(3, 2, 42, 35, 4);
        g.fillStyle(p.light).fillRect(7, 4, 34, 4);
        g.fillStyle(0x253b4b).fillRect(10, 12, 28, 16);
        g.fillStyle(0x75d8e8).fillRect(13, 15, 6, 2).fillRect(22, 15, 11, 2);
        g.fillStyle(0xb5dfbd).fillRect(13, 22, 17, 2);
        g.fillStyle(0x3e566a).fillRect(7, 31, 34, 4);
      } else if (map === 'factory') {
        g.fillStyle(0x303b47).fillRoundedRect(2, 4, 44, 40, 3);
        g.fillStyle(p.wall).fillRect(4, 2, 40, 35);
        g.fillStyle(p.light, 0.6).fillRect(6, 3, 35, 4);
        g.fillStyle(0x25323d).fillRect(11, 11, 26, 17);
        for (let i = 0; i < 4; i++) g.fillStyle(0x7c8a95).fillRect(14 + i * 6, 13, 2, 13);
        g.fillStyle(p.accent).fillRect(5, 32, 8, 4).fillRect(19, 32, 8, 4).fillRect(33, 32, 9, 4);
        g.fillStyle(0x101d28).fillRect(14, 32, 4, 4).fillRect(28, 32, 4, 4);
      } else {
        g.fillStyle(0x263b48).fillRoundedRect(3, 4, 42, 40, 3);
        g.fillStyle(p.wall).fillRect(4, 2, 40, 35);
        g.fillStyle(p.light).fillRect(5, 3, 38, 4);
        for (let x = 9; x < 43; x += 7) { g.fillStyle(0x2d4654).fillRect(x, 9, 2, 24); g.fillStyle(0x6d8895).fillRect(x + 2, 9, 1, 24); }
        g.fillStyle(0xe4bc70).fillRect(8, 27, 11, 6);
        g.fillStyle(0x374e5b).fillRect(9, 28, 3, 4).fillRect(14, 28, 3, 4);
      }
    } else if (map === 'jungle') {
      g.fillStyle(0x28472e).fillRoundedRect(3, 8, 42, 34, 7);
      g.fillStyle(0x477448).fillRoundedRect(4, 8, 17, 26, 5).fillRoundedRect(17, 3, 23, 30, 6).fillRoundedRect(30, 13, 15, 23, 5);
      g.fillStyle(0x71934f).fillRoundedRect(7, 8, 12, 9, 3).fillRoundedRect(21, 5, 13, 10, 3).fillRoundedRect(33, 15, 9, 8, 2);
      g.fillStyle(0xc8b563).fillRect(12, 24, 3, 3).fillRect(33, 30, 3, 3);
      if (v === 1) g.fillStyle(0xf28e91).fillRect(25, 13, 4, 4).fillRect(23, 15, 8, 2);
    } else if (map === 'airport') {
      g.fillStyle(0x3b384e).fillRoundedRect(3, 13, 41, 29, 4);
      g.fillStyle(p.block).fillRoundedRect(4, 9, 24, 28, 3);
      g.fillStyle(0xb59ebc).fillRect(7, 11, 18, 3);
      g.lineStyle(3, 0x403c52).strokeRoundedRect(10, 5, 10, 6, 2);
      g.fillStyle(0xcea976).fillRoundedRect(25, 17, 18, 22, 3);
      g.fillStyle(0xf2d1a2).fillRect(27, 18, 14, 3);
      g.fillStyle(0x5a4b4c).fillRect(30, 22, 3, 15);
      g.fillStyle(0xbad7db).fillRect(7, 22, 7, 5);
      g.fillStyle(0x202d3b).fillRect(7, 38, 4, 4).fillRect(22, 38, 4, 4).fillRect(37, 39, 4, 3);
    } else if (map === 'factory') {
      g.fillStyle(0x5c403a).fillRoundedRect(4, 8, 40, 34, 3);
      g.fillStyle(p.block).fillRect(5, 4, 38, 33);
      g.fillStyle(0xd49a6e).fillRect(6, 5, 36, 5);
      g.fillStyle(0x594943).fillRect(10, 13, 28, 20);
      g.fillStyle(0xc0936b).fillRect(12, 15, 24, 16);
      g.fillStyle(0x2d343a).fillTriangle(24, 17, 16, 29, 32, 29);
      g.fillStyle(0xffd46b).fillRect(23, 21, 2, 4).fillRect(23, 27, 2, 1);
      g.fillStyle(0xada29a).fillRect(6, 6, 3, 3).fillRect(39, 33, 3, 3);
    } else {
      g.fillStyle(0x604632).fillRoundedRect(4, 7, 40, 35, 3);
      g.fillStyle(p.block).fillRect(4, 4, 40, 34);
      g.fillStyle(0xd5a879).fillRect(5, 5, 38, 5).fillRect(5, 5, 5, 32);
      g.fillStyle(0x76513d).fillRect(11, 12, 26, 21);
      g.lineStyle(5, 0xba8b5c).lineBetween(12, 12, 36, 33).lineBetween(36, 12, 12, 33);
      g.fillStyle(0xc39b72).fillRect(5, 33, 38, 4).fillRect(38, 9, 5, 25);
      if (map === 'mall') { g.fillStyle(0xf2b8b0).fillRect(19, 15, 11, 10); g.fillStyle(0xffe9ca).fillRect(21, 17, 7, 2).fillRect(21, 21, 5, 2); }
      g.fillStyle(0x53493d).fillRect(6, 6, 2, 2).fillRect(39, 34, 2, 2);
    }
  }

  private drawCharacter(g: Phaser.GameObjects.Graphics, id: number, facing: Direction, frame: number): void {
    const main = [0xff855c, 0x62d4e7, 0xb6a1ff, 0xf9d56e][id]!;
    const dark = [0xb55141, 0x367eaa, 0x6a5e9a, 0xa1783c][id]!;
    const step = [0, -2, 0, 2][frame]!;
    const offset = frame % 2;
    g.fillStyle(0x07121c, 0.4).fillEllipse(24, 40, 27, 10);
    g.fillStyle(0x152c3b).fillRoundedRect(13, 31 + step, 9, 10, 3).fillRoundedRect(26, 31 - step, 9, 10, 3);
    g.fillStyle(0xe0d5b9).fillRect(15, 38 + step, 7, 3).fillRect(27, 38 - step, 7, 3);
    g.fillStyle(dark).fillRoundedRect(12, 23 - offset, 25, 14, 5);
    g.fillStyle(main).fillRoundedRect(13, 22 - offset, 23, 12, 5);
    g.fillStyle(0xf9e4be).fillRect(21, 29 - offset, 7, 3);
    g.fillStyle(0x162b37).fillRoundedRect(8, 9 - offset, 32, 23, 9);
    g.fillStyle(dark).fillRoundedRect(9, 7 - offset, 30, 23, 9);
    g.fillStyle(main).fillRoundedRect(10, 6 - offset, 28, 22, 8);
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(15, 8 - offset, 14, 3, 1);
    if (id === 0) { // Nova: rounded pilot helmet and asymmetric side comms.
      g.fillStyle(0xffd88f).fillRect(22, 4 - offset, 5, 5);
      g.fillStyle(0x7f5045).fillRoundedRect(5, 16 - offset, 7, 10, 2);
      g.fillStyle(0x83e8dd).fillRect(6, 18 - offset, 3, 4);
    } else if (id === 1) { // Pixel: winged flight cap.
      g.fillStyle(0xd1f6e7).fillTriangle(8, 9, 2, 4, 5, 19).fillTriangle(39, 9, 45, 4, 42, 19);
      g.fillStyle(0x3b7899).fillRect(12, 11 - offset, 25, 5);
    } else if (id === 2) { // Bolt: antenna and squared ear pods.
      g.fillStyle(0x756399).fillRect(22, 1 - offset, 3, 6).fillRect(6, 12 - offset, 5, 11).fillRect(38, 12 - offset, 5, 11);
      g.fillStyle(0xffd58e).fillCircle(24, 2 - offset, 3);
    } else { // Miso: pointed cat hood and cream brow.
      g.fillStyle(0xd9ab56).fillTriangle(20, 7, 16, 0, 28, 4).fillTriangle(28, 7, 36, 0, 34, 11);
      g.fillStyle(0xffe7a0).fillRect(21, 5 - offset, 10, 3);
    }
    if (facing !== 'up') {
      const shift = facing === 'left' ? -4 : facing === 'right' ? 4 : 0;
      g.fillStyle(0x18303c).fillRoundedRect(15 + shift, 15 - offset, 19, 10, 4);
      g.fillStyle(0xe6f7de).fillRect(19 + shift, 17 - offset, 3, 4).fillRect(27 + shift, 17 - offset, 3, 4);
      g.fillStyle(0xabc6b1).fillRect(20 + shift, 21 - offset, 2, 1).fillRect(28 + shift, 21 - offset, 2, 1);
      g.fillStyle(0xf7c392).fillRect(23 + shift, 26 - offset, 4, 2);
    } else {
      g.fillStyle(dark).fillRoundedRect(16, 14 - offset, 16, 10, 3);
      g.fillStyle(0xffffff, 0.2).fillRect(20, 16 - offset, 8, 2);
    }
    g.fillStyle(dark).fillRoundedRect(8, 25 - offset - step / 2, 7, 10, 3).fillRoundedRect(34, 25 - offset + step / 2, 7, 10, 3);
    g.fillStyle(0xe7d9b5).fillRect(9, 31 - offset - step / 2, 5, 3).fillRect(35, 31 - offset + step / 2, 5, 3);
  }

  private drawBomb(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x020a12, 0.5).fillEllipse(24, 38, 31, 11);
    g.lineStyle(4, 0xa88454).lineBetween(27, 12, 29, 5).lineBetween(29, 5, 35, 5);
    g.fillStyle(0x0b1824).fillCircle(24, 25, 16);
    g.fillStyle(0x223a4c).fillCircle(23, 23, 14);
    g.fillStyle(0x3a5363).fillEllipse(19, 18, 12, 8);
    g.fillStyle(0x81959a, 0.8).fillRoundedRect(16, 15, 5, 3, 1);
    g.fillStyle(0x14232e).fillRect(20, 9, 10, 5);
    g.fillStyle(0xffce7e).fillRect(20, 10, 10, 2);
    g.fillStyle(0xffb261).fillRoundedRect(19, 27, 10, 5, 2);
    g.fillStyle(0xffecd0).fillRect(22, 28, 4, 2);
  }

  private drawPowerup(g: Phaser.GameObjects.Graphics, type: PowerUp): void {
    const c = POWERUP_COLORS[type];
    g.fillStyle(0x101f2a).fillRoundedRect(1, 3, 34, 32, 7);
    g.fillStyle(c).fillRoundedRect(2, 1, 32, 31, 6);
    g.fillStyle(0x162b35).fillRoundedRect(4, 3, 28, 26, 4);
    g.fillStyle(c, 0.18).fillRect(6, 5, 24, 21);
    g.fillStyle(c); g.lineStyle(3, c);
    switch (type) {
      case 'bomb': g.fillCircle(15, 18, 7); g.lineBetween(17, 12, 19, 8); g.fillRect(25, 9, 3, 10).fillRect(22, 12, 9, 3); break;
      case 'fire': g.fillTriangle(11, 24, 15, 9, 18, 17).fillTriangle(14, 25, 23, 7, 25, 24).fillCircle(19, 23, 6); g.fillStyle(0xffe6aa).fillTriangle(17, 25, 20, 16, 23, 25); break;
      case 'speed': g.fillTriangle(10, 9, 19, 17, 10, 25).fillTriangle(20, 9, 29, 17, 20, 25); break;
      case 'push': g.fillRoundedRect(8, 17, 14, 8, 2).fillRect(12, 11, 3, 9).fillRect(16, 9, 3, 10).fillRect(20, 12, 3, 9); g.lineBetween(25, 16, 29, 16).lineBetween(27, 13, 30, 16).lineBetween(27, 19, 30, 16); break;
      case 'kick': g.fillRect(11, 8, 8, 13).fillRoundedRect(11, 19, 17, 7, 2); g.lineBetween(23, 10, 29, 7).lineBetween(26, 15, 31, 14); break;
      case 'shield': g.fillTriangle(8, 10, 18, 28, 28, 10).fillRect(8, 8, 20, 6); g.fillStyle(0x173240).fillTriangle(12, 12, 18, 23, 24, 12); break;
      case 'invincible': g.fillTriangle(18, 6, 13, 25, 28, 13).fillTriangle(7, 13, 23, 25, 18, 6); g.fillStyle(0xf6e3ff).fillRect(17, 12, 3, 7); break;
      case 'remote': g.fillRoundedRect(12, 14, 12, 14, 2); g.fillStyle(0x142d38).fillCircle(18, 20, 3); g.lineStyle(2, c).strokeCircle(18, 11, 4).strokeCircle(18, 11, 8); break;
      case 'rapid': g.strokeCircle(18, 18, 10).lineBetween(18, 18, 18, 10).lineBetween(18, 18, 24, 18); g.fillRect(14, 4, 8, 3); break;
      case 'portal': g.strokeEllipse(14, 18, 10, 21).strokeEllipse(25, 18, 10, 21); g.fillStyle(0xffffff).fillRect(17, 16, 5, 3); break;
    }
    g.fillStyle(0xffffff, 0.45).fillRect(7, 3, 17, 1);
  }

  private paint(dt: number): void {
    const scene = this.scene, state = this.state;
    if (!scene || !state || !this.effects || !this.groundEffects) return;
    this.realClock += dt;
    if (state.status === 'finished' && this.finishedAt === undefined) {
      this.finishedAt = this.realClock;
      const winner = state.players.find(player => player.id === state.winner);
      this.pendingCelebration = winner ? { x: (winner.x + 0.5) * TILE, y: (winner.y + 0.5) * TILE, color: color(winner.color) } : undefined;
      if (!this.reducedMotion) scene.cameras.main.zoomTo(1.025, 1500, 'Sine.easeOut');
    } else if (state.status === 'playing' && this.finishedAt !== undefined) {
      this.finishedAt = undefined; this.pendingCelebration = undefined;
      this.particles = []; this.comboUntil = 0;
      scene.cameras.main.resetFX(); scene.cameras.main.setZoom(1);
    }
    const slowMotion = this.finishedAt !== undefined && this.realClock - this.finishedAt < 1.5;
    if (slowMotion && !this.reducedMotion) dt *= 0.23;
    this.clock += dt;
    if (!slowMotion && this.pendingCelebration) {
      const celebration = this.pendingCelebration;
      this.emit(celebration.x, celebration.y, celebration.color, 60);
      this.pendingCelebration = undefined;
      if (!this.reducedMotion) scene.cameras.main.zoomTo(1, 250, 'Sine.easeInOut');
    }
    this.syncTiles(state);
    const g = this.effects.clear(), ground = this.groundEffects.clear();
    const palette = PALETTES[state.arena.id];
    this.environment(ground, state);
    for (const portal of state.portals) {
      for (const [index, pos] of [portal.a, portal.b].entries()) {
        const x = (pos.x + 0.5) * TILE, y = (pos.y + 0.5) * TILE;
        const c = portal.id % 2 ? 0xb199ff : 0x65e5d3;
        const pulse = this.reducedMotion ? 1 : 0.92 + Math.sin(this.clock * 4) * 0.08;
        ground.fillStyle(c, 0.12).fillCircle(x, y, 23);
        ground.fillStyle(0x0b192a, 0.95).fillEllipse(x, y, 31 * pulse, 27 * pulse);
        ground.lineStyle(3, c, 0.95).strokeEllipse(x, y, 35 * pulse, 29 * pulse);
        ground.lineStyle(1, 0xe5ffff, 0.6).strokeEllipse(x, y, 27 * pulse, 21 * pulse);
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + (this.reducedMotion ? 0 : this.clock * (index ? -1 : 1));
          ground.fillStyle(c).fillRect(x + Math.cos(a) * 20 - 2, y + Math.sin(a) * 17 - 2, 4, 4);
        }
      }
    }
    for (const item of state.regrowth) {
      if (item.at - state.time < 2) {
        ground.lineStyle(2, 0xb4dc7b, 0.35 + Math.sin(this.clock * 8) * 0.15).strokeRoundedRect(item.x * TILE + 8, item.y * TILE + 8, 32, 32, 6);
        ground.fillStyle(0x9ec76c, 0.5).fillTriangle(item.x*TILE+18, item.y*TILE+33, item.x*TILE+25, item.y*TILE+23, item.x*TILE+29, item.y*TILE+33);
      }
    }
    const seenBombs = new Set<number>();
    for (const bomb of state.bombs) {
      seenBombs.add(bomb.id);
      let image = this.bombs.get(bomb.id);
      if (!image) { image = scene.add.image(0, 0, 'bomb').setDepth(12); this.bombs.set(bomb.id, image); }
      const x = (bomb.x + 0.5) * TILE, y = (bomb.y + 0.5) * TILE;
      const remaining = bomb.detonateAt - state.time;
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(this.clock * (remaining < 0.7 ? 22 : 10)) * 0.035;
      image.setPosition(x, y).setScale(pulse).setTint(bomb.remote ? 0xc7b8ff : 0xffffff);
      if (bomb.direction && !this.reducedMotion) {
        const d = DIRECTIONS[bomb.direction];
        for (let i = 1; i <= 3; i++) ground.fillStyle(palette.accent, 0.16 / i).fillCircle(x - d.x * i * 11, y - d.y * i * 11, 13 - i * 2);
      }
      const spark = 2 + Math.sin(this.clock * 30 + bomb.id) * 1.5;
      g.fillStyle(0xffb453, 0.18).fillCircle(x + 11, y - 20, 8);
      g.fillStyle(0xffe5a2).fillRect(x + 11 - spark / 2, y - 20 - spark / 2, spark, spark);
      if (remaining < 0.65 && !bomb.remote) this.drawDanger(ground, state, bomb, remaining);
    }
    for (const [id, image] of this.bombs) if (!seenBombs.has(id)) { image.destroy(); this.bombs.delete(id); }
    const seenItems = new Set<string>();
    for (const pickup of state.pickups) {
      const key = `${pickup.x},${pickup.y}`; seenItems.add(key);
      let image = this.pickups.get(key);
      if (!image) { image = scene.add.image(0, 0, `power-${pickup.type}`).setDepth(8); this.pickups.set(key, image); }
      const lift = this.reducedMotion ? 0 : Math.sin(this.clock * 3 + pickup.x) * 2;
      image.setPosition((pickup.x + 0.5) * TILE, (pickup.y + 0.5) * TILE + lift).setTexture(`power-${pickup.type}`);
      ground.fillStyle(POWERUP_COLORS[pickup.type], 0.11).fillCircle((pickup.x + 0.5) * TILE, (pickup.y + 0.5) * TILE, 21);
    }
    for (const [key, image] of this.pickups) if (!seenItems.has(key)) { image.destroy(); this.pickups.delete(key); }
    const activeIds = new Set(state.players.map(player => player.id));
    for (const [id, actor] of this.actors) if (!activeIds.has(id)) actor.sprite.setVisible(false);
    for (const player of state.players) {
      let actor = this.actors.get(player.id);
      if (!actor) { actor = { sprite: scene.add.image(0, 0, `actor-${player.id}-down-0`), last: { x: player.x, y: player.y }, movingUntil: 0, actionUntil: 0, hurtUntil: 0, deadUntil: 0, lastAlive: player.alive }; this.actors.set(player.id, actor); }
      if (Math.abs(actor.last.x - player.x) + Math.abs(actor.last.y - player.y) > 0.003) actor.movingUntil = this.clock + 0.1;
      actor.last.x = player.x; actor.last.y = player.y;
      if (actor.lastAlive && !player.alive) actor.deadUntil = this.clock + 0.38;
      actor.lastAlive = player.alive;
      actor.sprite.setVisible(player.alive || actor.deadUntil > this.clock);
      if (!player.alive) {
        const life = Math.max(0, (actor.deadUntil - this.clock) / 0.38);
        actor.sprite.setAlpha(life).setScale(this.reducedMotion ? 1 : 0.5 + life * 0.5).setRotation(this.reducedMotion ? 0 : (1 - life) * 3);
        continue;
      }
      actor.deadUntil = 0;
      const winning = state.status === 'finished' && state.winner === player.id && !slowMotion;
      const frame = !this.reducedMotion && (actor.movingUntil > this.clock || winning) ? Math.floor(this.clock * 10) % 4 : 0;
      const x = (player.x + 0.5) * TILE;
      const y = (player.y + 0.5) * TILE - (winning && !this.reducedMotion ? Math.abs(Math.sin(this.clock * 5)) * 9 : 0);
      actor.sprite.setPosition(x, y - 4).setTexture(`actor-${player.id}-${player.facing}-${frame}`).setDepth(20 + player.y / 20);
      actor.sprite.setRotation(winning && !this.reducedMotion ? Math.sin(this.clock * 5) * 0.1 : 0);
      actor.sprite.setAlpha(1).setScale(actor.actionUntil > this.clock && !this.reducedMotion ? 1.1 : 1, actor.actionUntil > this.clock && !this.reducedMotion ? 0.9 : 1).setTint(actor.hurtUntil > this.clock ? 0xffd4ee : 0xffffff);
      if (player.shield || player.invincibleUntil > state.time) {
        const c = player.invincibleUntil > state.time ? 0xceacff : 0x91e1ff;
        const opacity = this.reducedMotion ? 0.6 : 0.45 + Math.sin(this.clock * 6) * 0.15;
        g.lineStyle(2, c, opacity).strokeEllipse(x, y - 3, 41, 42);
        ground.fillStyle(c, 0.1).fillEllipse(x, y + 7, 45, 32);
        if (player.invincibleUntil > state.time) { g.fillStyle(c).fillRect(x - 13, y - 28, 26 * Math.min(1, (player.invincibleUntil - state.time) / 5), 2); }
      }
      if (player.human) {
        g.fillStyle(0xffe1a0, 0.95).fillTriangle(x - 4, y - 32, x + 4, y - 32, x, y - 27);
      }
      if (player.portalAnchor) ground.lineStyle(2, 0x6ff2df, 0.7).strokeCircle((player.portalAnchor.x + 0.5) * TILE, (player.portalAnchor.y + 0.5) * TILE, 14);
    }
    this.drawFlames(g, state);
    if (state.closingTiles.length && state.closingAt > state.time) {
      const alpha = this.reducedMotion ? 0.25 : 0.13 + (Math.sin(this.clock * 10) + 1) * 0.1;
      for (const point of state.closingTiles) {
        g.fillStyle(0xff586b, alpha).fillRect(point.x * TILE, point.y * TILE, TILE, TILE);
        g.lineStyle(2, 0xff8b80, 0.8).strokeRect(point.x * TILE + 4, point.y * TILE + 4, 40, 40);
      }
    }
    if (state.tick < this.previousTick) { this.particles = []; this.comboUntil = 0; }
    if (this.previousTick !== state.tick) {
      this.previousTick = state.tick;
      for (const event of state.events) {
        const actor = event.player === undefined ? undefined : this.actors.get(event.player);
        if (actor && event.type === 'bomb') actor.actionUntil = this.clock + 0.15;
        if (actor && event.type === 'shield') actor.hurtUntil = this.clock + 0.25;
        const c = event.type === 'pickup' ? POWERUP_COLORS[event.powerUp ?? 'bomb'] : event.type === 'teleport' ? 0x8cefe3 : event.type === 'death' ? color(state.players.find(p => p.id === event.player)?.color ?? '#ffd18c') : palette.accent;
        if (['block', 'pickup', 'teleport', 'death', 'explosion', 'shield', 'kick'].includes(event.type)) this.emit((event.x + 0.5) * TILE, (event.y + 0.5) * TILE, c, event.type === 'explosion' ? 8 : 16);
        if (event.type === 'combo' && this.combo) { this.combo.setText(`${event.value}× CHAIN REACTION`).setAlpha(1); this.comboUntil = this.clock + 1.6; if (!this.reducedMotion) scene.cameras.main.shake(130, 0.003); }
      }
    }
    this.drawParticles(g, dt);
    if (this.combo) this.combo.setAlpha(Math.max(0, Math.min(1, (this.comboUntil - this.clock) * 3)));
  }

  private syncTiles(state: MatchState): void {
    const scene = this.scene!;
    if (this.map !== state.arena.id) {
      for (const row of this.tileImages) for (const image of row) image.destroy();
      this.tileImages = []; this.tileKeys = []; this.map = state.arena.id;
      this.drawBorder(state.arena.id);
    }
    for (let y = 0; y < state.arena.height; y++) {
      this.tileImages[y] ??= []; this.tileKeys[y] ??= [];
      for (let x = 0; x < state.arena.width; x++) {
        const tile = state.arena.tiles[y]![x]!;
        const variant = (x * 7 + y * 13 + (x * y) % 7) % 4;
        const key = `${state.arena.id}-${tile}-${variant}`;
        if (!this.tileImages[y]![x]) this.tileImages[y]![x] = scene.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(tile === 'floor' ? 0 : 4);
        if (this.tileKeys[y]![x] !== key) { this.tileImages[y]![x]!.setTexture(key).setDepth(tile === 'floor' ? 0 : 4); this.tileKeys[y]![x] = key; }
      }
    }
  }

  private drawBorder(map: MapId): void {
    const g = this.decoration?.clear();
    if (!g) return;
    for (const label of this.borderLabels) label.destroy();
    this.borderLabels = [];
    const label = (x: number, y: number, text: string, tint: string, size = 11): void => {
      this.borderLabels.push(this.scene!.add.text(x, y, text, {fontFamily:'monospace', fontSize:`${size}px`, fontStyle:'bold', color:tint}).setOrigin(0.5).setDepth(6));
    };
    if (map === 'mall') {
      for (let i = 0; i < 3; i++) {
        const x = 105 + i * 190;
        g.fillStyle(0x121c2d).fillRoundedRect(x, 5, 152, 34, 3);
        g.lineStyle(2, i % 2 ? 0x65ddd9 : 0xff95bd).strokeRoundedRect(x, 5, 152, 34, 3);
        g.fillStyle(0x66c4d1, 0.3).fillRect(x + 6, 31, 140, 3);
        label(x + 76, 18, ['NITE MARKET', 'PIXEL PLAZA', 'BYTE & BREW'][i]!, i % 2 ? '#95f3e7' : '#ffd0df');
      }
      for (const y of [124, 570]) {
        g.fillStyle(0x243f36).fillRect(9, y + 15, 28, 18).fillRect(682, y + 15, 28, 18);
        g.fillStyle(0x7fb37c).fillCircle(18, y + 10, 11).fillCircle(30, y + 5, 9).fillCircle(690, y + 5, 10).fillCircle(705, y + 11, 9);
        g.fillStyle(0xc6dba6).fillRect(13, y + 4, 4, 4).fillRect(695, y, 4, 4);
      }
      g.fillStyle(0x162535).fillRoundedRect(240, 678, 240, 31, 4);
      label(360, 694, 'AFTER HOURS  /  OPEN ALL NIGHT', '#c0abc6', 10);
    } else if (map === 'airport') {
      g.fillStyle(0x122434).fillRoundedRect(192, 4, 336, 36, 3);
      label(360, 13, 'DEPARTURES     GATE   STATUS', '#99e6f2', 10);
      label(360, 28, 'BLAST 026      A4     ON TIME', '#f1d187', 10);
      for (const start of [70, 535]) {
        g.fillStyle(0x204459).fillRect(start, 7, 110, 29);
        g.fillStyle(0x7ba7b3, 0.4).fillTriangle(start + 5, 7, start + 47, 7, start + 5, 35);
        g.lineStyle(2, 0x6a93a8).lineBetween(start + 55, 7, start + 55, 36);
        g.fillStyle(0x8dbac6).fillTriangle(start + 66, 22, start + 96, 19, start + 88, 24).fillTriangle(start + 83, 22, start + 72, 12, start + 79, 24);
      }
      for (let x = 95; x < 650; x += 85) {
        g.fillStyle(0x2d5367).fillRoundedRect(x, 683, 57, 20, 3);
        g.fillStyle(0x8eabb6).fillRect(x, 681, 57, 3).fillRect(x + 6, 703, 3, 6).fillRect(x + 47, 703, 3, 6);
        g.lineStyle(2, 0x163a4e).lineBetween(x + 19, 685, x + 19, 701).lineBetween(x + 38, 685, x + 38, 701);
      }
    } else if (map === 'jungle') {
      for (let i = 0; i < 28; i++) {
        const x = i * 27, y = 4 + (i * 7) % 12;
        g.fillStyle(i % 2 ? 0x4c7446 : 0x648952).fillEllipse(x, y, 31, 19);
        g.fillStyle(0x97b966, 0.5).fillRect(x - 7, y - 3, 10, 3);
        g.lineStyle(2, 0x64864e).lineBetween(x, y + 5, x + 3, y + 24 + i % 9);
      }
      g.fillStyle(0x344c3a).fillRoundedRect(282, 5, 156, 34, 4);
      g.lineStyle(2, 0xa9b97b).strokeRoundedRect(286, 8, 148, 27, 2);
      label(360, 22, 'THE JADE GATE', '#c6d6a0');
      for (const x of [10, 686]) for (const y of [145, 337, 550]) {
        g.fillStyle(0x3f6442).fillEllipse(x + 8, y, 28, 48);
        g.fillStyle(0x76944d).fillTriangle(x - 3, y - 8, x + 20, y - 20, x + 11, y + 14);
        g.lineStyle(2, 0x92aa5a).lineBetween(x + 2, y - 5, x + 12, y + 22);
      }
    } else if (map === 'factory') {
      g.lineStyle(12, 0x2a353e).lineBetween(30, 22, 690, 22).lineBetween(23, 50, 23, 666).lineBetween(697, 50, 697, 666);
      g.lineStyle(5, 0x8d969a).lineBetween(30, 18, 690, 18).lineBetween(20, 50, 20, 666).lineBetween(694, 50, 694, 666);
      for (let x = 70; x < 700; x += 80) { g.fillStyle(0x4a5963).fillRect(x, 10, 9, 18); g.fillStyle(0xb1b7ad).fillRect(x + 2, 11, 3, 16); }
      g.fillStyle(0x182834).fillRoundedRect(252, 5, 216, 34, 3);
      label(360, 22, 'PRESSURE ZONE  /  06', '#ffd18c');
      for (const x of [75, 507]) {
        g.fillStyle(0x1d303b).fillRoundedRect(x, 680, 138, 28, 3);
        for (let i = 0; i < 6; i++) g.fillStyle(i % 2 ? 0x4e7b77 : 0xffb550).fillRect(x + 8 + i * 21, 688, 14, 11);
      }
    } else {
      g.fillStyle(0x143546).fillRect(0, 0, SIZE, 40).fillRect(0, 680, SIZE, 40).fillRect(0, 40, 35, 640).fillRect(685, 40, 35, 640);
      g.lineStyle(4, 0x9bb3aa).lineBetween(38, 43, 682, 43).lineBetween(38, 676, 682, 676).lineBetween(39, 43, 39, 676).lineBetween(681, 43, 681, 676);
      for (let x = 48; x < 690; x += 48) { g.fillStyle(0xa2b5a7).fillRect(x, 32, 3, 13).fillRect(x, 676, 3, 13); }
      for (const x of [8, 695]) for (const y of [117, 405, 595]) {
        g.fillStyle(0xe9a071).fillEllipse(x + 7, y, 15, 27); g.fillStyle(0x286076).fillEllipse(x + 7, y, 7, 14);
        g.fillStyle(0xffd2a2).fillRect(x + 2, y - 9, 10, 4).fillRect(x + 2, y + 6, 10, 4);
      }
      g.fillStyle(0x203a49).fillRoundedRect(255, 6, 210, 28, 3);
      label(360, 20, 'S.S. ARCADIA  /  DECK 04', '#b1dbd8');
      g.lineStyle(2, 0x6d9aaa, 0.5);
      for (let x = 25; x < 700; x += 100) g.lineBetween(x, 700, x + 40, 700).lineBetween(x + 13, 706, x + 51, 706);
    }
  }

  private environment(g: Phaser.GameObjects.Graphics, state: MatchState): void {
    const t = this.reducedMotion ? 0 : this.clock;
    const p = PALETTES[state.arena.id];
    const border = this.borderAnimation?.clear();
    if (border && state.arena.id === 'boat') {
      border.lineStyle(1, 0x8bc4d1, 0.35);
      for (let i = 0; i < 12; i++) {
        const x = (i * 71 + t * 16) % 670 + 8;
        const y = 688 + Math.sin(i * 4 + t) * 7;
        border.lineBetween(x, y, Math.min(711, x + 22), y).lineBetween(x + 5, 8 + i % 3 * 7, Math.min(711, x + 30), 8 + i % 3 * 7);
      }
      if (state.time % GAMEPLAY.boatPeriod >= GAMEPLAY.boatPeriod - GAMEPLAY.boatWarning) {
        const left = (Math.floor(state.time / GAMEPLAY.boatPeriod) + 1) % 2 === 1;
        border.lineStyle(3, 0xffd18a, 0.7);
        for (const x of [76, 624]) {
          const sign = left ? -1 : 1;
          border.lineBetween(x, 22, x + sign * 15, 22).lineBetween(x + sign * 15, 22, x + sign * 8, 16).lineBetween(x + sign * 15, 22, x + sign * 8, 28);
        }
      }
    } else if (border && state.arena.id === 'mall') {
      for (let i = 0; i < 9; i++) border.fillStyle(i % 2 ? 0x8cebe1 : 0xffafce, 0.4 + Math.sin(t * 2 + i) * 0.2).fillRect(86 + i * 68, 42, 21, 2);
    } else if (border && state.arena.id === 'airport') {
      for (let i = 0; i < 12; i++) border.fillStyle(0x85e0e7, 0.35 + Math.sin(t * 3 - i) * 0.2).fillRect(19, 80 + i * 48, 5, 3).fillRect(696, 80 + i * 48, 5, 3);
    }
    for (const conveyor of state.arena.conveyors) {
      const x = conveyor.x * TILE, y = conveyor.y * TILE;
      g.fillStyle(0x0b1722, 0.5).fillRect(x + 3, y + 3, 42, 42);
      const dir = DIRECTIONS[conveyor.direction];
      g.lineStyle(2, p.accent, 0.42);
      for (let i = -1; i < 3; i++) {
        const offset = ((t * 15) % 16) + i * 16;
        const cx = x + 24 + dir.x * (offset - 16), cy = y + 24 + dir.y * (offset - 16);
        if (cx < x + 8 || cx > x + 40 || cy < y + 8 || cy > y + 40) continue;
        if (dir.x) g.lineBetween(cx - dir.x * 4, cy - 6, cx + dir.x * 2, cy).lineBetween(cx + dir.x * 2, cy, cx - dir.x * 4, cy + 6);
        else g.lineBetween(cx - 6, cy - dir.y * 4, cx, cy + dir.y * 2).lineBetween(cx, cy + dir.y * 2, cx + 6, cy - dir.y * 4);
      }
      g.fillStyle(p.accent, 0.4).fillRect(x + 2, y + 2, 3, 3).fillRect(x + 43, y + 43, 3, 3);
    }
    for (const vent of state.arena.vents) {
      const x = vent.x * TILE, y = vent.y * TILE;
      g.fillStyle(0x14222c).fillRoundedRect(x + 7, y + 7, 34, 34, 3);
      g.fillStyle(0x717d84).fillRect(x + 9, y + 9, 30, 3);
      for (let i = 0; i < 4; i++) g.fillStyle(0x53636c).fillRect(x + 12, y + 15 + i * 6, 24, 2);
      const phase = state.time % GAMEPLAY.steamPeriod;
      if (phase >= GAMEPLAY.steamWarning && phase < GAMEPLAY.steamEnd) {
        g.fillStyle(0xffb04f, 0.5 + Math.sin(t * 10) * 0.2).fillRect(x + 9, y + 36, 4, 3).fillRect(x + 35, y + 36, 4, 3);
        g.lineStyle(2, 0xffb655, 0.55).strokeRoundedRect(x + 5, y + 5, 38, 38, 4);
      }
    }
    if (this.reducedMotion) return;
    for (let i = 0; i < 15; i++) {
      const x = (i * 167 + Math.sin(t * 0.3 + i) * 20 + 720) % SIZE;
      const y = (i * 97 + t * (state.arena.id === 'boat' ? 6 : -3) + 1440) % SIZE;
      const alpha = 0.1 + Math.sin(t + i) * 0.07;
      g.fillStyle(p.accent, alpha).fillRect(x, y, 2, state.arena.id === 'boat' ? 5 : 2);
    }
  }

  private drawDanger(g: Phaser.GameObjects.Graphics, state: MatchState, bomb: {x:number;y:number;range:number}, remaining: number): void {
    const opacity = this.reducedMotion ? 0.1 : (0.04 + Math.max(0, 0.65 - remaining) * 0.18) * (0.7 + Math.sin(this.clock * 12) * 0.3);
    for (const direction of Object.values(DIRECTIONS)) {
      for (let i = 1; i <= bomb.range; i++) {
        const x = Math.round(bomb.x) + direction.x * i, y = Math.round(bomb.y) + direction.y * i;
        const tile = state.arena.tiles[y]?.[x];
        if (!tile || tile === 'wall') break;
        g.fillStyle(0xffc271, opacity).fillRoundedRect(x * TILE + 8, y * TILE + 8, 32, 32, 4);
        if (tile === 'block') break;
      }
    }
  }

  private drawFlames(g: Phaser.GameObjects.Graphics, state: MatchState): void {
    const cells = new Set(state.flames.map(f => `${f.x},${f.y}`));
    const visualTime = state.time + (this.finishedAt === undefined ? 0 : (this.realClock - this.finishedAt) * 0.23);
    for (const flame of state.flames) {
      const x = (flame.x + 0.5) * TILE, y = (flame.y + 0.5) * TILE;
      const life = flame.owner === -1 ? 1 : Math.max(0, Math.min(1, (flame.until - visualTime) / 0.12));
      if (flame.owner === -1) {
        g.fillStyle(0xe9f3e6, 0.25).fillRoundedRect(x - 20, y - 20, 40, 40, 7);
        g.lineStyle(2, 0xffc074, 0.8).strokeRoundedRect(x - 21, y - 21, 42, 42, 5);
        for (let i = 0; i < 4; i++) {
          const rise = this.reducedMotion ? i * 5 : (this.clock * 55 + i * 9) % 33;
          g.fillStyle(0xe1f2e9, 0.65 - rise / 70).fillEllipse(x - 10 + i * 6, y + 13 - rise, 12 + rise / 3, 12 + rise / 3);
        }
        continue;
      }
      const pulse = this.reducedMotion ? 0 : Math.sin(this.clock * 35 + flame.x * 7 + flame.y) * 3;
      g.fillStyle(0xff6d39, 0.2 * life).fillCircle(x, y, 28);
      g.fillStyle(0xff8f3f, 0.9 * life).fillRoundedRect(x - 17 - pulse / 2, y - 17, 34 + pulse, 34, 8);
      for (const d of Object.values(DIRECTIONS)) {
        if (cells.has(`${flame.x + d.x},${flame.y + d.y}`)) {
          g.fillStyle(0xffa746, life).fillRect(x + (d.x < 0 ? -25 : -13), y + (d.y < 0 ? -25 : -13), d.x ? 38 : 26, d.y ? 38 : 26);
          g.fillStyle(0xffe4a2, life).fillRect(x + (d.x < 0 ? -25 : -7), y + (d.y < 0 ? -25 : -7), d.x ? 32 : 14, d.y ? 32 : 14);
        }
      }
      g.fillStyle(0xffe6a0, life).fillRoundedRect(x - 10, y - 11, 20, 22, 5);
      g.fillStyle(0xfff9de, life).fillRoundedRect(x - 5, y - 7, 10, 14, 3);
      if (state.arena.id === 'factory' && state.arena.vents.some(v => v.x === flame.x && v.y === flame.y)) g.fillStyle(0xd5f4f1, 0.45).fillEllipse(x, y - 7, 28, 42);
    }
  }

  private emit(x: number, y: number, c: number, count: number): void {
    if (this.reducedMotion) count = Math.min(3, count);
    for (let i = 0; i < count && this.particles.length < 450; i++) {
      const angle = i * 2.399 + this.clock * 5;
      const speed = 35 + (i * 17 % 100);
      const life = 0.3 + (i % 7) * 0.07;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, life, max: life, color: i % 3 === 0 ? 0xffeac5 : c, size: i % 3 + 2 });
    }
  }

  private drawParticles(g: Phaser.GameObjects.Graphics, dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 130 * dt;
      g.fillStyle(p.color, p.life / p.max).fillRect(p.x, p.y, p.size, p.size);
    }
  }
}
