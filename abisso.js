import './cursor.js';
import { aquariumLink } from './engine/aquarium-link.js';
import { randomAquarium } from './engine/random-aquarium.js';
import { imageInspiration, textInspiration } from './engine/inspiration.js';
import { LandingSchool } from './engine/landing-school.js';

const $ = (id) => document.getElementById(id);
const stage = document.querySelector('.orbit-stage');

const seed = () => 'abisso-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);

const status = (text) => {
  $('creation-status').textContent = text;
};

function generate(value, inspiration = null) {
  const state = randomAquarium(value, { inspiration });
  state.night = true;
  state.pixel = true;
  state.cycle = false;
  window.location.assign(aquariumLink(state));
}

$('create-creature').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('creature-word').value.trim();

  if (!value) {
    $('creature-word').focus();
    return;
  }

  status('');

  generate(value, textInspiration(value));
});

$('random-summon').addEventListener('click', () => {
  status('');
  generate(seed());
});

$('image-summon').addEventListener('click', () => $('creature-image').click());
$('creature-image').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  const button = $('image-summon');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  status('Discovering an aquarium in this image…');

  try {
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024)
      throw Error('Choose an image up to 20 MB.');
    const bitmap = await createImageBitmap(file, { resizeWidth: 32, resizeHeight: 32 });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, 16, 16);
    bitmap.close();
    const pixels = context.getImageData(0, 0, 16, 16).data;
    const { seed: imageSeed, inspiration } = imageInspiration(pixels);
    status('Aquarium generated. Your image stays on this device.');
    generate(imageSeed, inspiration);
  } catch (error) {
    status(
      error.message.startsWith('Choose')
        ? error.message
        : 'Could not read the image. Try a JPG or PNG.',
    );
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    event.target.value = '';
  }
});

try {
  new LandingSchool(stage, $('image-summon'));
} catch (error) {
  console.error('School unavailable:', error);
}
