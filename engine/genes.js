import { environment } from './ecology.js';
import { normalizePedigree } from './genealogy.js';
import { RARE_FINISHES, rollRareFinish } from './rare-finishes.js';

export const VARIANTS = {
  ordinary: 'Classic',
  veil: 'Veil',
  luminousEyes: 'Glowing eyes',
  mosaic: 'Mosaic',
  asymmetric: 'Asymmetric',
};

export const SHELLS = {
  spiral: 'Spiral shell',
  conical: 'Conical shell',
  dome: 'Domed shell',
  stone: 'Stone shell',
  scallop: 'Scallop shell',
};

export const EYES = {
  round: 'Round',
  oval: 'Oval',
  slit: 'Vertical pupil',
  cross: 'Cross pupil',
  ring: 'Ring iris',
  compound: 'Compound eyes',
};

export const MOUTHS = {
  native: 'Species default',
  round: 'Round',
  wide: 'Wide',
  vertical: 'Vertical',
  sucker: 'Sucker',
};

export const FINS = {
  native: 'Species default',
  rounded: 'Rounded',
  scalloped: 'Scalloped',
  spiky: 'Spiky',
  veil: 'Long veils',
};

export function compatibleEyeStyles(species) {

  return ['jellyfish', 'shrimp'].includes(species) ? ['round'] : Object.keys(EYES);
}

export function compatibleMouthStyles(species) {

  return special.includes(species)
    ? ['native']
    : species === 'gar'
      ? ['native', 'round', 'wide']
      : Object.keys(MOUTHS);
}

export function compatibleFinStyles(species) {

  return special.includes(species) || species === 'blobfish' ? ['native'] : Object.keys(FINS);
}

export const MUTATIONS = {
  none: 'None',
  spines: 'Spines',
  antenna: 'Glowing antennae',
  splitTail: 'Split tail',
  ribbon: 'Ribbon appendages',
  crystal: 'Crystals',
  twist: 'Gentle twist',
  melt: 'Fluid form',
  extraEyes: 'Multiple eyes',
  giantSpines: 'Giant spines',
  fangs: 'Fanged jaw',
  tendrils: 'Facial tendrils',
  horns: 'Curved horns',
};

Object.assign(MUTATIONS, {
  eyeStalks: 'Eye stalks',
  finFilaments: 'Fin filaments',
  frill: 'Branching gills',
});

export const EFFECTS = {
  natural: 'Natural',
  glow: 'Bioluminescent',
  rainbow: 'Rainbow',
  pearl: 'Iridescent',
  albino: 'Albino (Rare)',
  melanistic: 'Melanistic (Rare)',
  golden: 'Celestial gold',
  cosmic: 'Cosmic (Legendary)',
};

export const FINISHES = {
  matte: 'Natural',
  glow: 'Pulsing lights',
  rainbow: 'Flowing rainbow',
  pearl: 'Pearl',
  shimmer: 'Shimmering scales',
  glass: 'Translucent',
  constellation: 'Constellation',
  wet: 'Wet sheen',
  hologram: 'Holographic',
  oil: 'Oil slick',
  plasma: 'Living plasma',
};

Object.assign(FINISHES, RARE_FINISHES);

export function finishIndex(finish) {

  const index = Object.keys(FINISHES).indexOf(finish);

  return index < 0 ? 0 : index >= 8 ? index + 1 : index;
}

export const TEMPERAMENTS = {
  curious: 'Curious',
  shy: 'Shy',
  social: 'Schooling',
  territorial: 'Territorial',
  calm: 'Calm',
};

export const TRAITS = {
  bodyHeight: [0.82, 1.18, 1],
  bodyWidth: [0.82, 1.18, 1],
  tailLength: [0.8, 1.2, 1],
  mouthSize: [0.7, 1.3, 1],
  patternScale: [0.7, 1.5, 1],
  intensity: [0, 1, 0.55],
  clawSize: [0.65, 1.5, 1],
  antennaLength: [0.65, 1.5, 1],
  shellSpire: [0.7, 1.35, 1],
  mutationSize: [0.7, 1.8, 1],
  eyePairs: [1, 4, 2],
};

export const defaultFinish = (effect) =>
  ({
    glow: 'glow',
    rainbow: 'rainbow',
    pearl: 'pearl',
    cosmic: 'constellation',
    golden: 'shimmer',
  })[effect] || 'matte';

const special = [
  'seahorse',
  'ray',
  'jellyfish',
  'shrimp',
  'snail',
  'crab',
  'swordfish',
  'monkfish',
];

export function compatibleShapes(species) {

  return special.includes(species)
    ? [PROFILES[species].shape]
    : ['oval', 'round', 'slender', 'diamond', 'radiant'];
}

export function compatibleTails(species) {

  return special.includes(species) ? [PROFILES[species].tail] : ['fork', 'fan', 'round', 'feather'];
}

function extraGenes(seed, id, species, effect) {

  const r = rng(hash(seed + ':details:' + id));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const details = Object.fromEntries(

    Object.entries(TRAITS).map(([key, [lo, hi]]) => [key, lo + r() * (hi - lo)]),
  );

  details.eyePairs = Math.round(details.eyePairs);

  const faceR = rng(hash(seed + ':morphology:' + id)),
    facePick = (a) => a[Math.floor(faceR() * a.length)];

  const morphology = {
    eyeStyle: faceR() < 0.55 ? 'round' : facePick(compatibleEyeStyles(species)),
    mouthStyle: faceR() < 0.6 ? 'native' : facePick(compatibleMouthStyles(species)),
    finStyle: faceR() < 0.55 ? 'native' : facePick(compatibleFinStyles(species)),
  };

  return {
    ...details,
    ...morphology,
    eyeColor: pick([
      '#202039',
      '#284e69',
      '#59682c',
      '#743e65',
      '#8a5529',
      '#bb6937',
      '#59b7bf',
      '#bd6eb7',
    ]),

    shape: r() < 0.7 ? PROFILES[species].shape : pick(compatibleShapes(species)),
    tail: r() < 0.6 ? PROFILES[species].tail : pick(compatibleTails(species)),
    temperament: pick(
      species === 'jellyfish'
        ? ['calm']
        : species === 'neon'
          ? ['social', 'shy']
          : Object.keys(TEMPERAMENTS),
    ),
    finish:
      rollRareFinish(rng(hash(seed + ':rare-finish:' + id))) ||
      (r() < 0.12
        ? pick(['wet', 'hologram', 'oil', 'plasma'])
        : effect !== 'natural'
          ? defaultFinish(effect)
          : pick(['matte', 'matte', 'matte', 'shimmer', 'pearl', 'glass'])),
    shellType: species === 'snail' ? pick(Object.keys(SHELLS)) : 'spiral',
    shellColor: pick(['#b9aa8a', '#abb6bd', '#c9a9bc', '#d9b176', '#94aca3']),
  };
}

export const PATTERNS = {
  plain: 'Plain',
  stripes: 'Stripes',
  spots: 'Spots',
  voronoi: 'Leopard',
  scales: 'Scales',
  counter: 'Gradient',
};

export const SHAPES = {
  oval: 'Oval',
  round: 'Round',
  slender: 'Slender',
  diamond: 'Disc',
  vertical: 'Vertical',
  flat: 'Flat',
  bell: 'Bell',
  radiant: 'Radiant',
};

export const SPECIES = {
  goldfish: 'Goldfish',
  angel: 'Angelfish',
  puffer: 'Pufferfish',
  betta: 'Betta',
  neon: 'Neon',
  discus: 'Discus',
  eel: 'Eel',
  catfish: 'Catfish',
  seahorse: 'Seahorse',
  ray: 'Ray',
  jellyfish: 'Jellyfish',
  lionfish: 'Lionfish',
  shrimp: 'Shrimp',
  snail: 'Snail',
  crab: 'Crab',
  angler: 'Deep-sea anglerfish',
  ribbonfish: 'Ribbonfish',
  gar: 'Gar',
  blobfish: 'Blobfish',
  flyingfish: 'Flying fish',
  swordfish: 'Swordfish',
  monkfish: 'Monkfish',
};

export const PROFILES = {
  swordfish: {
    shape: 'slender',
    tail: 'fork',
    pattern: ['counter', 'scales', 'plain'],
    palettes: [
      ['#56758f', '#c5d5d6'],
      ['#647caa', '#c8d4e5'],
    ],
    scale: [0.85, 1.15],
    speed: [0.6, 0.9],
    tier: 'mid',
  },
  monkfish: {
    shape: 'flat',
    tail: 'round',
    pattern: ['spots', 'voronoi', 'counter'],
    palettes: [
      ['#8c8260', '#d5c6a1'],
      ['#727c63', '#c3c8a0'],
      ['#8c6d61', '#d2b4a1'],
    ],
    scale: [0.8, 1.15],
    speed: [0.18, 0.32],
    tier: 'bottom',
  },
  gar: {
    shape: 'slender',
    tail: 'round',
    pattern: ['scales', 'spots', 'counter'],
    palettes: [
      ['#8c8656', '#d4c396'],
      ['#697c66', '#c7c69a'],
    ],
    scale: [0.75, 1.1],
    speed: [0.3, 0.5],
    tier: 'mid',
  },
  blobfish: {
    shape: 'round',
    tail: 'round',
    pattern: ['plain', 'counter', 'spots'],
    palettes: [
      ['#d79eaf', '#f5ccd2'],
      ['#c1a3bc', '#e8d0de'],
    ],
    scale: [0.75, 1.1],
    speed: [0.18, 0.28],
    tier: 'bottom',
  },
  flyingfish: {
    shape: 'slender',
    tail: 'fork',
    pattern: ['counter', 'scales', 'stripes'],
    palettes: [
      ['#5586ba', '#d2e8ef'],
      ['#709a9d', '#c8e0c8'],
    ],
    scale: [0.65, 0.95],
    speed: [0.5, 0.8],
    tier: 'surface',
  },
  angler: {
    shape: 'round',
    tail: 'round',
    pattern: ['spots', 'voronoi', 'counter'],
    palettes: [
      ['#675887', '#b7dcec'],
      ['#8a535e', '#f3bba0'],
      ['#314e66', '#82e6da'],
    ],
    scale: [0.8, 1.15],
    speed: [0.25, 0.45],
    tier: 'bottom',
  },
  ribbonfish: {
    shape: 'slender',
    tail: 'feather',
    pattern: ['stripes', 'scales', 'counter'],
    palettes: [
      ['#759daa', '#e0eef1'],
      ['#ba6b9e', '#f3c4df'],
    ],
    scale: [0.7, 1.1],
    speed: [0.35, 0.6],
    tier: 'mid',
  },
  shrimp: {
    shape: 'slender',
    tail: 'fan',
    pattern: ['stripes', 'spots'],
    palettes: [
      ['#ef9c99', '#f9d8b4'],
      ['#81baba', '#cef7dc'],
    ],
    scale: [0.65, 0.9],
    speed: [0.18, 0.32],
    tier: 'bottom',
  },
  snail: {
    shape: 'round',
    tail: 'round',
    pattern: ['stripes', 'voronoi'],
    palettes: [
      ['#c5a27b', '#f4d8aa'],
      ['#9692bb', '#d9cbe8'],
    ],
    scale: [0.65, 0.95],
    speed: [0.15, 0.22],
    tier: 'bottom',
  },
  crab: {
    shape: 'flat',
    tail: 'round',
    pattern: ['spots', 'counter'],
    palettes: [
      ['#dc8672', '#f4c99c'],
      ['#87a9b8', '#cfeced'],
    ],
    scale: [0.7, 1],
    speed: [0.2, 0.36],
    tier: 'bottom',
  },
  goldfish: {
    shape: 'oval',
    tail: 'fork',
    pattern: ['plain', 'spots', 'scales'],
    palettes: [
      ['#f39b53', '#ffe1a0'],
      ['#e78e77', '#ffd8ba'],
      ['#d85b38', '#fff3e1'],
    ],
    scale: [0.75, 1.15],
    speed: [0.4, 0.7],
    tier: 'school',
  },
  angel: {
    shape: 'diamond',
    tail: 'fork',
    pattern: ['stripes', 'counter'],
    palettes: [
      ['#9eafca', '#e4e4eb'],
      ['#c1a6ce', '#efe0c2'],
      ['#4d5966', '#a2bed9'],
    ],
    scale: [0.8, 1.15],
    speed: [0.35, 0.6],
    tier: 'mid',
  },
  puffer: {
    shape: 'round',
    tail: 'round',
    pattern: ['spots', 'voronoi'],
    palettes: [
      ['#c6b771', '#f3e4b0'],
      ['#8eb69b', '#d9e7b2'],
      ['#df9f68', '#fff1d6'],
    ],
    scale: [0.85, 1.25],
    speed: [0.28, 0.48],
    tier: 'mid',
  },
  betta: {
    shape: 'oval',
    tail: 'fan',
    pattern: ['plain', 'stripes', 'scales'],
    palettes: [
      ['#817bd4', '#dca3df'],
      ['#61aab1', '#aae6df'],
      ['#d77898', '#f4bacb'],
      ['#345995', '#eac435'],
    ],
    scale: [0.7, 1.1],
    speed: [0.3, 0.6],
    tier: 'plant',
  },
  neon: {
    shape: 'slender',
    tail: 'fork',
    pattern: ['stripes', 'counter'],
    palettes: [
      ['#478fc3', '#8fe6e5'],
      ['#637bc2', '#aecced'],
      ['#2386c8', '#ff4d6d'],
    ],
    scale: [0.6, 0.82],
    speed: [0.65, 1.1],
    tier: 'school',
  },
  discus: {
    shape: 'diamond',
    tail: 'round',
    pattern: ['stripes', 'spots', 'scales'],
    palettes: [
      ['#e6a16d', '#f9d898'],
      ['#73b4b4', '#cae6c4'],
      ['#bd8bc7', '#ecd2e5'],
    ],
    scale: [0.8, 1.2],
    speed: [0.33, 0.58],
    tier: 'mid',
  },
  eel: {
    shape: 'slender',
    tail: 'round',
    pattern: ['plain', 'spots', 'voronoi'],
    palettes: [
      ['#819e88', '#cee0ae'],
      ['#9485b5', '#d6c6e8'],
      ['#a89976', '#e5dcbb'],
    ],
    scale: [0.65, 1.0],
    speed: [0.4, 0.7],
    tier: 'bottom',
  },
  catfish: {
    shape: 'oval',
    tail: 'fork',
    pattern: ['plain', 'spots', 'voronoi'],
    palettes: [
      ['#8298a4', '#cfddd9'],
      ['#a69385', '#e3d5b7'],
      ['#685f57', '#c0b4a7'],
    ],
    scale: [0.7, 1.0],
    speed: [0.28, 0.52],
    tier: 'bottom',
  },
  seahorse: {
    shape: 'vertical',
    tail: 'spiral',
    pattern: ['plain', 'spots', 'counter'],
    palettes: [
      ['#e79b5c', '#ffe0a3'],
      ['#dc728a', '#ffd7e2'],
      ['#8eb87f', '#e6f4cf'],
      ['#d89c67', '#faedd8'],
    ],
    scale: [0.7, 1.05],
    speed: [0.22, 0.38],
    tier: 'plant',
  },
  ray: {
    shape: 'flat',
    tail: 'whip',
    pattern: ['spots', 'voronoi', 'counter'],
    palettes: [
      ['#62737d', '#b1c6d1'],
      ['#82624b', '#e1c6a6'],
      ['#43485f', '#96b8a8'],
      ['#36444d', '#7aa1ad'],
    ],
    scale: [0.85, 1.28],
    speed: [0.32, 0.6],
    tier: 'bottom',
  },
  jellyfish: {
    shape: 'bell',
    tail: 'tentacle',
    pattern: ['plain', 'counter', 'stripes'],
    palettes: [
      ['#c070f7', '#ebc4ff'],
      ['#5ec4ee', '#c5f3ff'],
      ['#ff8cb3', '#fff0bc'],
      ['#5fe8c7', '#afffed'],
    ],
    scale: [0.68, 1.1],
    speed: [0.18, 0.36],
    tier: 'drift',
  },
  lionfish: {
    shape: 'radiant',
    tail: 'feather',
    pattern: ['stripes', 'voronoi'],
    palettes: [
      ['#bf4342', '#f3d2be'],
      ['#993444', '#f1dfdc'],
      ['#a3532c', '#fedbb4'],
      ['#6a3c78', '#f5c66b'],
    ],
    scale: [0.8, 1.2],
    speed: [0.28, 0.5],
    tier: 'mid',
  },
};

export function hash(value) {
  let n = 2166136261;

  for (const c of String(value)) {
    n = Math.imul(n ^ c.codePointAt(0), 16777619);
  }

  return n >>> 0;
}

export function rng(seed) {
  let n = seed >>> 0;

  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ (n >>> 15), n | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fishGene(seed, index, kind) {

  if (kind === 'hammerhead') kind = 'goldfish';
  if (kind === 'tripod') kind = 'gar';

  const r = rng(hash(seed + ':fish:' + index)),
    pick = (a) => a[Math.floor(r() * a.length)];
  const speciesList = Object.keys(SPECIES);
  const species = Object.hasOwn(SPECIES, kind)
    ? kind
    : speciesList[(index + (hash(seed) % speciesList.length)) % speciesList.length];
  const profile = PROFILES[species] || PROFILES.goldfish;
  const palette = pick(profile.palettes);

  let effect = 'natural';
  const roll = r();

  if (roll < 0.003) effect = 'cosmic';
  else if (roll < 0.009) effect = 'golden';
  else if (roll < 0.02) effect = 'melanistic';
  else if (roll < 0.035) effect = 'albino';
  else if (roll < 0.09) effect = 'rainbow';
  else if (roll < 0.17) effect = 'pearl';
  else if (roll < 0.28) effect = 'glow';

  if (index === 0 && r() < 0.3) effect = 'pearl';
  if (index === 1 && r() < 0.3) effect = 'rainbow';
  if (index === 3 && r() < 0.3) effect = 'glow';

  return {
    id: index,
    name:
      ({ shrimp: 'Shrimp', snail: 'Snail', crab: 'Crab' }[species] || 'Fish') +
      ' ' +
      String(index + 1).padStart(2, '0'),
    species,
    shape: profile.shape,
    tail: profile.tail,
    pattern: pick(profile.pattern),
    color: palette[0],
    accent: palette[1],
    effect,
    scale: profile.scale[0] + r() * (profile.scale[1] - profile.scale[0]),
    speed: profile.speed[0] + r() * (profile.speed[1] - profile.speed[0]),
    phase: r() * Math.PI * 2,
    finSize: 0.8 + r() * 0.4,
    bodyRatio: 0.9 + r() * 0.2,
    eyeSize: 0.85 + r() * 0.3,
    generation: 1,
    parents: null,
    pedigree: [],
    growth: 1,
    variant: r() < 0.08 ? pick(['veil', 'luminousEyes', 'mosaic', 'asymmetric']) : 'ordinary',
    mutation:
      r() < (special.includes(species) ? 0.12 : 0.38)
        ? pick(
            Object.keys(MUTATIONS).filter(
              (m) => m !== 'none' && (m !== 'splitTail' || !special.includes(species)),
            ),
          )
        : 'none',
    mutation2:
      !special.includes(species) && r() < 0.14
        ? pick([
            'extraEyes',
            'giantSpines',
            'fangs',
            'tendrils',
            'horns',
            'eyeStalks',
            'finFilaments',
            'frill',
          ])
        : 'none',
    ...extraGenes(seed, index, species, effect),
  };
}

export function aquarium(seed, count = 12) {

  return {
    version: 2,
    seed: String(seed).slice(0, 64),
    night: false,
    pixel: true,
    motion: true,
    environment: environment(),
    cycle: false,
    cyclePhase: 0,
    nextId: count,
    fish: Array.from({ length: count }, (_, i) => fishGene(String(seed), i)),
  };
}

export function sanitize(raw) {

  if (
    ![1, 2, 3].includes(raw?.version) ||
    !Array.isArray(raw.fish) ||
    raw.fish.length < 1 ||
    raw.fish.length > 32
  ) {
    throw Error('Invalid aquarium.');
  }

  const out = aquarium(typeof raw.seed === 'string' ? raw.seed : 'recife', 1);
  out.fish = [];
  const ids = new Set();
  const validTails = ['fork', 'fan', 'round', 'spiral', 'whip', 'tentacle', 'feather'];
  const validPatterns = Object.keys(PATTERNS);

  for (const f of raw.fish) {

    if (!Number.isInteger(f.id) || f.id < 0 || f.id > 1000000 || ids.has(f.id)) {
      throw Error('Invalid identifier.');
    }
    ids.add(f.id);
    const gene = fishGene(out.seed, f.id, f.species);

    for (const [key, [lo, hi, fallback]] of Object.entries(TRAITS))
      gene[key] = Number.isFinite(f[key]) ? Math.max(lo, Math.min(hi, f[key])) : fallback;
    gene.eyePairs = Math.round(gene.eyePairs);
    gene.finish =
      f.finish === 'ink'
        ? 'matte'
        : Object.hasOwn(FINISHES, f.finish)
          ? f.finish
          : defaultFinish(f.effect);
    gene.temperament = Object.hasOwn(TEMPERAMENTS, f.temperament) ? f.temperament : 'calm';
    gene.eyeColor = /^#[0-9a-f]{6}$/i.test(f.eyeColor) ? f.eyeColor : '#202039';

    for (const [key, values, fallback] of [
      ['eyeStyle', compatibleEyeStyles(gene.species), 'round'],
      ['mouthStyle', compatibleMouthStyles(gene.species), 'native'],
      ['finStyle', compatibleFinStyles(gene.species), 'native'],
    ])
      gene[key] = values.includes(f[key]) ? f[key] : fallback;
    gene.growth = Number.isFinite(f.growth) ? Math.max(0.35, Math.min(1, f.growth)) : 1;
    gene.variant = Object.hasOwn(VARIANTS, f.variant) ? f.variant : 'ordinary';
    gene.shellType = Object.hasOwn(SHELLS, f.shellType) ? f.shellType : 'spiral';
    gene.shellColor = /^#[0-9a-f]{6}$/i.test(f.shellColor)
      ? f.shellColor
      : /^#[0-9a-f]{6}$/i.test(f.color)
        ? f.color
        : gene.color;
    gene.mutation = Object.hasOwn(MUTATIONS, f.mutation) ? f.mutation : 'none';
    gene.mutation2 = Object.hasOwn(MUTATIONS, f.mutation2) ? f.mutation2 : 'none';
    gene.pedigree = normalizePedigree(f.pedigree);

    for (const key of ['shape', 'effect']) {

      if (Object.hasOwn(key === 'shape' ? SHAPES : EFFECTS, f[key])) gene[key] = f[key];
    }

    if (validTails.includes(f.tail)) gene.tail = f.tail;

    if (!compatibleShapes(gene.species).includes(gene.shape))
      gene.shape = PROFILES[gene.species].shape;
    if (!compatibleTails(gene.species).includes(gene.tail)) gene.tail = PROFILES[gene.species].tail;

    if (validPatterns.includes(f.pattern)) gene.pattern = f.pattern;

    for (const key of ['color', 'accent']) {

      if (/^#[0-9a-f]{6}$/i.test(f[key])) gene[key] = f[key];
    }

    for (const [key, min, max] of [
      ['scale', 0.5, 1.6],
      ['speed', 0.15, 1.4],
      ['phase', 0, Math.PI * 2],
      ['finSize', 0.65, 1.4],
      ['bodyRatio', 0.8, 1.25],
      ['eyeSize', 0.7, 1.35],
    ]) {

      if (Number.isFinite(f[key])) gene[key] = Math.max(min, Math.min(max, f[key]));
    }
    if (typeof f.name === 'string') gene.name = f.name.slice(0, 30);
    if (typeof f.sourceSeed === 'string') gene.sourceSeed = f.sourceSeed.slice(0, 64);
    if (typeof f.collectionKey === 'string') gene.collectionKey = f.collectionKey.slice(0, 128);
    if (Number.isInteger(f.generation)) gene.generation = Math.max(1, f.generation);

    if (
      Array.isArray(f.parents) &&
      f.parents.length === 2 &&
      f.parents.every((id) => Number.isInteger(id) && id >= 0 && id <= 1000000)
    )
      gene.parents = [...f.parents];

    out.fish.push(gene);
  }

  out.nextId = Math.max(...ids) + 1;
  out.environment = environment(raw.environment);
  out.cycle = raw.cycle === true;
  out.cyclePhase = Number.isFinite(raw.cyclePhase)
    ? raw.cyclePhase >= 0 && raw.cyclePhase < 1
      ? raw.cyclePhase
      : ((raw.cyclePhase % 1) + 1) % 1
    : raw.night
      ? 0.5
      : 0;

  if (Number.isInteger(raw.nextId) && raw.nextId <= 1000000)
    out.nextId = Math.max(out.nextId, raw.nextId);

  for (const key of ['night', 'pixel', 'motion']) {
    
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }

  return out;
}
