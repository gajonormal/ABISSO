import { fishGene, sanitize, aquarium } from './genes.js';

export function specimen(seed, index = 0, kind) {

  return fishGene(String(seed), index, kind);
}

export function encodeSpecimen(seed, gene) {

  return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, seed: String(seed), gene }))));
}

export function decodeSpecimen(value) {

  if (typeof value !== 'string' || value.length > 30000) throw Error('Invalid specimen link.');
  const data = JSON.parse(decodeURIComponent(escape(atob(value))));

  if (data.v !== 1 || !data.gene) throw Error('Invalid specimen link.');
  const seed = String(data.seed || 'maré').slice(0, 64);
  const gene = sanitize({
    ...aquarium(seed, 1),
    fish: [data.gene],
    nextId: (data.gene.id ?? 0) + 1,
  }).fish[0];
  
  return { seed, gene };
}
