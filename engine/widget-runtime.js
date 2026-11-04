import { AquariumViewer } from './tank.js';
import { sanitize } from './genes.js';
import { randomAquarium } from './random-aquarium.js';
import { Vector3 } from './vendor/three.module.js';

export function mountWidget(container, config) {
    const seed = 'widget-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    const state = config.random ? randomAquarium(seed) : sanitize(config.state);
    state.pixel = true;
    state.night = true;
    state.cycle = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) state.motion = false;

    const tank = new AquariumViewer(container, null, {
        transparent: config.transparent,
        allowRotation: config.rotation,
        allowZoom: config.zoom,
    });
    tank.backdrop = '#080a0d';
    tank.framePadding = 4.8;
    tank.setState(state, { reset: true });
    const fit = () => {
        tank.resize();
        tank.setZoom(1);
        const [width, height, depth] = tank.tankSize;
        let extent = 0;
        for (const x of [-width / 2, width / 2]) {
            for (const y of [-0.15, height + 0.15]) {
                for (const z of [-depth / 2, depth / 2]) {
                    const point = new Vector3(x, y, z).project(tank.camera);
                    extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
                }
            }
        }
        tank.setZoom(0.9 / Math.max(0.01, extent));
    };
    fit();
    new ResizeObserver(fit).observe(container);
    if (!config.rotation && !config.zoom) container.style.pointerEvents = 'none';

    let inView = true;
    const syncVisibility = () => { tank.suspended = document.hidden || !inView; };
    const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        syncVisibility();
    });
    observer.observe(container);
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', () => { tank.suspended = true; });
    window.addEventListener('pageshow', syncVisibility);
    container.dataset.ready = 'true';
    container.dataset.population = String(state.fish.length);
    container.dataset.seed = state.seed;
}
