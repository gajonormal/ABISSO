// Cortinas de luz desenhadas no canvas pixelizado do céu, atrás das estrelas.
export function createAurora() {
  // Poucos níveis na textura mantêm o grão retro sem desenhar blocos grandes.
  const curtains = [
    ['#8066cb', '#396eab', '#329f9c', '#8ae7af'],
    ['#8872cf', '#507ba3', '#37b5a0', '#b0edd2'],
    ['#9972c2', '#446fa6', '#35958b', '#74d7b1'],
  ].map((colors) => {

    const strip = document.createElement('canvas');
    strip.width = 1;
    strip.height = 24;

    const context = strip.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 24);

    gradient.addColorStop(0, `${colors[0]}00`);
    gradient.addColorStop(0.18, `${colors[0]}28`);
    gradient.addColorStop(0.45, `${colors[1]}50`);
    gradient.addColorStop(0.72, `${colors[2]}88`);
    gradient.addColorStop(0.88, `${colors[3]}bb`);
    gradient.addColorStop(0.94, `${colors[3]}dd`);
    gradient.addColorStop(1, `${colors[2]}00`);

    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, 24);
    
    return strip;
  });

  let next = 30 + Math.random() * 30;
  let event = null;

  return {
    draw(c, width, height, time, reduced) {
      if (reduced) return;

      if (!event && time >= next) {
        event = {
          start: time,
          duration: 18 + Math.random() * 8,
          phase: Math.random() * Math.PI * 2,
        };
      }

      if (!event) return;
      const age = time - event.start;

      if (age >= event.duration) {
        next = time + 60 + Math.random() * 60;
        event = null;
        return;
      }

      const fadeIn = Math.min(1, age / 5);
      const fadeOut = Math.min(1, (event.duration - age) / 6);
      const opacity = fadeIn * fadeIn * (3 - 2 * fadeIn) * fadeOut * fadeOut * (3 - 2 * fadeOut);

      c.save();
      c.globalCompositeOperation = 'screen';
      c.imageSmoothingEnabled = false;

      const block = 2;

      for (let layer = 2; layer >= 0; layer--) {
        const phase = event.phase + layer * 1.4;
        const breathe = 0.92 + 0.08 * Math.sin(time * 0.35 + phase);

        for (let x = 0; x < width; x += block) {
          const u = x / width;
          const edgeFade = Math.min(1, u / 0.13, (1 - u) / 0.13);
          const edge = edgeFade * edgeFade * (3 - 2 * edgeFade);
          const wave = Math.sin(u * 6.5 + time * (0.1 + layer * 0.025) + phase);
          const fold = Math.sin(u * 19 - time * 0.18 + phase + wave * 1.8);
          const rays = 0.65 + 0.35 * Math.pow(Math.sin(u * 57 + fold * 2 + time * 0.12), 2);
          const bottom = Math.round(height * (0.31 + layer * 0.065 + wave * 0.08 + fold * 0.023));
          const reach = Math.sin(u * 11 + phase - time * 0.07);
          const length = Math.round(height * (0.23 + 0.1 * rays + 0.04 * wave + reach * 0.025));
          const light = opacity * edge * rays * breathe * (layer === 0 ? 0.5 : 0.27);

          c.globalAlpha = light * 0.12;
          c.drawImage(curtains[layer], x, bottom - length, block, length + 5);
          c.globalAlpha = light;
          c.drawImage(curtains[layer], x, bottom - length, block, length);

        }
      }

      c.restore();

    },
  };
}
