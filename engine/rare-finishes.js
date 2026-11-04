
export const RARE_FINISHES = {
  radioactive: 'Radioactive · rare',
  uranium: 'Uranium · rare',
  fluorescent: 'Fluorescent · rare',
  scintillating: 'Scintillating · rare',
  aurora: 'Aurora · rare',
  circuit: 'Living circuit · rare',
  magma: 'Magma · rare',
  chromatophores: 'Chromatophores · rare',
  phosphorescent: 'Phosphorescent · rare',
  prism: 'Prismatic crystal · rare',
  storm: 'Electric storm · rare',
};

export const RARE_FINISH_CHANCE = 0.03;
const weights = [3, 2, 4, 4, 3, 2, 2, 4, 3, 2, 1];

export function rollRareFinish(random) {

  if (random() >= RARE_FINISH_CHANCE) return null;
  let roll = random() * 30;

  for (const [i, key] of Object.keys(RARE_FINISHES).entries()) {
    roll -= weights[i];

    if (roll < 0) return key;
  }

  return 'storm';
}

export const rareFinishShader = `
if (uFinish > 11.5) {
  float individuality = fract(sin(uPhase * 91.73) * 43758.5453);
  float clock = uTime * (.55 + individuality * .9) + uPhase;
  vec2 q = vec2(vSkin.x / max(.08, uLength), (vSkin.y + vSkin.z * .4) / max(.05, uHeight));
  q *= uPatternScale * (1.0 + individuality * .25);

  // Broad motifs and a small palette remain readable at aquarium pixel resolution.
  float nightBoost = .75 + uNight * .45;
  float formLight = .55 + light * .45;
  float breath = .5 + .5 * sin(clock * 1.2);
  vec3 rareColor = color;
  vec3 emission = vec3(0.0);
  float emissionMask = 0.0;
  if (uFinish < 12.5) { // Radiativo: a simple green breathing glow.
    rareColor = vec3(.22, .85, .055) * formLight * (.65 + breath * .45) * nightBoost;
    emission = vec3(.22, 1.0, .055);
    emissionMask = .55 + breath * .45;
  } else if (uFinish < 13.5) { // Urânio: a few broad mineral patches.
    float mineral = step(.15, sin(q.x * 2.5 + sin(q.y * 2.0)) + cos(q.y * 2.8));
    rareColor = mix(vec3(.14, .25, .065), vec3(.48, .82, .08), mineral) * formLight *
                (.8 + breath * .25) * nightBoost;
    emission = vec3(.48, 1.0, .08);
    emissionMask = mineral * (.6 + breath * .4);
  } else if (uFinish < 14.5) { // Fluorescente: one luminous palette, slowly changing hue.
    vec3 neon = mix(vec3(.12, .8, .75), vec3(.9, .2, .65),
                    .5 + .5 * sin(clock * .25 + individuality * 6.0));
    rareColor = neon * formLight * (.85 + breath * .15) * nightBoost;
    emission = neon;
    emissionMask = .7 + breath * .3;
  } else if (uFinish < 15.5) { // Cintilante: a handful of broad twinkling patches.
    vec2 cell = floor(q * 2.5);
    float seed = fract(sin(dot(cell, vec2(12.9898, 78.233)) + uPhase) * 43758.5453);
    float flash = pow(max(0.0, sin(clock * .8 + seed * 12.0 + rim * 2.0)), 4.0);
    float facet = 1.0 - smoothstep(.22, .38, length(fract(q * 2.5) - .5));
    rareColor = color + (acc + vec3(.35)) * flash * facet * step(.5, seed) * .65 * nightBoost;
    emission = mix(acc, vec3(.65, .85, 1.0), .5);
    emissionMask = flash * facet * step(.5, seed);
  } else if (uFinish < 16.5) { // Aurora: a coherent mint-blue glow, with a slow, gentle drift.
    float drift = .5 + .5 * sin(clock * .28 + clamp(q.x, -1.0, 1.0) * .45);
    vec3 aurora = mix(vec3(.2, .7, .55), vec3(.25, .55, .8), drift);
    rareColor = mix(color, aurora * formLight, .45) + aurora * rim * .12;
    emission = aurora;
    emissionMask = .18 + rim * .65 + breath * .05;
  } else if (uFinish < 17.5) { // Circuito vivo: chunky lights along the body.
    float row = 1.0 - smoothstep(.2, .45, abs(q.y));
    float blocks = 1.0 - smoothstep(.28, .42, abs(fract(q.x * 2.0) - .5));
    float pulse = .5 + .5 * sin(floor(q.x * 2.0) * 1.3 + clock * (.8 + uActivity * .4));
    rareColor = color * .85 + vec3(.12, .85, .65) * row * blocks * pulse * .75 * nightBoost;
    emission = vec3(.12, 1.0, .65);
    emissionMask = row * blocks * (.2 + pulse * .8);
  } else if (uFinish < 18.5) { // Magma: large warm islands, without fine cracks.
    float islands = step(.1, sin(q.x * 2.8 + sin(q.y * 2.0)) + cos(q.y * 2.2));
    rareColor = mix(vec3(.25, .12, .12), vec3(.95, .27, .04), islands) * formLight *
                (.75 + breath * .3) * nightBoost;
    emission = vec3(1.0, .27, .04);
    emissionMask = islands * (.6 + breath * .4);
  } else if (uFinish < 19.5) { // Cromatóforos: expanding and contracting pigment cells.
    vec2 cell = floor(q * 1.6);
    float seed = fract(sin(dot(cell, vec2(31.7, 19.1)) + uPhase) * 15731.7);
    float radius = .2 + .17 * (.5 + .5 * sin(clock * .5 + seed * 9.0));
    float pigmentMask = 1.0 - smoothstep(radius, radius + .08, length(fract(q * 1.6) - .5));
    vec3 pigment = mix(base, acc, .5 + .5 * sin(clock * .25 + seed * 4.0));
    rareColor = mix(color, pigment * formLight, pigmentMask);
  } else if (uFinish < 20.5) { // Fosforescente: quick activation, long afterglow.
    float age = mod(clock, 6.0);
    float afterglow = smoothstep(0.0, .15, age) * exp(-age * .65);
    rareColor = color + vec3(.18, .7, .48) * afterglow * formLight * .7 * nightBoost;
    emission = vec3(.18, .9, .48);
    emissionMask = afterglow;
  } else if (uFinish < 21.5) { // Cristal prismático: a broad pearly, angle-dependent tint.
    float shift = .5 + .5 * sin(rim * 3.0 + clock * .2 + individuality * 6.0);
    vec3 prism = mix(vec3(.4, .7, .85), vec3(.75, .4, .8), shift);
    rareColor = prism * formLight + vec3(.16) * rim * breath;
    emission = prism;
    emissionMask = .25 + rim * .5;
  } else { // Tempestade eléctrica: brief, irregular local discharges with quiet intervals.
    float event = floor(clock * .65);
    float seed = fract(sin(event * 73.1 + uPhase) * 43758.5453);
    float flash = smoothstep(0.0, .08, fract(clock * .65)) *
                  (1.0 - smoothstep(.12, .4, fract(clock * .65))) * step(.62, seed);
    float bolt = 1.0 - smoothstep(.12, .3, abs(q.y - sin(q.x * 3.0 + seed * 6.0) * .3));
    rareColor = color + vec3(.35, .55, .9) * bolt * flash * .75 * nightBoost;
    emission = vec3(.35, .55, 1.0);
    emissionMask = bolt * flash;
  }

  // HDR emission feeds the aquarium bloom (>1.05), without bleaching the daytime palette.
  // Only luminous motifs emit; chromatophores remain natural pigment.
  rareColor += emission * emissionMask * uNight * 3.2;

  // Radiativo replaces pigment with green; intensity still controls its strength.
  float finishBlend = uFinish < 12.5 ? min(1.0, uIntensity * 2.5) : uIntensity;
  color = mix(color, rareColor, finishBlend);
}
`;
