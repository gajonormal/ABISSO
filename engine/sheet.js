import '../cursor.js';
import { editorRoute } from './editor-route.js';
import {
  SPECIES,
  PATTERNS,
  SHAPES,
  VARIANTS,
  EFFECTS,
  FINISHES,
  MUTATIONS,
  EYES,
  MOUTHS,
  FINS,
  SHELLS,
  TEMPERAMENTS,
  fishGene,
  aquarium,
  sanitize,
  compatibleShapes,
  compatibleTails,
  compatibleEyeStyles,
  compatibleMouthStyles,
  compatibleFinStyles,
} 
from './genes.js';

import { specimen, encodeSpecimen, decodeSpecimen } from './specimens.js';
import { sanitizeCollection } from './collection.js';
import { AquariumViewer } from './tank.js';
import { randomAquarium } from './random-aquarium.js';
import { THEMES, FORMATS, DECORATIONS, aquariumCapacity } from './ecology.js';

const $ = (id) => document.getElementById(id),
  params = new URLSearchParams(location.search);

let seed = params.get('seed') || 'abisso',
  gene = specimen(seed),
  original,
  toastTimer,
  tankState = null;

let collection = { type: 'mare-collection', version: 1, fish: [] };

try {
  collection = sanitizeCollection(JSON.parse(localStorage.getItem('mare.collection.v1')));
} catch {}

try {
  if (params.has('c')) ({ seed, gene } = decodeSpecimen(params.get('c')));

  if (location.hash.startsWith('#a=')) {
    tankState = sanitize(JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3))))));
    gene = tankState.fish.find((f) => f.id === Number(params.get('selected'))) || tankState.fish[0];
    seed = gene.sourceSeed || tankState.seed;
  }

} catch {
  notify('That link could not be loaded. A new creature is ready.');
}

original = structuredClone(gene);

let swimming = tankState?.motion ?? true;

const tank = new AquariumViewer($('aquarium-stage'), (id) => {
  const selected = tankState?.fish.find((f) => f.id === id);

  if (selected) {
    gene = selected;
    seed = gene.sourceSeed || tankState.seed;
    original = structuredClone(gene);
    tank.selected = id;
    sync();
    updateURL();
    openMenu();
  }

});

tank.backdrop = '#000000';
tank.framePadding = 4.8;
tank.suspended = true;

function applyTank(reset = false) {
  tankState.pixel = true;
  tankState.night = true;
  tankState.cycle = false;
  tankState.motion = swimming;
  tank.setState(tankState, { reset });

  if (reset) {
    tank.setZoom(tankState.environment.format === 'tall' ? 0.8 : 0.9);
  }
  tank.selected = gene.id;
  syncHabitat();
}

let generatingAquarium = false;
async function newAquarium() {
  
  if (generatingAquarium) return;
  generatingAquarium = true;
  const stage = $('aquarium-stage'),
    buttons = [...document.querySelectorAll('[data-action="aquarium"]')],
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let outgoing, incoming;
  buttons.forEach((button) => (button.disabled = true));
  stage.setAttribute('aria-busy', 'true');
  stage.style.pointerEvents = 'none';
  try {

    if (!reduced) {
      outgoing = stage.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: 'ease-in',
        fill: 'forwards',
      });
      await outgoing.finished;
    }

    const value = randomSeed();

    seed = value;
    tankState = randomAquarium(value);
    gene = tankState.fish[0];
    original = structuredClone(gene);
    renderAquarium();
    sync();
    closeMenu();

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (!reduced) {
      incoming = stage.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' },
      );
      outgoing?.cancel();
      await incoming.finished;
    }
  } catch (error) {

    console.error('Aquarium generation failed:', error);
    notify('Could not generate this aquarium. Please try again.');

  } finally {
    outgoing?.cancel();
    incoming?.cancel();
    stage.style.pointerEvents = '';
    stage.removeAttribute('aria-busy');
    buttons.forEach((button) => (button.disabled = false));
    generatingAquarium = false;
  }
}

function notify(text) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2800);
}

function updateURL() {
  const p = new URLSearchParams();
  p.set('c', encodeSpecimen(seed, gene));
  p.set('view', 'aquarium');
  p.set('selected', gene.id);
  const fragment = tankState
    ? '#a=' + btoa(unescape(encodeURIComponent(JSON.stringify(tankState))))
    : '';
  history.replaceState(null, '', location.pathname + '?' + p + fragment);
}

function selectedKey() {

  return `${seed}:${gene.id}`;
}

function select(next, nextSeed = seed) {
  const previousId = gene.id;
  seed = String(nextSeed).slice(0, 64);

  if (tankState) {
    const index = tankState.fish.findIndex((f) => f.id === previousId);
    gene = { ...next, id: previousId, sourceSeed: seed };

    if (index >= 0) tankState.fish[index] = gene;
    else tankState.fish.push(gene);

  } else {
    gene = next;
    tankState = randomAquarium(seed, { inhabitant: gene });
  }
  original = structuredClone(gene);
  renderAquarium();
  sync();
}

function goHome() {
  window.location.assign('../');
}

function renderAquarium() {
  document.body.dataset.view = 'aquarium';
  $('share-ready').hidden = true;
  tank.suspended = false;
  $('aquarium-stage').hidden = false;
  $('tank-tools').hidden = false;
  if (!tankState) tankState = randomAquarium(seed, { inhabitant: gene });

  if (!tankState.fish.some((f) => f.id === gene.id)) {
    gene = tankState.fish[0];
    original = structuredClone(gene);
  }

  applyTank(tank.state !== tankState);
  $('mode-hint').textContent =
    'AQUARIUM · ' +
    tankState.fish.length +
    ' CREATURE' +
    (tankState.fish.length === 1 ? '' : 'S') +
    ' · drag to rotate, scroll to zoom';
  updateURL();
}

function randomSeed() {

  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000);
}

function another() {

  const next = randomSeed();
  select(specimen(next), next);
}

function closeMenu() {

  $('inspector').hidden = true;
  $('menu-toggle').setAttribute('aria-expanded', 'false');
}

function showPanel(name) {

  for (const button of document.querySelectorAll('[data-panel]'))
    button.setAttribute('aria-pressed', String(button.dataset.panel === name));
  
  for (const panel of document.querySelectorAll('.editor-panel'))
    panel.hidden = panel.id !== 'panel-' + name;
  openMenu();
}
document
  .querySelectorAll('[data-panel]')
  .forEach((button) => (button.onclick = () => showPanel(button.dataset.panel)));

function openMenu() {

  $('inspector').hidden = false;
  $('menu-toggle').setAttribute('aria-expanded', 'true');
}

function sync() {
  $('specimen-seed').value = seed;
  $('creature-name-input').value = gene.name;
  $('save-creature').textContent = collection.fish.some((f) => f.key === selectedKey())
    ? 'UPDATE SAVED CREATURE'
    : 'SAVE CREATURE TO COLLECTION';

  syncControls();
  syncCollection();
  syncHabitat();
}

let scheduled = false;

function scheduleRebuild() {

  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const index = tankState.fish.findIndex((f) => f.id === gene.id);

    if (index >= 0) tankState.fish[index] = gene;
    applyTank();
    sync();
    updateURL();
  });
}

const controls = new Map(),
  sections = new Map();

function section(name, open = false) {
  const details = document.createElement('details');
  details.className = 'gene-section';
  details.open = open;

  const summary = document.createElement('summary'),
    fields = document.createElement('div');

  summary.textContent = name;
  fields.className = 'gene-fields';
  details.append(summary, fields);
  $('gene-controls').append(details);
  sections.set(name, fields);

  return fields;
}

function range(parent, key, label, lo, hi, step = 0.01) {
  const row = document.createElement('label');
  row.className = 'gene-range';

  const text = document.createElement('span'),
    input = document.createElement('input'),
    output = document.createElement('output');

  text.textContent = label;

  input.type = 'range';
  input.min = lo;
  input.max = hi;
  input.step = step;
  input.id = 'gene-' + key;

  row.htmlFor = input.id;
  row.append(text, input, output);
  parent.append(row);
  controls.set(key, { input, output });

  input.addEventListener('input', () => {
    gene[key] = Number(input.value);
    output.textContent = Number(input.value).toFixed(step === 1 ? 0 : 2);
    scheduleRebuild();
  });
}

function dropdown(parent, key, label, options) {
  const row = document.createElement('label');
  row.className = 'gene-select';
  const text = document.createElement('span'),
    input = document.createElement('select');
  text.textContent = label;
  input.id = 'gene-' + key;
  row.htmlFor = input.id;

  for (const [value, title] of Object.entries(options)) input.add(new Option(title, value));
  row.append(text, input);
  parent.append(row);
  controls.set(key, { input, options });
  input.addEventListener('change', () => {

    if (key === 'species') {
      const old = gene;
      gene = fishGene(seed, old.id, input.value);

      for (const field of [
        'name',
        'color',
        'accent',
        'effect',
        'finish',
        'mutation',
        'mutation2',
        'mutationSize',
        'growth',
        'generation',
        'parents',
        'pedigree',
      ])
        gene[field] = old[field];

    } else gene[key] = input.value;
    scheduleRebuild();
  });
}

function palette(parent, key, label, colors) {
  const title = document.createElement('p');
  title.className = 'palette-label';
  title.textContent = label;
  const row = document.createElement('div');
  row.className = 'swatches';
  
  for (const color of colors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = color;
    button.setAttribute('aria-label', label + ' ' + color);
    button.style.background = color;
    button.onclick = () => {
      gene[key] = color;
      scheduleRebuild();
    };

    row.append(button);
  }
  
  const input = document.createElement('input');

  input.type = 'color';
  input.id = 'gene-' + key;
  input.setAttribute('aria-label', 'Custom ' + label);

  input.oninput = () => {
    gene[key] = input.value;
    scheduleRebuild();
  };
  controls.set(key, { input });
  row.append(input);
  parent.append(title, row);
}

const anatomy = section('ANATOMY', true);
dropdown(anatomy, 'species', 'species', SPECIES);
dropdown(anatomy, 'shape', 'body shape', SHAPES);
range(anatomy, 'bodyRatio', 'length', 0.8, 1.25);
range(anatomy, 'bodyHeight', 'height', 0.82, 1.18);
range(anatomy, 'bodyWidth', 'depth', 0.82, 1.18);
range(anatomy, 'scale', 'size', 0.5, 1.6);
const eyes = section('EYES');
dropdown(eyes, 'eyeStyle', 'type', EYES);
range(eyes, 'eyeSize', 'size', 0.7, 1.35);
range(eyes, 'eyePairs', 'extra pairs', 1, 4, 1);
palette(eyes, 'eyeColor', 'eye colour', [
  '#202039',
  '#284e69',
  '#59682c',
  '#743e65',
  '#8a5529',
  '#59b7bf',
  '#bb6937',
  '#bd6eb7',
  '#f5e050',
  '#f0c9a0',
]);

const mouth = section('MOUTH');

dropdown(mouth, 'mouthStyle', 'shape', MOUTHS);
range(mouth, 'mouthSize', 'opening', 0.7, 1.3);
const fins = section('FINS & TAIL');
dropdown(fins, 'finStyle', 'fins', FINS);
range(fins, 'finSize', 'length', 0.65, 1.4);

dropdown(fins, 'tail', 'tail', {
  fork: 'fork',
  fan: 'fan',
  round: 'round',
  feather: 'feather',
  spiral: 'spiral',
  whip: 'whip',
  tentacle: 'tentacle',
});

range(fins, 'tailLength', 'tail length', 0.8, 1.2);

const mutation = section('MUTATION');
dropdown(mutation, 'mutation', 'primary', MUTATIONS);
dropdown(mutation, 'mutation2', 'secondary', MUTATIONS);
range(mutation, 'mutationSize', 'strength', 0.7, 1.8);
range(anatomy, 'clawSize', 'claws', 0.65, 1.5);
range(anatomy, 'antennaLength', 'antennae', 0.65, 1.5);
dropdown(anatomy, 'shellType', 'shell', SHELLS);
range(anatomy, 'shellSpire', 'shell spire', 0.7, 1.35);
const skin = section('STYLE');

dropdown(
  skin,
  'effect',
  'colour mode',
  Object.fromEntries(
    Object.entries(EFFECTS).filter(([key]) =>
      ['natural', 'albino', 'melanistic', 'golden', 'cosmic'].includes(key),
    ),
  ),
);

dropdown(skin, 'pattern', 'markings', PATTERNS);
dropdown(skin, 'finish', 'surface effect', FINISHES);
range(skin, 'patternScale', 'pattern size', 0.7, 1.5);
range(skin, 'intensity', 'effect strength', 0, 1);

palette(skin, 'color', 'skin color', [
  '#fdf6e3',
  '#f3b65a',
  '#e94f37',
  '#df7da5',
  '#9ef0a0',
  '#5ee0c8',
  '#8fd4f5',
  '#817bd4',
  '#c9a0ff',
  '#f0c9a0',
  '#314e66',
  '#6a3c78',
]);

palette(skin, 'accent', 'accent', [
  '#ffffff',
  '#ffe1a0',
  '#f5e050',
  '#ff6f9c',
  '#9ef0a0',
  '#5ee0c8',
  '#8fd4f5',
  '#d8c7ef',
  '#c9a0ff',
  '#f0c9a0',
  '#20303a',
]);

dropdown(skin, 'variant', 'special detail', VARIANTS);

palette(anatomy, 'shellColor', 'shell color', [
  '#b9aa8a',
  '#abb6bd',
  '#c9a9bc',
  '#d9b176',
  '#94aca3',
]);

const colourHint = document.createElement('p');

colourHint.id = 'colour-mode-hint';
colourHint.className = 'micro';
colourHint.textContent = 'This colour mode overrides the base colours.';
skin.append(colourHint);
const behavior = section('BEHAVIOUR');
dropdown(behavior, 'temperament', 'personality', TEMPERAMENTS);
range(behavior, 'speed', 'speed', 0.15, 1.4);
const habitat = $('habitat-controls');
habitat.innerHTML =
  '<div class="gene-fields"><div id="habitat-fields"></div><label class="gene-range">plant density<input id="tank-plants" type="range" min="0" max="1" step=".05"><output id="tank-plants-value"></output></label><label class="gene-select">water colour<input type="color" id="tank-water"></label><div class="button-row"><button id="tank-add">ADD CREATURE</button><button id="tank-remove">REMOVE SELECTED</button></div></div>';

for (const [key, label, options] of [
  ['theme', 'environment', THEMES],
  ['format', 'format', FORMATS],
  ['decoration', 'decoration', DECORATIONS],
]) {
  const row = document.createElement('label');
  row.className = 'gene-select';
  row.textContent = label;
  const input = document.createElement('select');
  input.id = 'tank-' + key;

  for (const [value, title] of Object.entries(options)) input.add(new Option(title, value));
  row.append(input);
  $('habitat-fields').append(row);
  input.onchange = () => {

    if (key === 'format' && tankState.fish.length > aquariumCapacity(input.value)) {
      notify(
        'This format supports ' +
          aquariumCapacity(input.value) +
          ' creatures. Remove some inhabitants before switching.',
      );
      input.value = tankState.environment.format;

      return;
    }
    tankState.environment[key] = input.value;
    applyTank();
    updateURL();
  };
}

function syncHabitat() {

  if (!tankState) return;
  $('tank-pause').setAttribute('aria-pressed', String(!swimming));
  $('tank-pause').textContent = swimming ? 'PAUSE' : 'RESUME';
  $('tank-feed').disabled = !swimming;
  $('tank-resident').replaceChildren(
    ...tankState.fish.map(
      (f) => new Option((f.id === gene.id ? '● ' : '') + f.name + ' · ' + SPECIES[f.species], f.id),
    ),
  );
  $('tank-resident').value = gene.id;

  for (const key of ['theme', 'format', 'decoration'])
    $('tank-' + key).value = tankState.environment[key];
  $('tank-plants').value = tankState.environment.plants;
  $('tank-plants-value').textContent = Math.round(tankState.environment.plants * 100) + '%';
  $('tank-water').value = tankState.environment.waterColor;
  $('tank-follow').setAttribute('aria-pressed', String(tank.followId === gene.id));
  $('tank-remove').disabled = tankState.fish.length <= 1;
  $('tank-add').disabled = tankState.fish.length >= aquariumCapacity(tankState.environment.format);
  $('tank-add').title =
    'Capacity: ' + aquariumCapacity(tankState.environment.format) + ' creatures';
  $('mode-hint').textContent =
    'AQUARIUM · ' +
    tankState.fish.length +
    ' CREATURE' +
    (tankState.fish.length === 1 ? '' : 'S') +
    ' · drag to rotate, scroll to zoom';
}
$('tank-resident').onchange = () => {
  gene = tankState.fish.find((f) => f.id === Number($('tank-resident').value));
  seed = gene.sourceSeed || tankState.seed;
  original = structuredClone(gene);
  tank.selected = gene.id;
  sync();
  updateURL();
};
$('tank-plants').onchange = () => {
  tankState.environment.plants = Number($('tank-plants').value);
  applyTank();
  updateURL();
};
$('tank-water').onchange = () => {
  tankState.environment.waterColor = $('tank-water').value;
  applyTank();
  updateURL();
};
$('tank-add').onclick = () => {

  if (tankState.fish.length >= aquariumCapacity(tankState.environment.format)) {
    notify('This aquarium has reached its capacity.');

    return;
  }

  gene = fishGene(seed + ':added', tankState.nextId++);
  tankState.fish.push(gene);
  original = structuredClone(gene);
  applyTank();
  sync();
  updateURL();
};
$('tank-remove').onclick = () => {

  if (tankState.fish.length <= 1) return;
  tankState.fish = tankState.fish.filter((f) => f.id !== gene.id);
  gene = tankState.fish[0];
  seed = gene.sourceSeed || tankState.seed;
  original = structuredClone(gene);
  applyTank();
  sync();
  updateURL();
};

$('tank-follow').onclick = () => {
  tank.follow(tank.followId === gene.id ? null : gene.id);
  syncHabitat();
};

tank.onZoomChange = (zoom) => {
  $('tank-zoom-out').disabled = zoom <= tank.minZoom;
  $('tank-zoom-in').disabled = zoom >= tank.maxZoom;
  $('aquarium-stage').dataset.zoom = zoom.toFixed(2);
};

$('tank-zoom-out').onclick = () => tank.setZoom(tank.camera.zoom / 1.15);
$('tank-zoom-in').onclick = () => tank.setZoom(tank.camera.zoom * 1.15);

$('tank-pause').onclick = () => {
  swimming = !swimming;
  applyTank();
  sync();
  updateURL();
};

$('tank-feed').onclick = () =>
  notify(tank.feed() ? 'Food added to the water.' : 'The aquarium is paused or already has food.');
$('tank-picture').onclick = () => {
  download(tank.image(), 'abisso-aquarium.png');
};

function syncControls() {
  $('colour-mode-hint').hidden = !['albino', 'melanistic', 'golden', 'cosmic'].includes(
    gene.effect,
  );

  const visible = {
    clawSize: gene.species === 'crab',
    antennaLength: ['shrimp', 'snail'].includes(gene.species),
    shellType: gene.species === 'snail',
    shellSpire: gene.species === 'snail',
    shellColor: gene.species === 'snail',
    mutationSize: gene.mutation !== 'none' || gene.mutation2 !== 'none',
    eyePairs: gene.mutation === 'extraEyes' || gene.mutation2 === 'extraEyes',
    eyeColor: !['albino', 'melanistic'].includes(gene.effect),
    patternScale: gene.pattern !== 'plain',
    intensity: [
      'glow',
      'rainbow',
      'pearl',
      'shimmer',
      'glass',
      'constellation',
      'wet',
      'hologram',
      'oil',
      'plasma',
    ].includes(gene.finish),
    mouthSize: !['shrimp', 'snail', 'crab', 'jellyfish'].includes(gene.species),
    finSize: !['shrimp', 'snail', 'crab'].includes(gene.species),
    tailLength: !['snail', 'crab'].includes(gene.species),
  };

  for (const [key, show] of Object.entries(visible)) {
    const input = controls.get(key)?.input;

    if (!input) continue;
    const row = input.closest('label') || input.closest('.swatches');
    row.hidden = !show;

    if (row.classList.contains('swatches')) row.previousElementSibling.hidden = !show;
  }

  const allowed = {
    shape: compatibleShapes(gene.species),
    tail: compatibleTails(gene.species),
    eyeStyle: compatibleEyeStyles(gene.species),
    mouthStyle: compatibleMouthStyles(gene.species),
    finStyle: compatibleFinStyles(gene.species),
  };
  const variantInput = controls.get('variant').input;
  const variantKeys = Object.keys(VARIANTS).filter(
    (key) =>
      !['snail', 'crab', 'shrimp'].includes(gene.species) || !['veil', 'asymmetric'].includes(key),
  );
  variantInput.replaceChildren(...variantKeys.map((key) => new Option(VARIANTS[key], key)));

  for (const [key, { input, output, options }] of controls) {

    if (allowed[key]) {
      input.closest('label').hidden = allowed[key].length === 1;
      input.replaceChildren(
        ...allowed[key].map((value) => new Option(options[value] || value, value)),
      );
      input.disabled = allowed[key].length === 1;
    }
    input.value =
      key === 'effect' && ['glow', 'rainbow', 'pearl'].includes(gene.effect)
        ? 'natural'
        : (gene[key] ?? '');

    if (output) output.textContent = Number(gene[key] ?? 1).toFixed(input.step === '1' ? 0 : 2);
  }

  for (const fields of sections.values())
    fields.parentElement.hidden = !Array.from(fields.children).some((child) => !child.hidden);
}

function syncCollection() {
  $('saved-count').textContent = collection.fish.length;
  $('saved-list').replaceChildren();
  if (!collection.fish.length) {
    const empty = document.createElement('p');
    empty.className = 'micro';
    empty.textContent = 'No saved creatures yet.';
    $('saved-list').append(empty);
  }

  for (const entry of collection.fish) {
    const row = document.createElement('div');
    row.className = 'saved-row';
    const open = document.createElement('button'),
      remove = document.createElement('button');
    open.textContent = entry.gene.name + ' · ' + SPECIES[entry.gene.species];
    open.onclick = () => select(structuredClone(entry.gene), entry.seed);
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove ' + open.textContent);
    remove.onclick = () => {
      collection.fish = collection.fish.filter((f) => f.key !== entry.key);
      saveCollection();
      sync();
    };
    row.append(open, remove);
    $('saved-list').append(row);
  }
}
function saveCollection() {

  try {
    localStorage.setItem('mare.collection.v1', JSON.stringify(collection));

    return true;

  } catch {
    notify('Storage is full. Export your collection to keep it.');

    return false;
  }

}

let exportURL = null;

function download(url, name) {

  if (exportURL?.startsWith('blob:')) URL.revokeObjectURL(exportURL);
  exportURL = url;
  const panel = $('download-ready'),
    link = $('download-link');
  link.href = url;
  link.download = name;
  link.textContent = 'DOWNLOAD ' + name + ' ↓';
  (document.querySelector('dialog[open]') || document.body).append(panel);
  panel.hidden = false;
  link.click();
}

function jsonDownload(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  download(url, name);
}

async function copy(text) {

  try {
    await navigator.clipboard.writeText(text);
    notify('Copied.');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    notify('Copied.');
  }
}

function code() {
  $('code-dialog').querySelector('strong').textContent = 'AQUARIUM CODE';
  $('gene-json').value = JSON.stringify(tankState, null, 2);
  $('code-dialog').showModal();
}

const actions = {
  another,
  aquarium: () => newAquarium(),
  share: () => {
    updateURL();
    copy(location.href);
    $('share-link').href = location.href;
    $('share-ready').hidden = false;
  },
  code,
};

document
  .querySelectorAll('[data-action]')
  .forEach((button) => button.addEventListener('click', () => actions[button.dataset.action]()));

$('back').onclick = () => goHome();
$('menu-toggle').onclick = () => {
  $('inspector').hidden ? openMenu() : closeMenu();
};
$('close-menu').onclick = closeMenu;

$('word-form').onsubmit = (e) => {
  e.preventDefault();
  const value = $('specimen-seed').value.trim();

  if (value) select(specimen(value), value);
};
$('creature-name-input').oninput = () => {
  const value = $('creature-name-input').value.trim();

  if (!value) return;
  gene.name = value;

  if (tankState) {
    const i = tankState.fish.findIndex((f) => f.id === gene.id);

    if (i >= 0) tankState.fish[i] = gene;
  }
  syncHabitat();
  updateURL();
};

$('reset').onclick = () => {
  gene = structuredClone(original);
  scheduleRebuild();
};

$('save-creature').onclick = () => {
  const key = selectedKey(),
    index = collection.fish.findIndex((f) => f.key === key);

  if (index < 0 && collection.fish.length >= 64) {
    notify('Your collection holds 64 creatures. Export it before starting another.');
    return;
  }

  const entry = { key, seed, gene: structuredClone(gene) };

  if (index < 0) collection.fish.push(entry);

  else collection.fish[index] = entry;

  if (!saveCollection()) return;
  sync();
  notify(index < 0 ? 'Saved to your collection.' : 'Saved creature updated.');
};
$('export-collection').onclick = () => jsonDownload(collection, 'abisso-collection.json');
$('import-collection').onclick = () => $('collection-file').click();
$('collection-file').onchange = async () => {

  try {
    const file = $('collection-file').files[0];

    if (!file) return;

    if (file.size > 3000000) throw Error('File too large.');

    const incoming = sanitizeCollection(JSON.parse(await file.text()));
    const map = new Map(collection.fish.map((e) => [e.key, e]));
    incoming.fish.forEach((e) => map.set(e.key, e));

    if (map.size > 64) throw Error('The collection holds at most 64 creatures.');
    collection = { ...collection, fish: [...map.values()] };

    if (!saveCollection()) return;
    sync();
    notify('Collection imported.');
  } catch (error) {
    notify(error.message || 'Invalid collection.');
  } finally {
    $('collection-file').value = '';
  }
};
document
  .querySelectorAll('[data-close]')
  .forEach((b) => (b.onclick = () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        dialog.close();
    }
  }),
);
$('copy-json').onclick = () => copy($('gene-json').value);
$('download-json').onclick = () => {

  try {
    jsonDownload(JSON.parse($('gene-json').value), 'abisso-creature.json');
  } catch {
    notify('Fix the JSON before downloading.');
  }
};

$('dismiss-share').onclick = () => ($('share-ready').hidden = true);
$('dismiss-download').onclick = () => ($('download-ready').hidden = true);
window.addEventListener('pagehide', () => {

  if (exportURL?.startsWith('blob:')) URL.revokeObjectURL(exportURL);
});
function loadData(raw) {

  if (raw.fish) {
    tankState = sanitize(raw);
    seed = tankState.seed;
    gene = tankState.fish[0];
    original = structuredClone(gene);
    swimming = tankState.motion;
    renderAquarium();
    sync();
    $('code-dialog').close();
    notify('Aquarium loaded.');

    return;
  }

  let value;

  if (raw.v === 1 && raw.gene)
    value = decodeSpecimen(btoa(unescape(encodeURIComponent(JSON.stringify(raw)))));
  else {
    const g = sanitize({ ...aquarium(seed, 1), fish: [raw], nextId: (raw.id ?? 0) + 1 }).fish[0];
    value = { seed, gene: g };
  }

  select(value.gene, value.seed);
  $('code-dialog').close();
  notify('Creature loaded.');
}

$('load-json').onclick = () => {

  try {
    loadData(JSON.parse($('gene-json').value));
  } catch (error) {
    notify(error.message || 'Invalid file.');
  }
};

$('save-aquarium').onclick = () => {

  if (tankState) jsonDownload(tankState, 'abisso-aquarium.json');
};

$('load-file').onclick = () => $('aquarium-file').click();
$('aquarium-file').onchange = async () => {

  try {
    const file = $('aquarium-file').files[0];

    if (!file) return;

    if (file.size > 3000000) throw Error('File too large.');

    loadData(JSON.parse(await file.text()));
    showPanel('creature');
  } catch (error) {
    notify(error.message || 'Invalid file.');
  } finally {
    $('aquarium-file').value = '';
  }
};

document.addEventListener('keydown', (e) => {

  if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
    if (!$('inspector').hidden) closeMenu();
    else goHome();
  }
});

if (tankState) {
  swimming = tankState.motion;
}
sync();

if (editorRoute(params, !!tankState) === 'landing') goHome();

else renderAquarium();
closeMenu();

if (tankState && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  
  $('aquarium-stage').animate(
    [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration: 500, easing: 'ease-out' },
  );
