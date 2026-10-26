import { describe, expect, it } from 'vitest';
import { COAST_PATH, COAST_RINGS, MAP_SOURCES, markerPosition, projectCoordinates, renderWorldMap } from '../src/malagasy/map';
import { WORLDS } from '../src/malagasy/worlds';

describe('Madagascar geographic map', () => {
  it('retains the real main island and the two course island destinations in one projection', () => {
    expect(COAST_RINGS).toHaveLength(3);
    const main = COAST_RINGS.reduce((largest, ring) => largest.length > ring.length ? largest : ring);
    const longitudes = main.map(point => point[0]), latitudes = main.map(point => point[1]);
    expect(Math.min(...longitudes)).toBeCloseTo(43.2, 0);
    expect(Math.max(...longitudes)).toBeCloseTo(50.5, 0);
    expect(Math.max(...latitudes)).toBeCloseTo(-12, 0);
    expect(Math.min(...latitudes)).toBeCloseTo(-25.6, 0);
    expect(COAST_PATH).not.toContain('NaN');
    for (const worldNumber of [13, 18]) {
      const world = WORLDS.find(candidate => candidate.number === worldNumber)!;
      const [latitude, longitude] = world.coordinates;
      expect(COAST_RINGS.some(ring => longitude >= Math.min(...ring.map(point => point[0]))
        && longitude <= Math.max(...ring.map(point => point[0]))
        && latitude >= Math.min(...ring.map(point => point[1]))
        && latitude <= Math.max(...ring.map(point => point[1])))).toBe(true);
    }
    const [northX, northY] = projectCoordinates(-12.28, 49.29);
    const [southX, southY] = projectCoordinates(-25.03, 46.99);
    expect(northY).toBeLessThan(southY);
    expect(northX).toBeGreaterThan(southX);
    expect(southY - northY).toBeGreaterThan((northX - southX) * 4);
  });
  it('separates both Antananarivo visits while keeping their actual shared anchor', () => {
    const first = markerPosition(WORLDS[0]), later = markerPosition(WORLDS[18]);
    expect(first.anchor).toEqual(later.anchor);
    expect(first.marker).toEqual(first.anchor);
    expect(Math.hypot(first.marker[0] - later.marker[0], first.marker[1] - later.marker[1])).toBeGreaterThan(40);
  });
  it('makes every destination keyboard inspectable and keeps the national final out of city geography', () => {
    const map = renderWorldMap(WORLDS);
    expect((map.match(/data-world=/g) ?? []).length).toBe(20);
    expect((map.match(/role="button" tabindex="0"/g) ?? []).length).toBe(20);
    expect(map).toContain('class="ma-map-finale" data-world="world-20"');
    expect(map).toContain('Antananarivo');
    expect(map).not.toContain('http');
    expect(MAP_SOURCES[0].consulted).toBe(true);
    expect(MAP_SOURCES[0].license).toContain('domaine public');
  });
});
