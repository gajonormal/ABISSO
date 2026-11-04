import { aquariumLink } from './engine/aquarium-link.js';
import { randomAquarium } from './engine/random-aquarium.js';
import { specimen } from './engine/specimens.js';
import { LandingSchool } from './engine/landing-school.js';

const $ = (id) => document.getElementById(id);
const stage = document.querySelector('.orbit-stage');

const seed = () => 'abisso-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);

const status = (text) => {
  $('creation-status').textContent = text;
};

function generate(value, color = null) {
  const inhabitant = specimen(value);

  if (color) inhabitant.color = color;
  const state = randomAquarium(value, { inhabitant });
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

  generate(value);
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
  status('Discovering who lives in this image…');

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
    const sums = [0, 0, 0];
    let signature = 0,
      weight = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3] / 255;
      for (let channel = 0; channel < 3; channel++) sums[channel] += pixels[i + channel] * alpha;
      weight += alpha;
      signature =
        (signature * 31 + pixels[i] + pixels[i + 1] * 3 + pixels[i + 2] * 7 + pixels[i + 3]) >>> 0;
    }

    const color =
      '#' +
      sums
        .map((sum) =>
          Math.round(sum / Math.max(1, weight))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    status('Creature generated. Your image stays on this device.');
    generate(String(signature), color);

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
