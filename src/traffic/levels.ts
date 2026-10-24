import type { Axis, Level, Vehicle } from './core';

export const WORLDS = [
  { id: 'city', name: 'Centre-ville', subtitle: 'LES PREMIERS DÉTOURS', description: 'Un matin animé, des taxis et les premières places à libérer.', accent: '#ffc566' },
  { id: 'coast', name: 'Route côtière', subtitle: 'LE GOÛT DU DÉTOUR', description: 'Entre les quais et la mer, les espaces libres deviennent précieux.', accent: '#6ee7db' },
  { id: 'night', name: 'Nuit électrique', subtitle: 'LA VILLE NE DORT PAS', description: 'Sous les néons, dénouez les embouteillages les plus retors.', accent: '#bf9bff' },
] as const;

type VehicleSpec = [id: string, x: number, y: number, length: 2 | 3, axis: Axis];
const PALETTE = ['#ffc566', '#64baf1', '#a8d582', '#b99af3', '#f09f72', '#73d3cc', '#e2b5db', '#a7bdce', '#d5c56d', '#86abd6', '#a4c9a5'];
function puzzle(id: number, name: string, brief: string, par: number, specs: VehicleSpec[]): Level {
  const vehicles: Vehicle[] = specs.map(([vehicleId, x, y, length, axis], index) => ({
    id: vehicleId, x, y, length, axis, color: index === 0 ? '#ff5c60' : PALETTE[(index - 1) % PALETTE.length]!,
    ...(index === 0 ? { target: true } : {}),
  }));
  return { id, worldId: id <= 5 ? 'city' : id <= 10 ? 'coast' : 'night', name, brief, vehicles, par };
}

// Original fixed layouts. Pars include the final slide out of the board and are
// verified by exhaustive breadth-first search in traffic-core.test.ts.
export const LEVELS: Level[] = [
  puzzle(1, 'Premier départ', 'Libérez la voie de votre petite voiture rouge.', 3, [
    ['R', 2, 2, 2, 'h'],
    ['A', 4, 2, 2, 'v'],
    ['B', 5, 1, 2, 'v'],
  ]),
  puzzle(2, 'Double file', 'Un véhicule long a besoin de place pour descendre.', 4, [
    ['R', 2, 2, 2, 'h'],
    ['A', 5, 1, 3, 'v'],
    ['B', 4, 4, 2, 'h'],
    ['C', 4, 5, 2, 'h'],
  ]),
  puzzle(3, 'L’effet domino', 'Préparez les déplacements dans le bon ordre.', 5, [
    ['R', 1, 2, 2, 'h'],
    ['A', 4, 4, 2, 'h'],
    ['B', 5, 1, 3, 'v'],
    ['C', 3, 2, 2, 'v'],
    ['D', 4, 2, 2, 'v'],
  ]),
  puzzle(4, 'Une place de plus', 'La voiture rouge peut aussi aider à faire de la place.', 6, [
    ['R', 0, 2, 2, 'h'],
    ['A', 1, 4, 2, 'h'],
    ['B', 4, 1, 3, 'v'],
    ['C', 0, 4, 2, 'v'],
    ['D', 4, 4, 2, 'h'],
  ]),
  puzzle(5, 'Le grand carrefour', 'Un carrefour se débloque parfois en avançant un peu.', 7, [
    ['R', 0, 2, 2, 'h'],
    ['A', 3, 0, 3, 'v'],
    ['B', 1, 4, 3, 'h'],
    ['C', 2, 3, 2, 'h'],
    ['D', 0, 3, 2, 'v'],
    ['E', 4, 2, 3, 'v'],
  ]),
  puzzle(6, 'Marée montante', 'Le bon passage demande quelques allers-retours.', 8, [
    ['R', 1, 2, 2, 'h'],
    ['A', 3, 5, 2, 'h'],
    ['B', 2, 4, 2, 'v'],
    ['C', 1, 3, 3, 'h'],
    ['D', 4, 2, 3, 'v'],
  ]),
  puzzle(7, 'Station balnéaire', 'Chaque place libérée peut servir à un autre véhicule.', 9, [
    ['R', 1, 2, 2, 'h'],
    ['A', 0, 1, 2, 'v'],
    ['B', 4, 2, 3, 'v'],
    ['C', 2, 3, 3, 'v'],
    ['D', 1, 4, 2, 'v'],
    ['E', 3, 5, 2, 'h'],
    ['F', 3, 2, 2, 'v'],
  ]),
  puzzle(8, 'Le détour des docks', 'Ouvrez un détour avant de dégager la sortie.', 10, [
    ['R', 0, 2, 2, 'h'],
    ['A', 4, 2, 3, 'v'],
    ['B', 2, 1, 2, 'v'],
    ['C', 2, 4, 2, 'v'],
    ['D', 4, 5, 2, 'h'],
    ['E', 3, 3, 2, 'v'],
    ['F', 0, 3, 3, 'h'],
  ]),
  puzzle(9, 'Chassé-croisé', 'Une position utile peut devenir gênante au coup suivant.', 11, [
    ['R', 0, 2, 2, 'h'],
    ['A', 5, 1, 3, 'v'],
    ['B', 2, 2, 2, 'v'],
    ['C', 2, 0, 3, 'h'],
    ['D', 1, 4, 2, 'h'],
    ['E', 4, 1, 2, 'v'],
    ['F', 0, 3, 2, 'v'],
    ['G', 4, 3, 2, 'v'],
  ]),
  puzzle(10, 'Dernier ferry', 'Anticipez les mouvements à gauche comme à droite.', 13, [
    ['R', 2, 2, 2, 'h'],
    ['A', 2, 0, 2, 'h'],
    ['B', 1, 4, 2, 'v'],
    ['C', 2, 5, 3, 'h'],
    ['D', 4, 4, 2, 'h'],
    ['E', 1, 2, 2, 'v'],
    ['F', 0, 1, 2, 'h'],
    ['G', 0, 2, 2, 'v'],
    ['H', 2, 3, 2, 'v'],
    ['I', 4, 1, 3, 'v'],
  ]),
  puzzle(11, 'Sous les néons', 'Des couloirs étroits cachent une chaîne de déplacements.', 14, [
    ['R', 0, 2, 2, 'h'],
    ['A', 3, 4, 2, 'h'],
    ['B', 2, 0, 2, 'v'],
    ['C', 5, 0, 2, 'v'],
    ['D', 2, 3, 2, 'v'],
    ['E', 4, 0, 3, 'v'],
    ['F', 3, 2, 2, 'v'],
    ['G', 1, 3, 2, 'v'],
    ['H', 5, 4, 2, 'v'],
    ['I', 3, 0, 2, 'v'],
  ]),
  puzzle(12, 'Les faux départs', 'Un premier passage ne sera peut-être que temporaire.', 15, [
    ['R', 0, 2, 2, 'h'],
    ['A', 2, 1, 3, 'v'],
    ['B', 1, 4, 3, 'h'],
    ['C', 3, 0, 2, 'v'],
    ['D', 4, 1, 2, 'h'],
    ['E', 4, 5, 2, 'h'],
    ['F', 5, 2, 3, 'v'],
    ['G', 3, 3, 2, 'h'],
  ]),
  puzzle(13, 'Quartier verrouillé', 'Coordonnez toute la grille pour retrouver la sortie.', 18, [
    ['R', 1, 2, 2, 'h'],
    ['A', 4, 0, 3, 'v'],
    ['B', 1, 0, 2, 'h'],
    ['C', 3, 2, 2, 'v'],
    ['D', 0, 1, 3, 'v'],
    ['E', 3, 5, 2, 'h'],
    ['F', 5, 1, 2, 'v'],
    ['G', 3, 4, 2, 'h'],
    ['H', 1, 1, 2, 'h'],
    ['I', 0, 5, 2, 'h'],
    ['J', 1, 3, 2, 'h'],
    ['K', 2, 4, 2, 'v'],
  ]),
  puzzle(14, 'L’heure de pointe', 'Faites circuler les espaces libres dans le quartier.', 21, [
    ['R', 0, 2, 2, 'h'],
    ['A', 1, 1, 2, 'h'],
    ['B', 3, 1, 2, 'v'],
    ['C', 2, 2, 2, 'v'],
    ['D', 4, 0, 3, 'v'],
    ['E', 0, 5, 2, 'h'],
    ['F', 3, 3, 2, 'h'],
    ['G', 3, 5, 2, 'h'],
    ['H', 2, 4, 2, 'h'],
    ['I', 0, 0, 3, 'h'],
    ['J', 1, 3, 2, 'v'],
  ]),
  puzzle(15, "Sortie de nuit", "Le dernier embouteillage demande de voir plusieurs coups plus loin.", 22, [
    ['R', 1, 2, 2, 'h'],
    ['A', 0, 4, 3, 'h'],
    ['B', 3, 4, 2, 'v'],
    ['C', 4, 3, 2, 'v'],
    ['D', 0, 0, 2, 'v'],
    ['E', 4, 0, 2, 'h'],
    ['F', 2, 0, 2, 'v'],
    ['G', 4, 1, 2, 'v'],
    ['H', 5, 1, 2, 'v'],
    ['I', 3, 0, 2, 'v'],
  ]),
];
