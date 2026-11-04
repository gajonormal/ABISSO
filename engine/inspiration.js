import { hash, rng } from './genes.js';

const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

function fromPalette(palette) {
  const average = [0, 1, 2].map((i) =>
    palette.reduce((sum, color) => sum + rgb(color)[i], 0) / palette.length,
  );
  const [red, green, blue] = average;
  const dark = (red + green + blue) / 3 < 85;
  const garden = green > red * 1.12 && green > blue * 1.08;
  return {
    palette,
    environment: {
      theme: dark ? 'abyss' : garden ? 'garden' : 'reef',
      decoration: dark ? 'cave' : garden ? 'none' : 'coral',
      plants: dark ? 0.25 : garden ? 0.9 : 0.5,
      waterColor: hex(average.map((v) => v * 0.55 + 100)),
    },
  };
}

export function textInspiration(text) {
  const words = new Set(String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().split(/[^a-z0-9]+/));
  const groups = [
    { words: ['abismo', 'abyss', 'noite', 'night', 'escuro', 'dark', 'profundo', 'deep'],
      palette: ['#253759', '#49699d', '#8c6bce'], theme: 'abyss', decoration: 'cave', plants: 0.2 },
    { words: ['floresta', 'forest', 'jardim', 'garden', 'verde', 'green', 'selva', 'jungle'],
      palette: ['#397754', '#83b85d', '#d5c989'], theme: 'garden', decoration: 'none', plants: 0.95 },
    { words: ['coral', 'recife', 'reef', 'tropical', 'tropico'],
      palette: ['#ed886c', '#e3c55b', '#53bdbb'], theme: 'reef', decoration: 'coral', plants: 0.5 },
    { words: ['gelo', 'ice', 'gelado', 'frozen', 'inverno', 'winter', 'azul', 'blue'],
      palette: ['#5c8fbf', '#9bd4e3', '#d5e8ed'], theme: 'reef', decoration: 'cave', plants: 0.2 },
    { words: ['sol', 'sun', 'sunset', 'fogo', 'fire', 'vermelho', 'red', 'laranja', 'orange'],
      palette: ['#de6651', '#efa94d', '#b95e8f'], theme: 'reef', decoration: 'mixed', plants: 0.4 },
    { words: ['roxo', 'purple', 'rosa', 'pink', 'sonho', 'dream'],
      palette: ['#ac76ce', '#e29bc5', '#829ddd'], theme: 'garden', decoration: 'mixed', plants: 0.75 },
  ];
  const matches = groups.filter((group) => group.words.some((word) => words.has(word)));
  if (matches.length) {
    const palette = [...new Set(matches.flatMap((group) => group.palette))];
    const { theme, decoration, plants } = matches[0];
    const result = fromPalette(palette);
    Object.assign(result.environment, { theme, decoration, plants });
    return result;
  }
  const r = rng(hash(String(text) + ':palette'));
  return fromPalette(Array.from({ length: 4 }, () => hex([0, 1, 2].map(() => 60 + r() * 175))));
}

export function imageInspiration(pixels) {
  const buckets = new Map();
  let signature = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    if (!alpha) continue;
    const channels = [pixels[i], pixels[i + 1], pixels[i + 2]];
    signature = (signature * 31 + channels[0] + channels[1] * 3 + channels[2] * 7 + pixels[i + 3]) >>> 0;
    const key = channels.map((v) => v >> 5).join(':');
    const bucket = buckets.get(key) || { weight: 0, sums: [0, 0, 0] };
    bucket.weight += alpha;
    channels.forEach((v, channel) => bucket.sums[channel] += v * alpha);
    buckets.set(key, bucket);
  }
  const palette = [...buckets.values()].sort((a, b) => b.weight - a.weight).slice(0, 6)
    .map(({ weight, sums }) => hex(sums.map((v) => v / weight)));
  if (!palette.length) throw Error('Choose an image with visible pixels.');
  return { seed: String(signature), inspiration: fromPalette(palette) };
}
