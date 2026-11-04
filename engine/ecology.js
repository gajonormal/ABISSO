export const THEMES = { reef: 'Tropical reef', abyss: 'Deep sea', garden: 'Jellyfish garden' };
export const FORMATS = { classic: 'Classic', panorama: 'Panoramic', tall: 'Vertical' };

export const DECORATIONS = {
  mixed: 'Corals and cave',
  coral: 'Corals',
  cave: 'Cave',
  none: 'Plants and sand only',
};

export const TANK_SIZES = {
  classic: [7.1, 4, 4.4],
  panorama: [8.4, 3.7, 3.8],
  tall: [5.8, 5.1, 4.6],
};

export function environment(raw = {}) {
  return {
    theme: Object.hasOwn(THEMES, raw.theme) ? raw.theme : 'reef',
    format: Object.hasOwn(FORMATS, raw.format) ? raw.format : 'classic',
    decoration: Object.hasOwn(DECORATIONS, raw.decoration) ? raw.decoration : 'mixed',
    plants: Number.isFinite(raw.plants) ? Math.max(0, Math.min(1, raw.plants)) : 0.65,
    waterColor: /^#[0-9a-f]{6}$/i.test(raw.waterColor) ? raw.waterColor : '#91c5ea',
  };
}

export function advanceGrowth(growth = 1, dt = 0) {

  return Math.min(1, Math.max(0.35, growth) + Math.max(0, dt) / 600);
}

export function growthScale(growth = 1) {

  return 0.45 + (0.55 * (Math.max(0.35, Math.min(1, growth)) - 0.35)) / 0.65;
}

export function foodPreference(fish, position, food) {
  const hunger = fish.motion.hunger ?? 0.6;
  const radius =
    fish.gene.temperament === 'shy' ? 2.2 : fish.gene.temperament === 'curious' ? 4.5 : 3.5;
  let nearest = null,
    best = radius;

  for (const pellet of food) {
    const distance = position.distanceTo(pellet.position);

    if (distance < best && hunger > 0.12) {
      nearest = pellet;
      best = distance;
    }
  }

  return nearest;

}

export function aquariumCapacity(format) {
  const [width, , depth] = TANK_SIZES[format] || TANK_SIZES.classic;
  
  return Math.max(2, Math.min(32, Math.round((width * depth * (width / 7.1)) / 3.1)));
}
