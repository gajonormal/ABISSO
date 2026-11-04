import { aquarium, fishGene, hash, rng, SPECIES, sanitize } from './genes.js';
import { THEMES, FORMATS, DECORATIONS, aquariumCapacity } from './ecology.js';

export function randomAquarium(seed, { inhabitant = null, count = null } = {}) {

  const r = rng(hash(String(seed) + ':habitat')),
    pick = (values) => values[Math.floor(r() * values.length)];

  const state = aquarium(seed, 1);
  const theme = pick(Object.keys(THEMES));

  const palettes = {
    reef: ['#91c5ea', '#79c8c3', '#9dc9d5'],
    abyss: ['#596f9c', '#557f91', '#706898'],
    garden: ['#b6a0d2', '#90c8c3', '#b1c6df'],
  };

  state.environment = {
    theme,
    format: pick(Object.keys(FORMATS)),
    decoration: pick(Object.keys(DECORATIONS)),
    plants: 0.15 + r() * 0.8,
    waterColor: pick(palettes[theme]),
  };

  const capacity = aquariumCapacity(state.environment.format),
    minimum = Math.ceil(capacity * 0.65);
  const population = Math.max(
    1,
    Math.min(
      capacity,
      count ?? (inhabitant ? 1 : minimum + Math.floor(r() * (capacity - minimum + 1))),
    ),
  );

  state.night = r() < (theme === 'abyss' ? 0.8 : 0.4);
  state.cycle = false;
  state.cyclePhase = r();
  const species = Object.keys(SPECIES),
    firstId = inhabitant ? inhabitant.id + 1 : 0;
  state.fish = Array.from({ length: population }, (_, i) =>
    inhabitant && i === 0
      ? structuredClone(inhabitant)
      : fishGene(String(seed) + ':residents', firstId + i, pick(species)),
  );
  state.nextId = Math.max(...state.fish.map((f) => f.id)) + 1;
  
  return sanitize(state);
}
