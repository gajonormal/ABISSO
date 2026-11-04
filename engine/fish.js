import { neonEyePosition, bindNeonEyes } from './neon-eyes.js';
import * as T from './vendor/three.module.js';
import { hash, rng, PROFILES, finishIndex, defaultFinish } from './genes.js';
import { growthScale, foodPreference } from './ecology.js';
import { buildInvertebrate, animateInvertebrate } from './invertebrates.js';
import { groundShrimpFeet } from './shrimp.js';
import { buildMonsterTraits, animateMonsterTrait } from './monsters.js';
import { buildFishHead, animateFishMouth } from './mouth.js';
import { applyEyeStyles, finOutline } from './morphology.js';
import {
  buildUnusualFish,
  buildBlobTails,
  advanceFlyingFish,
  animateUnusualFish,
  bindBlobFish,
} from './unusual-fish.js';

import { buildJellyfish } from './jellyfish.js';
import { buildSeahorse, animateSeahorse } from './seahorse.js';
import { buildPredatorDetails } from './predators.js';
import { bindMutations, animateMutation } from './mutation-bindings.js';
import { CRAWLERS, obstacleForce, resolveObstacles } from './behavior.js';
import { rareFinishShader } from './rare-finishes.js';
import { buildAngelFins, buildBettaTail, buildBettaPectorals } from './angel-fins.js';
import { buildCaudalFin } from './caudal-fins.js';
import { buildBodySpines } from './body-spines.js';

const vertex = `
varying vec3 vP;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vSkin;
varying vec3 vView;

uniform float uTime;
uniform float uPhase;
uniform float uBend;
uniform float uSwimPace;
uniform float uSwimType; // 0=fish, 1=ray, 2=jelly, 3=seahorse, 4=eel
uniform float uLength;
uniform float uHeight;
uniform float uMutation;

#ifdef ANGEL_FIN
attribute float aFinFlex;
#endif

void main() {
  vec3 p = position;
  float t = uTime * uSwimPace;
  float nx = p.x / max(0.08, uLength);

  if (uSwimType < 0.5) {

    // 0: CARANGIFORM & VEIL (Goldfish, Angel, Puffer, Betta, Neon, Discus, Catfish, Lionfish)
    // Continuous spine wave normalized by actual fish length
    // nx: +1.0 (snout) -> 0.0 (midbody) -> -0.82 (peduncle/tail root) -> -1.8 (tail fin tip)
    float spine = 1.0 - smoothstep(-1.35, 0.25, nx);
    float counterHead = smoothstep(0.15, 0.95, nx) * 0.06;
    float wave = sin(t * 7.2 + uPhase + nx * 3.6);
    p.z += (wave * spine * 0.22 - wave * counterHead * 0.08) * (uBend * 10.0);

    // Organic trailing fin ripple: flexible secondary lag along fin edges
    float finDist = max(abs(p.y) / max(0.05, uHeight) - 0.75, 0.0);
    float tailDist = max(-nx - 0.75, 0.0);
    float finSpan = max(finDist, tailDist);
#ifdef ANGEL_FIN

    // Preserve the body's deformation at the root; add flexibility only outward.
    finSpan += aFinFlex * .6;
#endif
#ifdef BETTA_PECTORAL
    p.y += sin(t * 7.0 + uPhase + nx * 3.6) * aFinFlex * .035;
#endif
    if (finSpan > 0.01) {
      float finWave = sin(t * 8.2 + uPhase + nx * 4.5 + p.y * 3.5);
      p.z += finWave * finSpan * 0.045 * (uBend * 8.0);
    }

  } else if (uSwimType < 1.5) {

    // 1: RAJIFORM (Ray / Manta wing flow)
    float centerWave = sin(t * 4.8 + uPhase - nx * 3.2);
    p.y += centerWave * (1.0 - smoothstep(-1.3, 0.4, nx)) * 0.035 * (uBend * 8.0);

    float wingSpan = smoothstep(0.04, 0.35, abs(p.z));
    float wingWave = sin(t * 4.8 + uPhase - nx * 3.8);
    p.y += wingWave * pow(wingSpan, 1.3) * 0.14 * (uBend * 8.0);

    // Whip tail oscillation continues seamlessly from center body
    if (nx < -0.7) {
      float tailDist = (-nx - 0.7);
      p.y += sin(t * 4.8 + uPhase - nx * 4.2) * tailDist * 0.04 * (uBend * 8.0);
      p.z += cos(t * 4.8 + uPhase - nx * 4.2) * tailDist * 0.03 * (uBend * 8.0);
    }

  } else if (uSwimType < 2.5) {

    // 2: JELLYFISH JET PROPULSION (Hydrodynamic pulse & elastic glide)
    float cycle = mod(t * 2.8 + uPhase, 6.28318);
    float squish = clamp(sin(cycle), -0.32, 0.82);
    float ny = p.y / max(0.04, uHeight);
    float isBell = smoothstep(-0.15, 0.8, ny);
    float isRim = 1.0 - smoothstep(-0.1, 0.8, ny);

    p.x *= 1.0 - squish * 0.22 * isRim;
    p.z *= 1.0 - squish * 0.22 * isRim;
    p.y += squish * uHeight * 0.16 * isBell;

    if (p.y < 0.02) {
      float depth = -p.y;
      p.x += sin(t * 3.5 + uPhase + depth * 9.0) * depth * 0.09;
      p.z += cos(t * 2.8 + uPhase + depth * 7.0) * depth * 0.09;
    }

  } else if (uSwimType < 3.5) {

    // 3: SYNGNATHIFORM (Seahorse hovering & rapid dorsal shimmer)
    float ny = p.y / max(0.08, uHeight);

    // A slow trunk sway complements the rapid fin strokes. Fade it out at
    // the head and tail joint so eyes, snout and the coiled tail stay seated.
    float trunk = smoothstep(-0.7, -0.35, ny) * (1.0 - smoothstep(0.3, 0.8, ny));
    p.x += sin(t * 3.4 + uPhase + ny * 2.0) * uLength * 0.09 * trunk;
    p.z += sin(t * 3.4 + uPhase + ny * 2.0 - 0.7) * uLength * 0.065 * trunk;

    float chestPulse = sin(t * 2.2 + uPhase) * 0.003;
    p.x += chestPulse * smoothstep(-0.2, 0.2, p.y);
    if (ny < -0.4) {
      p.x += sin(t * 1.8 + uPhase) * (-ny - 0.4) * 0.025;
    }

  } else if (uSwimType < 4.5) {

    // 4: ANGUILLIFORM (Eel continuous sinusoidal full-spine wave)
    float wave = sin(t * 5.8 + uPhase + nx * 4.6);
    float amp = 0.035 + (1.0 - smoothstep(-1.2, 0.5, nx)) * 0.17;
    p.z += wave * amp * (uBend * 7.5);
  }
  if ((uMutation > 0.5 && uMutation < 1.5) || uMutation > 2.5) {
    float a = sin(nx * 3.0 + t * .6) * 0.18 * (1.0 - smoothstep(-.3, .45, nx));
    p.yz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.yz;
  }
  if (uMutation > 1.5)
    p.y -= sin(nx * 5.0 + t * .7) * .035 * (1.0 - smoothstep(-.2, .5, nx));

  vP = p;
  vSkin = position;
  vView = -(modelViewMatrix * vec4(p, 1.0)).xyz;
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragment = `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uTime;
uniform float uEffect;
uniform float uPattern;
uniform float uNight;
uniform float uFinish;
uniform float uIntensity;
uniform float uPatternScale;
uniform float uOpacity;
uniform float uActivity;
uniform float uPhase;
varying vec3 vP;
uniform float uLength;
uniform float uHeight;
uniform float uVariant;
uniform float uGrowth;
uniform float uGill;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vSkin;
varying vec3 vView;

vec3 hue(float x) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + x));
}

// Procedural 2D cellular Voronoi
float voronoi(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float md = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = fract(sin(vec2(dot(i + g, vec2(127.1, 311.7)), dot(i + g, vec2(269.5, 183.3)))) *
                     43758.5453);
      vec2 r = g + o - f;
      md = min(md, dot(r, r));
    }
  }
  return sqrt(md);
}

void main() {
  vec3 skin = vSkin * uPatternScale;
  float light =
      floor((dot(normalize(vN), normalize(vec3(-0.3, 0.7, 1.0))) * 0.35 + 0.65) * 4.0) / 4.0;

  // Patterns
  float stripe = step(0.4, sin(skin.x * 31.0 + skin.y * 4.0));
  float spots = step(0.75, sin(skin.x * 37.0) * cos(skin.y * 43.0));
  float voro = step(0.38, voronoi(vec2(skin.x * 13.0, (skin.y + skin.z * 0.5) * 13.0)));
  float scales = step(0.46, sin(skin.x * 38.0 + sin(skin.y * 28.0) * 1.5));
  float counter = smoothstep(-0.16, 0.22, skin.y);

  float mark = 0.0;
  if (uPattern > 0.5 && uPattern < 1.5)
    mark = stripe;
  else if (uPattern >= 1.5 && uPattern < 2.5)
    mark = spots;
  else if (uPattern >= 2.5 && uPattern < 3.5)
    mark = voro;
  else if (uPattern >= 3.5 && uPattern < 4.5)
    mark = scales;
  else if (uPattern >= 4.5)
    mark = counter;
  if (uVariant > 1.5 && uVariant < 2.5)
    mark = mix(mark, voro * spots, 0.65);

  vec3 base = uColor;
  vec3 acc = uAccent;

  // Rare mutations:
  // 4: albino, 5: melanistic, 6: golden, 7: cosmic
  if (uEffect >= 3.5 && uEffect < 4.5) {
    base = vec3(0.96, 0.92, 0.92);
    acc = vec3(0.98, 0.75, 0.80);
  } else if (uEffect >= 4.5 && uEffect < 5.5) {
    base = vec3(0.09, 0.09, 0.12);
    acc = vec3(0.22, 0.20, 0.28);
  } else if (uEffect >= 5.5 && uEffect < 6.5) {
    base = vec3(0.96, 0.77, 0.24);
    acc = vec3(1.0, 0.94, 0.65);
  } else if (uEffect >= 6.5) {
    base = vec3(0.07, 0.04, 0.16);
    acc = vec3(0.38, 0.68, 0.98);
  }

  vec3 color = mix(base, acc, mark * 0.65);
  color = mix(base, color, 0.4 + uGrowth * 0.6);
#ifdef NEON_SKIN

  // Pigment on the skin itself: follows the exact same spine/mutation deformation.
  float neonBand = 1.0 - smoothstep(uHeight * .11, uHeight * .17, abs(vSkin.y - uHeight * .15));
  neonBand *= smoothstep(-uLength * .85, -uLength * .66, vSkin.x) *
              (1.0 - smoothstep(uLength * .60, uLength * .78, vSkin.x));
  neonBand *= smoothstep(.01, .025, abs(vSkin.z));
  color = mix(color, mix(vec3(.68, .86, .95), acc, .18), neonBand * .92);
#endif

  // Subtle breathing gill on the skin, behind the eyes; no raised black arcs.
  float gillX = uLength * 0.08 - vSkin.y * vSkin.y * 0.3;
  float gill = (1.0 - smoothstep(0.004, 0.014, abs(vSkin.x - gillX))) *
               (1.0 - smoothstep(uHeight * 0.25, uHeight * 0.6, abs(vSkin.y)));
  color *= 1.0 - gill * uGill * (0.08 + 0.06 * sin(uTime * 4.0 + uPhase));
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);

  // Rainbow effect
  if (uFinish > 1.5 && uFinish < 2.5) {
    color =
        mix(color, hue(vSkin.x * 0.65 + vSkin.y * 0.3 + uTime * 0.09 + uPhase), uIntensity * 0.85);
  }

  // Pearl effect
  if (uFinish > 2.5 && uFinish < 3.5) {
    color = mix(color, hue(rim * 0.9 + vSkin.x * 0.12 + uPhase), uIntensity * (0.48 + rim * 0.3));
  }

  // Albino translucent blush
  if (uEffect >= 3.5 && uEffect < 4.5) {
    color += vec3(0.18, 0.05, 0.08) * rim;
  }

  // Melanistic graphite sheen
  if (uEffect >= 4.5 && uEffect < 5.5) {
    color += vec3(0.14, 0.16, 0.24) * rim * 0.75;
  }

  // Golden brilliance
  if (uEffect >= 5.5 && uEffect < 6.5) {
    color *= 0.85 + light * 0.45;
    color += vec3(0.35, 0.30, 0.1) * pow(light, 3.0);
  } else {
    color *= mix(0.78 + light * 0.42, 0.28 + light * 0.34, uNight);
  }

  // Cosmic starry nebula
  if (uFinish > 5.5 && uFinish < 6.5) {
    float star =
        step(0.94, fract(sin(dot(floor(skin.xy * 24.0), vec2(12.9898, 78.233))) * 43758.5453));
    float starBlink = star * (0.6 + 0.4 * sin(uTime * 4.0 + skin.x * 20.0 + uPhase));
    color +=
        uIntensity * (hue(skin.x * 0.4 + uTime * 0.05) * 0.3 + vec3(starBlink * (1.0 + uNight)));
  }

  // Glow effect
  if (uFinish > 0.5 && uFinish < 1.5) {
    float pulse = 0.5 + 0.5 * sin(uTime * 2.0 - skin.x * 12.0 + uPhase);
    color += acc * (0.7 + uNight * 1.6) * (0.18 + spots * pulse + rim * pulse * 0.4) * uIntensity;
  }
  if (uFinish > 1.5 && uFinish < 3.5) {
    color += acc * rim * (0.12 + uNight * 0.45) * uIntensity;
  }
  if (uFinish > 3.5 && uFinish < 4.5) {
    float sparkle =
        pow(max(0.0, sin(skin.x * 90.0 + uTime * 1.7 + uPhase) * cos(skin.y * 100.0 + rim * 8.0)),
            18.0);
    color += (acc + vec3(0.4)) * sparkle * uIntensity * (0.4 + rim);
  }
  if (uFinish > 4.5 && uFinish < 5.5)
    color += acc * (rim * 0.55 + 0.1) * uIntensity;
  if (uFinish > 6.5 && uFinish < 7.5) {
    float spec =
        pow(max(0.0, dot(reflect(-normalize(vec3(-.3, .7, 1.0)), normalize(vN)), normalize(vView))),
            32.0);
    color += (vec3(1.0) + acc) * spec * uIntensity;
  }
  if (uFinish > 8.5 && uFinish < 9.5) {
    float scan = .45 + .55 * step(.25, sin(vSkin.y * 115.0 - uTime * 8.0));
    color = mix(color, vec3(.12, .85, 1.2) * scan + acc * rim, uIntensity);
  }
  if (uFinish > 9.5 && uFinish < 10.5)
    color =
        mix(color, hue(rim * 1.6 + sin(vSkin.x * 7.0 + uTime * .3) * .2 + uPhase), uIntensity * .8);
  if (uFinish > 10.5 && uFinish < 11.5) {
    float flow = sin(skin.x * 14.0 + uTime) + cos(skin.y * 18.0 - uTime * .8) +
                 sin((skin.x + skin.y) * 11.0 + uTime * .5);
    color = mix(color, mix(base * .35, acc * 1.6, smoothstep(-1.5, 1.5, flow)), uIntensity);
  }
  ${rareFinishShader}
  float waterLight = pow(max(0.0, sin(vSkin.x * 35.0 + sin(vSkin.y * 19.0 + uTime * .5)) *
                                      cos(vSkin.y * 31.0 - uTime * .4)),
                         7.0);
  color += acc * waterLight * .12 * (1.0 - uNight);
  gl_FragColor = vec4(color, uOpacity);
}
`;

export function createFish(gene) {
  const root = new T.Group();
  const mutationSet = new Set([gene.mutation || 'none', gene.mutation2 || 'none']);
  root.userData.fishId = gene.id;
  const geo = [],
    mats = [];

  const effectMap = {
    natural: 0,
    glow: 1,
    rainbow: 2,
    pearl: 3,
    albino: 4,
    melanistic: 5,
    golden: 6,
    cosmic: 7,
  };

  const patternMap = {
    plain: 0,
    stripes: 1,
    spots: 2,
    voronoi: 3,
    scales: 4,
    counter: 5,
  };

  const swimType =
    gene.species === 'ray'
      ? 1
      : gene.species === 'jellyfish'
        ? 2
        : gene.species === 'seahorse'
          ? 3
          : ['eel', 'ribbonfish'].includes(gene.species)
            ? 4
            : gene.species === 'blobfish' || CRAWLERS.includes(gene.species)
              ? 5
              : 0;

  const bend =
    gene.species === 'eel'
      ? 0.15
      : gene.species === 'betta'
        ? 0.085
        : gene.species === 'ray'
          ? 0.14
          : gene.species === 'jellyfish'
            ? 0.09
            : 0.08;

  const speciesDims = {
    gar: [0.48, 0.13, 0.115],
    blobfish: [0.32, 0.26, 0.24],
    flyingfish: [0.39, 0.11, 0.1],
    angler: [0.32, 0.24, 0.23],
    ribbonfish: [0.82, 0.08, 0.055],
    swordfish: [0.53, 0.14, 0.12],
    monkfish: [0.43, 0.15, 0.34],
    shrimp: [0.28, 0.09, 0.085],
    snail: [0.19, 0.13, 0.12],
    crab: [0.21, 0.09, 0.17],
    goldfish: [0.38, 0.24, 0.17],
    angel: [0.26, 0.33, 0.1],
    puffer: [0.3, 0.29, 0.27],
    betta: [0.32, 0.19, 0.12],
    neon: [0.38, 0.12, 0.1],
    discus: [0.31, 0.32, 0.09],
    eel: [0.68, 0.095, 0.09],
    catfish: [0.43, 0.17, 0.18],
    seahorse: [0.16, 0.36, 0.1],
    ray: [0.35, 0.065, 0.36],
    jellyfish: [0.22, 0.2, 0.22],
    lionfish: [0.32, 0.2, 0.13],
  };

  const shapeDims = {
    oval: [0.4, 0.23, 0.15],
    round: [0.3, 0.28, 0.22],
    slender: [0.48, 0.15, 0.12],
    diamond: [0.32, 0.33, 0.115],
    vertical: [0.16, 0.36, 0.1],
    flat: [0.35, 0.065, 0.36],
    bell: [0.22, 0.2, 0.22],
    radiant: [0.32, 0.2, 0.13],
  };

  const dimensions = [...(speciesDims[gene.species] || shapeDims[gene.shape] || shapeDims.oval)];
  dimensions[0] *= gene.bodyRatio || 1;
  // Blend proportions, keeping each species' anatomical identity.
  const native = shapeDims[PROFILES[gene.species]?.shape] || shapeDims.oval;
  const inherited = shapeDims[gene.shape] || native;
  for (let i = 0; i < 3; i++)
    dimensions[i] *= T.MathUtils.clamp(1 + (inherited[i] / native[i] - 1) * 0.3, 0.8, 1.2);
  dimensions[1] *= gene.bodyHeight ?? 1;
  dimensions[2] *= gene.bodyWidth ?? 1;
  const finish = gene.finish || defaultFinish(gene.effect);

  const material = new T.ShaderMaterial({
    uniforms: {
      uColor: { value: new T.Color(gene.color) },
      uAccent: { value: new T.Color(gene.accent) },
      uTime: { value: 0 },
      uEffect: { value: effectMap[gene.effect] ?? 0 },
      uPattern: { value: patternMap[gene.pattern] ?? 0 },
      uPhase: { value: gene.phase },
      uNight: { value: 0 },
      uBend: { value: bend },
      uSwimPace: { value: gene.species === 'betta' ? 0.75 : 1 },
      uActivity: { value: 1 },
      uSwimType: { value: swimType },
      uLength: { value: dimensions[0] },
      uHeight: { value: dimensions[1] },
      uFinish: { value: finishIndex(finish) },
      uIntensity: { value: gene.intensity ?? 0.55 },
      uPatternScale: { value: gene.patternScale ?? 1 },
      uOpacity: { value: finish === 'glass' ? 0.55 : 1 },
      uVariant: { value: gene.variant === 'mosaic' ? 2 : 0 },
      uGrowth: { value: gene.growth ?? 1 },
      uGill: {
        value: ['jellyfish', 'ray', 'seahorse', ...CRAWLERS].includes(gene.species) ? 0 : 1,
      },
      uMutation: { value: (mutationSet.has('twist') ? 1 : 0) + (mutationSet.has('melt') ? 2 : 0) },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    side: T.DoubleSide,
    transparent: ['glass', 'hologram'].includes(finish),
    depthWrite: !['glass', 'hologram'].includes(finish),
  });
  mats.push(material);

  let activeMutation = null;
  const add = (geometry, mat = material, pos = [0, 0, 0], scale = [1, 1, 1]) => {
    geo.push(geometry);
    if (!mats.includes(mat)) mats.push(mat);
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.userData.fishId = gene.id;
    if (activeMutation) mesh.userData.mutationTag = activeMutation;
    root.add(mesh);
    return mesh;
  };

  const polygon = (points) => {
    const allowed = ![
      'seahorse',
      'ray',
      'jellyfish',
      'shrimp',
      'snail',
      'crab',
      'blobfish',
    ].includes(gene.species);
    points = finOutline(points, allowed ? gene.finStyle || 'native' : 'native');
    const positions = [],
      indices = [];
    for (const q of points) positions.push(...q);
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  const finSize = (gene.finSize || 1) * (gene.variant === 'veil' ? 1.18 : 1);
  const back = -dimensions[0] * 0.82;

  const fan = (anchor, length, height, z = 0) => {
    length *= gene.tailLength ?? 1;
    const points = [[...anchor]];
    for (let i = 0; i <= 16; i++) {
      const a = -1.05 + (i / 16) * 2.1;
      const ruffle =
        gene.tail === 'feather' ? 0.85 + 0.15 * (i % 2) : 1 + 0.07 * Math.sin(i * 2.8 + gene.phase);
      points.push([
        anchor[0] - Math.cos(a) * length * ruffle,
        anchor[1] + Math.sin(a) * height * ruffle,
        z + Math.sin(i * 0.7) * 0.012,
      ]);
    }
    return add(polygon(points));
  };

  // Eyes and accessories materials
  const eyeWhiteColor =
    gene.effect === 'albino' ? '#fae4e6' : gene.effect === 'melanistic' ? '#333742' : '#f8eee1';
  const eyePupilColor =
    gene.effect === 'albino'
      ? '#b51a34'
      : gene.effect === 'melanistic'
        ? '#0e0e16'
        : gene.eyeColor || '#202039';
  const white = new T.MeshBasicMaterial({ color: eyeWhiteColor });
  const black = new T.MeshBasicMaterial({ color: eyePupilColor });
  if (gene.variant === 'luminousEyes') {
    black.color.set(gene.accent).multiplyScalar(2.5);
  }
  const shine = new T.MeshBasicMaterial({ color: '#ffffff' });
  mats.push(white, black, shine);

  // Body construction depending on species
  if (buildInvertebrate({ gene, dimensions, add, material, white, black })) {
    // Bottom inhabitants have their own segmented bodies, feet and shells.
  } else if (gene.species === 'seahorse') {
    buildSeahorse({ gene, dimensions, add, material, white, black, shine });
  } else if (gene.species === 'ray') {
    // RAY / MANTA (Raia / Manta)
    const body = new T.SphereGeometry(1, 16, 8);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const wingFactor = 1.0 - Math.abs(x) * 0.45;
      p.setXYZ(
        i,
        x * dimensions[0],
        y * dimensions[1] * (1.0 - Math.abs(z) * 0.65),
        z * dimensions[2] * wingFactor * (gene.variant === 'asymmetric' && z < 0 ? 0.9 : 1),
      );
    }
    body.computeVertexNormals();
    add(body);

    // Cephalic lobes
    for (const side of [-1, 1]) {
      add(
        polygon([
          [dimensions[0] * 0.65, 0, side * 0.05],
          [dimensions[0] * 1.05, -0.01, side * 0.08],
          [dimensions[0] * 0.7, -0.02, side * 0.13],
        ]),
      );
    }

    // Whip tail in root space
    const whip = [
      new T.Vector3(back, 0, 0),
      new T.Vector3(back - 0.15 * finSize * (gene.tailLength ?? 1), 0.01, 0),
      new T.Vector3(back - 0.32 * finSize * (gene.tailLength ?? 1), 0.03, 0),
    ];
    add(new T.TubeGeometry(new T.CatmullRomCurve3(whip), 8, 0.012 * finSize, 4, false));

    // Dorsal eyes
    const eyeScale = (gene.eyeSize || 1) * 0.82;
    for (const side of [-1, 1]) {
      const ex = dimensions[0] * 0.25,
        ey = dimensions[1] * 0.6,
        ez = side * dimensions[2] * 0.22;
      add(new T.SphereGeometry(0.038 * eyeScale, 8, 6), white, [ex, ey, ez]);
      add(new T.SphereGeometry(0.022 * eyeScale, 6, 4), black, [
        ex + 0.005,
        ey + 0.018 * eyeScale,
        ez,
      ]);
      add(new T.SphereGeometry(0.008 * eyeScale, 4, 4), shine, [
        ex + 0.008,
        ey + 0.022 * eyeScale,
        ez,
      ]);
    }
  } else if (gene.species === 'jellyfish') {
    buildJellyfish({ gene, dimensions, add, material });
  } else if (gene.species === 'lionfish') {
    // LIONFISH (Lionfish)
    buildFishHead({ gene, dimensions, add, material });

    // Radiant dorsal spines (in root space)
    for (let s = 0; s < 6; s++) {
      const frac = s / 5;
      const sx = dimensions[0] * (0.32 - frac * 0.95);
      const spineLen = (0.22 + Math.sin(frac * Math.PI) * 0.12) * finSize;
      const spinePoints = [
        new T.Vector3(sx, dimensions[1] * 0.65, 0),
        new T.Vector3(sx - 0.04 * finSize, dimensions[1] * 0.65 + spineLen, 0),
      ];
      add(new T.TubeGeometry(new T.CatmullRomCurve3(spinePoints), 5, 0.008 * finSize, 3, false));
    }

    // Pectoral fan rays
    for (const side of [-1, 1]) {
      for (let ray = 0; ray < 4; ray++) {
        const a = -0.4 + (ray / 3) * 1.0;
        const rayLen = (0.2 + Math.sin((ray / 3) * Math.PI) * 0.09) * finSize;
        const rayPts = [
          new T.Vector3(0.03, -0.02, side * dimensions[2] * 0.72),
          new T.Vector3(
            -Math.cos(a) * rayLen,
            -Math.sin(a) * rayLen * 0.5,
            side * (dimensions[2] * 0.72 + Math.sin(a + 0.8) * 0.18 * finSize),
          ),
        ];
        const pRay = add(
          new T.TubeGeometry(new T.CatmullRomCurve3(rayPts), 5, 0.007 * finSize, 3, false),
        );
        pRay.userData.fin = true;
        pRay.userData.side = side;
      }
    }

    buildCaudalFin({ gene, dimensions, finSize, add, material });

    // Eyes with brow plume
    const eyeScale = (gene.eyeSize || 1) * 0.98;
    for (const side of [-1, 1]) {
      const x = dimensions[0] * 0.61,
        y = dimensions[1] * 0.26,
        z = side * dimensions[2] * 0.86;
      add(new T.SphereGeometry(0.048 * eyeScale, 10, 8), white, [x, y, z]);
      add(new T.SphereGeometry(0.028 * eyeScale, 8, 6), black, [
        x + 0.014,
        y,
        side * (dimensions[2] * 0.86 + 0.035 * eyeScale),
      ]);
      add(new T.SphereGeometry(0.01 * eyeScale, 6, 4), shine, [
        x + 0.012,
        y + 0.012,
        side * (dimensions[2] * 0.86 + 0.055 * eyeScale),
      ]);
      add(
        polygon([
          [x, y + 0.025 * eyeScale, z],
          [x - 0.03, y + 0.09 * eyeScale * finSize, z + side * 0.015],
          [x + 0.015, y + 0.05 * eyeScale, z],
        ]),
      );
    }
  } else {
    // Fish with a continuous skin surrounding an open mouth.
    buildFishHead({ gene, dimensions, add, material });

    // Tail geometries: ALL created in fish root space so their vertices seamlessly continue from `back`!
    if (['swordfish', 'monkfish'].includes(gene.species)) {
      buildPredatorDetails({ gene, dimensions, add, material, polygon, white, black, shine });
    } else if (gene.species === 'blobfish') {
      buildBlobTails({ gene, dimensions, add, material });
    } else if (gene.species === 'betta') {
      buildBettaTail({ gene, dimensions, finSize, add, material });
    } else {
      buildCaudalFin({ gene, dimensions, finSize, add, material });
      if (gene.species === 'goldfish' && ['fan', 'feather'].includes(gene.tail))
        buildCaudalFin({ gene, dimensions, finSize, add, material, secondary: true });
    }

    // Dorsal & ventral fins (in root space)
    if (['swordfish', 'monkfish'].includes(gene.species)) {
      // Their paired fins and tails are built with their anatomical model.
    } else if (gene.species === 'angel') {
      buildAngelFins({ gene, dimensions, finSize, add, material });
    } else if (gene.species === 'betta') {
      buildAngelFins({ gene, dimensions, finSize, add, material });
    } else if (['eel', 'ribbonfish'].includes(gene.species)) {
      const steps = 32;
      const points = [],
        indices = [];
      const xFront = dimensions[0] * 0.52;
      const xBack = back;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const currX = T.MathUtils.lerp(xFront, xBack, u);
        const theta = Math.acos(T.MathUtils.clamp(currX / dimensions[0], -0.999, 0.999));
        const bodyY = dimensions[1] * Math.sin(theta) * (1 + Math.max(0, Math.cos(theta)) * 0.12);
        const baseY = bodyY - 0.005;
        const finHeight = (0.04 + 0.09 * Math.sin(Math.PI * u) ** 0.65) * finSize;
        points.push(currX, baseY, 0);
        points.push(currX, baseY + finHeight, 0);
      }
      for (let s = 0; s < steps; s++) {
        const b = s * 2;
        indices.push(b, b + 1, b + 2);
        indices.push(b + 1, b + 3, b + 2);
      }
      const finGeo = new T.BufferGeometry();
      finGeo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
      finGeo.setIndex(indices);
      finGeo.computeVertexNormals();
      add(finGeo);
    } else if (gene.species === 'blobfish') {
      // The blobfish keeps a soft outline without a projecting dorsal fin.
    } else if (['gar', 'flyingfish'].includes(gene.species)) {
      const x = dimensions[0],
        y = dimensions[1],
        small = gene.species === 'blobfish' ? 0.35 : 1;
      add(
        polygon([
          [-x * 0.38, y * 0.5, 0],
          [-x * 0.7, y + 0.12 * finSize * small, 0],
          [-x * 0.82, y * 0.35, 0],
        ]),
      );
    } else {
      add(
        polygon([
          [-0.17, dimensions[1] * 0.65, 0],
          [-0.19, dimensions[1] + 0.13 * finSize, 0],
          [0.15, dimensions[1] * 0.75, 0],
        ]),
      );
    }

    // Pectoral fins
    if (gene.species === 'betta') buildBettaPectorals({ dimensions, add, material });
    for (const side of ['flyingfish', 'blobfish', 'betta', 'swordfish', 'monkfish'].includes(
      gene.species,
    )
      ? []
      : [-1, 1]) {
      const fin = add(
        polygon([
          [0.02, 0, 0],
          [-0.14, -0.13, side * 0.22],
          [-0.18, 0.01, side * 0.2],
        ]),
        material,
        [0, -0.035, side * dimensions[2] * 0.7],
      );
      fin.userData.fin = true;
      fin.userData.side = side;
    }

    // Eyes
    const eyeScale =
      (gene.eyeSize || 1) *
      (gene.species === 'puffer'
        ? 1.3
        : ['blobfish', 'flyingfish', 'gar'].includes(gene.species)
          ? 0.62
          : gene.species === 'neon'
            ? 0.72
            : gene.species === 'eel'
              ? 0.78
              : 1);
    for (const side of gene.species === 'monkfish' ? [] : [-1, 1]) {
      const anchor =
        gene.species === 'neon'
          ? neonEyePosition(
              root.children.find((mesh) => mesh.userData.openHead),
              dimensions,
              side,
              0.053 * eyeScale,
            )
          : new T.Vector3(
              dimensions[0] * (gene.species === 'gar' ? 0.48 : 0.61),
              dimensions[1] * 0.26,
              side * dimensions[2] * 0.86,
            );
      const { x, y, z } = anchor;
      const eye = add(new T.SphereGeometry(0.053 * eyeScale, 10, 8), white, [x, y, z]);
      const pupil = add(new T.SphereGeometry(0.032 * eyeScale, 8, 6), black, [
        x + 0.015,
        y,
        z + side * 0.039 * eyeScale,
      ]);
      const highlight = add(new T.SphereGeometry(0.011 * eyeScale, 6, 4), shine, [
        x + 0.013,
        y + 0.014,
        z + side * 0.065 * eyeScale,
      ]);
      if (gene.species === 'neon')
        for (const part of [eye, pupil, highlight]) {
          part.userData.neonEye = true;
          part.userData.neonEyeAnchor = anchor.toArray();
        }
    }

    // Puffer spines in root space so they follow body wave
    if (
      gene.species === 'puffer' &&
      !mutationSet.has('spines') &&
      !mutationSet.has('giantSpines')
    ) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2,
          y = Math.sin(i * 2.4) * 0.7;
        const rad = Math.sqrt(1 - y * y);
        const direction = new T.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
        if (direction.x > 0.55) continue;
        const spineGeo = new T.ConeGeometry(0.018, 0.07, 4);
        const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
        spineGeo.applyQuaternion(q);
        spineGeo.translate(
          direction.x * dimensions[0] * 1.02,
          direction.y * dimensions[1] * 1.06,
          direction.z * dimensions[2] * 1.04,
        );
        add(spineGeo, material);
      }
    }

    // Catfish barbels
    if (gene.species === 'catfish') {
      for (const side of [-1, 1]) {
        const points = [
          new T.Vector3(dimensions[0] * 0.94, -0.03, side * 0.06),
          new T.Vector3(dimensions[0] * 1.11, -0.1, side * 0.18),
          new T.Vector3(dimensions[0] * 1.15, -0.17, side * 0.25),
        ];
        add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 10, 0.012, 4, false));
      }
    }

    // Neon bands belong to the continuous body skin, never detached rigid bars.
    if (gene.species === 'neon') {
      const skin = material.clone();
      skin.uniforms = material.uniforms;
      skin.defines = { ...material.defines, NEON_SKIN: 1 };
      mats.push(skin);
      for (const mesh of root.children) if (mesh.userData.openHead) mesh.material = skin;
    }
  }

  buildUnusualFish({ gene, dimensions, add, material, polygon });
  buildBodySpines({ root, gene, dimensions, add, material });
  for (const mutation of mutationSet) {
    activeMutation = mutation === 'none' ? null : mutation;
    if (mutation === 'crystal') {
      for (let i = 0; i < 7; i++) {
        const spike = add(
          new T.OctahedronGeometry(0.055, 0),
          material,
          [-dimensions[0] * 0.55 + i * dimensions[0] * 0.17, dimensions[1] * 0.85, 0],
          [1, 1.2, 1],
        );
        spike.rotation.z = (i - 3) * -0.12;
        spike.userData.mutationAttachment = {
          key: 'crystal:' + i,
          anchor: [spike.position.x, spike.position.y - 0.055 * 1.2, 0],
          radius: 0.025,
        };
      }
    }
    if (mutation === 'antenna' || mutation === 'ribbon') {
      const tipMaterial =
        mutation === 'antenna'
          ? new T.MeshBasicMaterial({ color: new T.Color(gene.accent).multiplyScalar(2.2) })
          : shine;
      if (tipMaterial !== shine) mats.push(tipMaterial);
      for (const side of [-1, 1]) {
        const points = [
          new T.Vector3(dimensions[0] * 0.4, dimensions[1] * 0.65, side * dimensions[2] * 0.6),
          new T.Vector3(dimensions[0] * 0.6, dimensions[1] + 0.13, side * dimensions[2] * 0.8),
          new T.Vector3(dimensions[0] * 0.3, dimensions[1] + 0.19, side * dimensions[2] * 1.2),
        ];
        const attachment = {
          key: mutation + ':' + side,
          anchor: points[0].toArray(),
          radius: mutation === 'ribbon' ? 0.022 : 0.008,
          flex: 0.015,
          phase: side,
        };
        const stalk = add(
          new T.TubeGeometry(
            new T.CatmullRomCurve3(points),
            10,
            mutation === 'ribbon' ? 0.022 : 0.008,
            4,
            false,
          ),
        );
        stalk.userData.mutationAttachment = attachment;
        if (mutation === 'antenna')
          add(
            new T.SphereGeometry(0.025, 6, 4),
            tipMaterial,
            points[2].toArray(),
          ).userData.mutationAttachment = attachment;
      }
    }
    if (
      mutation === 'splitTail' &&
      !['blobfish', 'jellyfish', 'seahorse', 'swordfish', 'monkfish'].includes(gene.species)
    ) {
      if (gene.species === 'snail') {
        const original = root.children.find((c) => c.userData.snailShell);
        if (original) {
          const second = original.clone();
          root.add(second);
          for (const [i, shell] of [original, second].entries()) {
            shell.scale.setScalar(0.7);
            shell.position.z = (i === 0 ? -1 : 1) * dimensions[2] * 0.38;
            shell.userData.shellPair = true;
          }
        }
      } else if (gene.species === 'seahorse') {
        const original = root.children.find(
          (c) =>
            c.geometry?.type === 'TubeGeometry' && c.geometry.parameters.tubularSegments === 16,
        );
        if (original?.geometry)
          add(original.geometry.clone(), material, [0, 0, dimensions[2] * 0.65]);
      } else if (gene.species === 'crab') {
        for (const side of [-1, 1])
          add(
            new T.SphereGeometry(0.04, 8, 6),
            material,
            [dimensions[0], 0.05, side * dimensions[2] * 1.8],
            [1.5, 0.8, 1],
          );
      } else if (gene.species === 'ray') {
        add(
          new T.TubeGeometry(
            new T.CatmullRomCurve3([
              new T.Vector3(back, 0, -0.04),
              new T.Vector3(back - 0.15, 0.01, -0.09),
              new T.Vector3(back - 0.32, 0.03, -0.12),
            ]),
            10,
            0.01,
            4,
            false,
          ),
        );
      } else {
        const anchor = [back, 0, dimensions[2] * 0.65];
        fan(
          anchor,
          0.28 * finSize,
          0.23 * finSize,
          dimensions[2] * 0.65,
        ).userData.mutationAttachment = { key: 'splitTail', anchor, radius: 0.012 };
      }
    }
  }
  activeMutation = null;
  buildMonsterTraits({ gene, dimensions, add, material, white, black, shine });
  applyEyeStyles({ root, gene, add, white, black, shine, material });
  bindMutations({ root, gene, material, mats, geo });

  if (finish === 'glass' && gene.species !== 'jellyfish') {
    const organMaterial = new T.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { ...material.uniforms, uFinish: { value: 1 }, uOpacity: { value: 0.85 } },
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    });
    mats.push(organMaterial);
    add(
      new T.SphereGeometry(1, 10, 8),
      organMaterial,
      [0, 0, 0],
      dimensions.map((d) => d * 0.45),
    );
  }

  root.traverse((mesh) => {
    if (gene.variant === 'asymmetric' && mesh.userData.fin && mesh.userData.side === -1)
      mesh.scale.set(1, 0.86, 0.9);
    if (
      mesh.material === black &&
      !mesh.userData.mouth &&
      !mesh.userData.monsterMouth &&
      !mesh.userData.gill
    ) {
      mesh.userData.pupil = true;
      mesh.userData.rest = mesh.position.clone();
    }
  });

  if (gene.species === 'neon') bindNeonEyes({ root, material, mats });
  if (gene.species === 'blobfish') bindBlobFish(root);
  root.scale.setScalar(gene.scale);

  // Fit even imported extreme genomes; the same conservative envelope is used for swimming.
  const rawBounds = new T.Box3().setFromObject(root);
  if (CRAWLERS.includes(gene.species)) rawBounds.expandByScalar(0.15 * root.scale.x);
  const rawX = Math.max(Math.abs(rawBounds.min.x), Math.abs(rawBounds.max.x));
  const rawY = Math.max(Math.abs(rawBounds.min.y), Math.abs(rawBounds.max.y));
  const rawZ = Math.max(Math.abs(rawBounds.min.z), Math.abs(rawBounds.max.z));
  const fit = Math.min(
    1,
    1.75 / (Math.hypot(rawX, rawZ) + 0.3 * root.scale.x),
    1.5 / (rawY + rawX * 0.44 + 0.11 * root.scale.x),
  );
  root.scale.multiplyScalar(fit);

  const bounds = new T.Box3().setFromObject(root);
  const restBottom = bounds.min.y;
  if (CRAWLERS.includes(gene.species)) bounds.expandByScalar(0.15 * root.scale.x);
  const rx = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
  const ry = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y));
  const rz = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));

  const clearance = {
    horizontal: Math.hypot(rx, rz) + 0.3 * root.scale.x,
    vertical: ry + rx * 0.44 + 0.11 * root.scale.x,
  };

  root.userData.species = gene.species;
  const adultScale = root.scale.clone();
  const bodyRadius = Math.min(0.45, Math.max(dimensions[1], dimensions[2]) * adultScale.x);
  const bottomClearance =
    gene.species === 'shrimp'
      ? dimensions[1] * 1.45 * adultScale.y
      : Math.max(0, -restBottom) + (CRAWLERS.includes(gene.species) ? 0.025 * root.scale.x : 0);
  const walkStride =
    gene.species === 'shrimp' ? Math.min(0.13, dimensions[1] * 2 * adultScale.x * 0.65) : null;
  const sole = root.children.find((c) => c.userData.footRest);
  const soleClearance = sole ? -(sole.position.y - 0.65 * sole.scale.y) * adultScale.y : null;
  root.scale.multiplyScalar(growthScale(gene.growth ?? 1));

  return {
    root,
    gene,
    material,
    clearance,
    adultScale,
    bodyRadius,
    bottomClearance,
    soleClearance,
    walkStride,
    dispose() {
      geo.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export function initialMotion(seed, gene) {
  const r = rng(hash(seed + ':motion:' + gene.id));
  const angle = r() * Math.PI * 2;
  const profile = PROFILES[gene.species] || PROFILES.goldfish;
  const initialY =
    profile.tier === 'bottom'
      ? 0.35 + r() * 0.4
      : profile.tier === 'drift'
        ? 1.5 + r() * 1.5
        : profile.tier === 'plant'
          ? 0.6 + r() * 1.2
          : profile.tier === 'surface'
            ? 2.6 + r() * 0.5
            : 0.7 + r() * 2.4;

  return {
    position: new T.Vector3((r() - 0.5) * 5.1, initialY, (r() - 0.5) * 2.2),
    velocity: new T.Vector3(
      gene.species === 'crab' ? (r() < 0.5 ? -1 : 1) : Math.cos(angle),
      0,
      gene.species === 'crab' ? 0 : Math.sin(angle),
    ).multiplyScalar(gene.speed * (gene.species === 'snail' ? 0.12 : 1)),
    phase: r() * Math.PI * 2,
    currentYaw: gene.species === 'crab' ? Math.PI / 2 : -angle,
    currentPitch: 0,
    currentRoll: 0,
    restTimer: 0,
    hunger: 0.6,
    home: new T.Vector3((r() - 0.5) * 3.0, initialY, (r() - 0.5) * 1.0),
  };
}

export function steerFish(fish, all, time, dt, cursorTarget = null, ecology = {}) {
  const m = fish.motion,
    v = m.velocity,
    p = m.position;
  const profile = PROFILES[fish.gene.species] || PROFILES.goldfish;
  const temperament = fish.gene.temperament || 'calm';
  const clearance = fish.activeClearance || fish.clearance;
  const bounds = {
    x: (fish.tankBounds?.x ?? 3.42) - clearance.horizontal,
    z: (fish.tankBounds?.z ?? 2.05) - clearance.horizontal,
  };
  const shrimp = fish.gene.species === 'shrimp',
    snail = fish.gene.species === 'snail';
  if (shrimp) {
    const cycle = (time + m.phase * 4) % 24;
    const swimming = cycle > 5 && cycle < 19;
    m.swimBlend = m.swimBlend ?? (swimming ? 1 : 0);
    m.swimBlend += ((swimming ? 1 : 0) - m.swimBlend) * (1 - Math.exp(-dt * 2.5));
    m.swimStroke = Math.max(0, Math.sin(time * 4.8 + m.phase)) ** 3;
  }
  const crawler = CRAWLERS.includes(fish.gene.species) && (!shrimp || m.swimBlend < 0.02);
  const crab = fish.gene.species === 'crab',
    lane = p.z;
  const ground = fish.tankBounds?.floor ?? 0.18;
  const low = CRAWLERS.includes(fish.gene.species)
    ? ground +
      (snail ? 0.001 : 0) +
      (snail
        ? (fish.soleClearance ?? fish.bottomClearance)
        : (fish.bottomClearance ?? clearance.vertical)) *
        (fish.tankFit ?? 1) *
        growthScale(fish.gene.growth)
    : 0.22 + clearance.vertical;
  const high = (fish.tankBounds?.top ?? 3.6) - clearance.vertical;

  const target = new T.Vector3(
    Math.sin(time * 0.21 + m.phase),
    Math.sin(time * 0.7 + m.phase) * 0.13,
    Math.cos(time * 0.17 + m.phase * 1.7),
  ).multiplyScalar(0.14);
  target.x += Math.sin(p.y * 1.3 + time * 0.22) * 0.022;
  target.z += Math.cos(p.x * 0.7 + time * 0.19) * 0.018;

  // Schooling / Flocking
  let schoolCount = 0;
  const schoolAlignment = new T.Vector3();
  const schoolCenter = new T.Vector3();

  for (const other of all) {
    if (other === fish) continue;
    const diff = p.clone().sub(other.motion.position);
    const dist = diff.length();

    if (dist > 0 && dist < 0.6) {
      target.addScaledVector(diff, ((0.6 - dist) * 1.5) / dist);
    }
    if (temperament === 'territorial' && dist > 0 && dist < 1.1)
      target.addScaledVector(diff, 0.3 / dist);

    if (
      (profile.tier === 'school' || temperament === 'social') &&
      other.gene.species === fish.gene.species &&
      dist < 1.4 + Math.sin(time * 0.08 + (hash(fish.gene.species) % 10)) * 0.4
    ) {
      schoolAlignment.add(other.motion.velocity);
      schoolCenter.add(other.motion.position);
      schoolCount++;
    }
  }

  if (temperament === 'territorial' && m.home) target.addScaledVector(m.home.clone().sub(p), 0.16);

  if (schoolCount > 0) {
    schoolAlignment.divideScalar(schoolCount);
    schoolCenter.divideScalar(schoolCount);
    target.addScaledVector(schoolAlignment, 0.45);
    target.addScaledVector(schoolCenter.sub(p), 0.35);
    const flockPhase = hash(fish.gene.species) % 100;
    target.x += Math.sin(time * 0.13 + flockPhase) * 0.22;
    target.z += Math.cos(time * 0.11 + flockPhase) * 0.22;
  }

  // Ecological niches
  if (profile.tier === 'bottom') {
    target.y += (low + 0.12 - p.y) * 0.38;
    if (p.y < low + 0.25) {
      target.x *= 0.72;
      target.z *= 0.72;
    }
  } else if (profile.tier === 'drift') {
    const pulse = Math.sin(time * 2.8 + m.phase);
    if (pulse > 0.6) {
      target.y += 0.24;
    } else {
      target.y -= 0.07;
    }
    target.x *= 0.52;
    target.z *= 0.52;
  } else if (profile.tier === 'surface') {
    target.y += (high - 0.08 - p.y) * 0.55;
  } else if (profile.tier === 'plant') {
    target.y += (1.1 - p.y) * 0.18;
    target.x *= 0.78;
    target.z *= 0.78;
  }

  // Cursor interaction
  if (cursorTarget) {
    const toCursor = cursorTarget.clone().sub(p);
    const cursorDist = toCursor.length();
    if (cursorDist < 1.8 && cursorDist > 0.01) {
      if (temperament === 'shy') {
        target.addScaledVector(toCursor, -0.6 / cursorDist);
      } else if (temperament === 'curious') {
        target.addScaledVector(toCursor, 0.35 / cursorDist);
      }
    }
  }
  m.hunger = Math.min(1, (m.hunger ?? 0.6) + dt / 75);
  fish.targetFood = foodPreference(fish, p, ecology.food || []);
  m.action = schoolCount > 0 ? 'Schooling' : 'Exploring';
  if (fish.targetFood) {
    const direction = fish.targetFood.position.clone().sub(p);
    target.addScaledVector(direction, 2.0 / Math.max(0.15, direction.length()));
    m.action = 'Looking for food';
  }
  const disturbance = ecology.disturbance;
  const startled =
    disturbance && disturbance.until > time && p.distanceTo(disturbance.position) < 1.8;
  const resting =
    !fish.targetFood &&
    !startled &&
    (time + m.phase * 19) % 100 > 76 &&
    (time + m.phase * 19) % 100 < 86;
  if (shrimp) {
    if (startled && !m.wasStartled) {
      m.escapeUntil = time + 0.65;
      m.escapeYaw = m.currentYaw;
      m.swimBlend = 1;
    }
    m.wasStartled = Boolean(startled);
    const hover =
      low +
      (fish.targetFood?.position.y < low + 0.2
        ? 0
        : m.swimBlend * (0.42 + 0.14 * Math.sin(time * 0.8 + m.phase)));
    target.y = (hover - p.y) * 3.0 - v.y * 2.4;
    if (m.escapeUntil > time)
      m.swimStroke = Math.sin(Math.PI * (1 - (m.escapeUntil - time) / 0.65)) ** 2;
    m.action =
      m.escapeUntil > time
        ? 'Escaping with a tail flick'
        : m.swimBlend > 0.5
          ? 'Swimming with appendages'
          : 'Walking along the bottom';
  }
  if (resting && ecology.shelters?.length) {
    const shelter = ecology.shelters[hash(fish.gene.id) % ecology.shelters.length];
    target.addScaledVector(shelter.clone().sub(p), 0.3);
    m.action = 'Resting in the plants';
  } else if (!fish.targetFood && temperament === 'curious' && (time + m.phase * 11) % 50 > 39) {
    target.z += (fish.tankBounds?.z ?? 2.05) - clearance.horizontal - p.z;
    m.action = 'Watching the glass';
  }
  if (startled) {
    target.addScaledVector(p.clone().sub(disturbance.position).normalize(), 2.6);
    m.action = 'Startled';
  }
  const radius = (fish.bodyRadius ?? 0.15) * (fish.tankFit ?? 1) * growthScale(fish.gene.growth);
  target.add(obstacleForce(p, v, ecology.obstacles || [], radius));

  // Smooth quadratic repulsion from boundaries
  for (const [axis, bound] of Object.entries(bounds)) {
    const margin = bound - 0.45;
    if (Math.abs(p[axis]) > margin) {
      const pen = Math.abs(p[axis]) - margin;
      target[axis] -= Math.sign(p[axis]) * (pen * 2.2 + pen * pen * 3.5);
    }
  }
  if (p.y < low + 0.18) target.y += (low + 0.18 - p.y) * 2.2;
  if (p.y > high - 0.18) target.y -= (p.y - high + 0.18) * 2.2;

  v.addScaledVector(target, dt);
  // Crabs face the front of the tank and sidestep along one horizontal lane.
  // Reverse before a wall rather than turning their face into the travel direction.
  if (crab) {
    v.z = 0;
    v.y = 0;
    if (Math.abs(p.x) > Math.max(0, bounds.x - 0.12) && Math.sign(v.x) === Math.sign(p.x))
      v.x = -v.x;
    if (Math.abs(v.x) < 0.025)
      v.x = (Math.cos(time * 0.17 + m.phase) < 0 ? -1 : 1) * fish.gene.speed * 0.4;
  }

  // Speed regulation with natural burst-and-glide pulsation
  const baseSpeed = Math.hypot(v.x, v.z);
  if (baseSpeed > 0.001) {
    const surgeFreq =
      fish.gene.species === 'puffer' ? 5.5 : fish.gene.species === 'ray' ? 2.5 : 3.6;
    const surge = snail
      ? 0.94 + 0.06 * Math.sin(m.gaitPhase ?? m.phase)
      : shrimp
        ? 0.75 + 0.65 * (m.swimStroke ?? 0) * m.swimBlend
        : 0.88 + 0.22 * Math.sin(time * surgeFreq + m.phase);
    const nocturnal =
      ['glow', 'constellation'].includes(fish.gene.finish) || fish.gene.species === 'eel';
    const activity = ecology.night ? (nocturnal ? 1.12 : 0.55) : 1;
    const speciesPace = snail ? 0.12 : shrimp ? 0.8 : 1;
    const desired =
      fish.gene.speed *
      speciesPace *
      surge *
      (temperament === 'calm' ? 0.8 : temperament === 'shy' ? 1.12 : 1) *
      (startled ? 1.7 : resting ? 0.25 : fish.targetFood ? 1.35 : activity);
    v.x *= 1 + (desired / baseSpeed - 1) * Math.min(1, dt * 0.8);
    v.z *= 1 + (desired / baseSpeed - 1) * Math.min(1, dt * 0.8);
  }
  if (snail) {
    let turn = -Math.atan2(v.z, v.x) - m.currentYaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    m.currentYaw += T.MathUtils.clamp(turn, -dt * 0.45, dt * 0.45);
    const speed = Math.min(fish.gene.speed * 0.17, Math.hypot(v.x, v.z));
    v.x = Math.cos(m.currentYaw) * speed;
    v.z = -Math.sin(m.currentYaw) * speed;
    m.action = fish.targetFood ? 'Crawling towards food' : 'Crawling';
  }
  if (shrimp && crawler && !(m.escapeUntil > time)) {
    const turn = Math.atan2(
      Math.sin(-Math.atan2(v.z, v.x) - m.currentYaw),
      Math.cos(-Math.atan2(v.z, v.x) - m.currentYaw),
    );
    m.currentYaw += T.MathUtils.clamp(turn, -dt * 1.2, dt * 1.2);
    const speed = Math.hypot(v.x, v.z);
    v.x = Math.cos(m.currentYaw) * speed;
    v.z = -Math.sin(m.currentYaw) * speed;
  }
  if (shrimp && m.escapeUntil > time) {
    v.x = -Math.cos(m.escapeYaw) * fish.gene.speed * 2.2;
    v.z = Math.sin(m.escapeYaw) * fish.gene.speed * 2.2;
    v.y = 0.16 * m.swimStroke;
  }
  v.y = T.MathUtils.clamp(v.y, -0.18, 0.18);
  fish.material.uniforms.uActivity.value = Math.min(
    2.5,
    v.length() / Math.max(0.05, fish.gene.speed),
  );
  p.addScaledVector(v, dt);
  if (crab) {
    p.z = lane;
    for (const obstacle of ecology.obstacles || []) {
      const reach = obstacle.radius + radius + 0.015;
      const cross = (lane - obstacle.position.z) ** 2 + (low - obstacle.position.y) ** 2;
      if (cross >= reach * reach) continue;
      const half = Math.sqrt(reach * reach - cross),
        left = obstacle.position.x - half,
        right = obstacle.position.x + half;
      if (p.x > left && p.x < right) {
        p.x = m.position.x < obstacle.position.x ? left : right;
        v.x = p.x < obstacle.position.x ? -Math.abs(v.x) : Math.abs(v.x);
      }
    }
  } else resolveObstacles(p, ecology.obstacles || [], radius, crawler ? low : null);
  if (crawler) {
    p.y = low;
    v.y = 0;
  }

  p.x = T.MathUtils.clamp(p.x, -bounds.x, bounds.x);
  p.z = T.MathUtils.clamp(p.z, -bounds.z, bounds.z);
  p.y = T.MathUtils.clamp(p.y, low, high);

  if (fish.gene.species === 'flyingfish') advanceFlyingFish(fish, time, dt, bounds, low, high);

  fish.root.position.copy(p);
  animateInvertebrate(fish, time, dt);

  // Pectoral fin flapping animation
  const gaze = cursorTarget ? fish.root.worldToLocal(cursorTarget.clone()) : null;
  fish.root.traverse((child) => {
    animateMonsterTrait(child, fish, time);
    animateMutation(child, fish, time);
    animateFishMouth(child, fish, time);
    animateUnusualFish(child, fish, time);
    if (fish.gene.species === 'seahorse') animateSeahorse(child, fish, time);
    if (child.userData.mouth)
      child.scale.y =
        0.7 +
        (fish.targetFood || m.chewUntil > time ? 0.8 : 0.22) * (1 + Math.sin(time * 2.4 + m.phase));
    if (child.userData.gill) child.scale.x = 0.85 + 0.15 * Math.sin(time * 4.0 + m.phase);
    if (child.userData.pupil) {
      child.position.copy(child.userData.rest);
      if (gaze) {
        child.position.x += T.MathUtils.clamp(gaze.x - child.position.x, -1, 1) * 0.008;
        child.position.y += T.MathUtils.clamp(gaze.y - child.position.y, -1, 1) * 0.008;
      }
    }
    if (child.userData?.fin) {
      const side = child.userData.side || 1;
      const finFreq =
        fish.gene.species === 'puffer' ? 14 : fish.gene.species === 'seahorse' ? 18 : 6.8;
      const finFlap = Math.sin(time * finFreq + m.phase);
      child.rotation.y = finFlap * 0.32 * side;
      child.rotation.z = Math.cos(time * finFreq + m.phase) * 0.12;
    }
  });

  // Smooth Banking (Roll), Pitch and Yaw Kinematics
  const targetYaw = crab
    ? Math.PI / 2
    : shrimp && m.escapeUntil > time
      ? m.escapeYaw
      : -Math.atan2(v.z, v.x);
  let diffYaw = targetYaw - (m.currentYaw ?? targetYaw);
  while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
  while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;

  m.currentYaw =
    (m.currentYaw ?? targetYaw) +
    diffYaw * Math.min(1.0, dt * (fish.gene.species === 'betta' ? 3.0 : 4.8));

  const targetPitch = Math.atan2(v.y, Math.hypot(v.x, v.z)) * 0.65;
  m.currentPitch =
    (m.currentPitch ?? 0) + (targetPitch - (m.currentPitch ?? 0)) * Math.min(1.0, dt * 4.5);

  const rollLimit = fish.gene.species === 'betta' ? 0.25 : 0.42;
  const targetRoll = T.MathUtils.clamp(-diffYaw * 2.4, -rollLimit, rollLimit);
  m.currentRoll =
    (m.currentRoll ?? 0) + (targetRoll - (m.currentRoll ?? 0)) * Math.min(1.0, dt * 5.0);

  if (crawler) fish.root.rotation.set(0, m.currentYaw, 0, 'YXZ');
  else if (shrimp)
    fish.root.rotation.set(m.currentRoll * 0.25, m.currentYaw, m.currentPitch, 'YXZ');
  else if (fish.gene.species === 'seahorse') {
    fish.root.rotation.set(
      m.currentRoll * 0.3,
      m.currentYaw,
      0.18 + Math.sin(time * 2.0 + m.phase) * 0.06,
      'YXZ',
    );
  } else if (fish.gene.species === 'jellyfish') {
    fish.root.rotation.set(
      Math.cos(time * 1.5 + m.phase) * 0.06 + v.z * 0.15,
      m.currentYaw,
      Math.sin(time * 1.5 + m.phase) * 0.06 + v.x * 0.15,
      'YXZ',
    );
  } else if (fish.gene.species === 'ray') {
    fish.root.rotation.set(m.currentRoll * 1.2, m.currentYaw, m.currentPitch * 0.5, 'YXZ');
  } else {
    fish.root.rotation.set(m.currentRoll, m.currentYaw, m.currentPitch, 'YXZ');
  }
  if (fish.gene.species === 'flyingfish' && m.flight)
    fish.root.rotation.set(0, m.currentYaw, m.flightPitch, 'YXZ');
  if (shrimp && (!crawler || m.escapeUntil > time)) {
    // The curved tail and long antennae sweep below the resting bounds during
    // take-off/landing. Ground the current pose rather than a padded rest box.
    const poseBounds = fish.poseBounds ?? (fish.poseBounds = new T.Box3());
    poseBounds.setFromObject(fish.root);
    const lift = Math.max(0, ground + 0.001 - poseBounds.min.y);
    if (lift > 0) {
      p.y += lift;
      fish.root.position.y = p.y;
      v.y = Math.max(0, v.y);
    }
  }
  groundShrimpFeet(fish, ground);
}
