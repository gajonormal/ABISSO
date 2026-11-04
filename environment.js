import { EntranceEnvironment } from './engine/entrance-environment.js';
import './fishing-scrollbar.js';

const skyCanvas = document.getElementById('sky-canvas');
const bubblesCanvas = document.getElementById('bubbles-canvas');
const reefContainer = document.getElementById('reef-container');

let environment = null;

if (skyCanvas && bubblesCanvas && reefContainer) {
  try {
    environment = new EntranceEnvironment({ skyCanvas, bubblesCanvas, reefContainer });
    environment.setActive(true);
  } catch (err) {
    console.error('Erro ao inicializar o ambiente:', err);
  }
}

function onScroll(immediate = false) {

  if (!environment) return;

  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const reefTop = reefContainer.getBoundingClientRect().top + window.scrollY;
  const start = Math.max(0, reefTop - window.innerHeight);
  const distance = maxScroll - start;
  const progress = distance > 0 ? Math.min(1, Math.max(0, (window.scrollY - start) / distance)) : 1;

  environment.setScroll(progress, immediate);
}

window.addEventListener('scroll', () => onScroll(false), { passive: true });
window.addEventListener('resize', () => onScroll(true));
window.addEventListener('pageshow', () => onScroll(true));

const layoutObserver = new ResizeObserver(() => onScroll(true));

layoutObserver.observe(document.body);
layoutObserver.observe(document.getElementById('content'));

onScroll(true);
