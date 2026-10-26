import type { Source } from './types';

export const MAP_SOURCES: Source[] = [{
  id: 'natural-earth-madagascar', title: 'Natural Earth — côtes de Madagascar, 1:10m',
  author: 'Natural Earth, Tom Patterson, Nathaniel Vaughn Kelso et contributeurs',
  url: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
  category: 'geography', consulted: true, date: 'Consulté le 25 octobre 2026',
  supports: 'Contour réel de Madagascar, Nosy Be et Sainte-Marie extrait du GeoJSON Admin 0 – Countries du dépôt officiel natural-earth-vector. Géométrie simplifiée localement ; côtes et destinations utilisent la même projection. Les repères de ville restent approximatifs et les petits décalages de pastilles sont reliés à leur point géographique.',
  license: 'Données dans le domaine public ; modification et redistribution autorisées. Conditions consultées : https://www.naturalearthdata.com/about/terms-of-use/. Habillage, relief décoratif, personnages et graphisme créés pour Afterhours.',
}];
