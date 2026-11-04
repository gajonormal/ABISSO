// Reveal the landing only after its procedural scenes have painted their first frame.
try {
  const scenes = await Promise.allSettled([import('./environment.js'), import('./abisso.js')]);

  for (const scene of scenes)

    if (scene.status === 'rejected') console.error('Landing scene unavailable:', scene.reason);

  const images = [...document.images].map((image) => image.decode().catch(() => {}));
  let fontTimeout;

  try {
    await Promise.all([
      ...images,
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => {
          fontTimeout = setTimeout(resolve, 1500);
        }),
      ]),
    ]);
  } finally {
    clearTimeout(fontTimeout);
  }

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  
} finally {
  clearTimeout(window.sceneLoadingFallback);
  document.documentElement.removeAttribute('data-scene-loading');
}
