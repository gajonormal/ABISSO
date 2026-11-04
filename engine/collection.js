import { aquarium, sanitize } from './genes.js';

export function sanitizeCollection(raw) {
  
  if (
    !['mare-collection', 'abisso-collection'].includes(raw?.type) ||
    raw.version !== 1 ||
    !Array.isArray(raw.fish) ||
    raw.fish.length > 64
  )
    throw Error('Invalid collection.');
  const keys = new Set();

  return {
    type: 'mare-collection',
    version: 1,
    fish: raw.fish.map((entry) => {

      if (typeof entry.key !== 'string' || entry.key.length > 128 || keys.has(entry.key))
        throw Error('Invalid identifier.');
      keys.add(entry.key);
      const seed = typeof entry.seed === 'string' ? entry.seed.slice(0, 64) : 'coleção';
      const gene = sanitize({ ...aquarium(seed, 1), fish: [entry.gene] }).fish[0];
      
      return { key: entry.key, seed, gene };
    }),
  };
}
