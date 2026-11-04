const track = document.querySelector('.fishing-scrollbar');
const line = track.querySelector('.fishing-line');
const hook = track.querySelector('.fishing-hook');
const hit = track;

let start = 24,
  travel = 0,
  maximum = 0,
  queued = false,
  drag = null;

function update() {
  queued = false;
  maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);

  const height = track.clientHeight;

  start = Math.min(24, height * 0.05);
  travel = Math.max(0, height - hook.clientHeight - start);

  const progress = maximum > 0 ? Math.min(1, Math.max(0, scrollY / maximum)) : 0;
  const top = Math.round(start + progress * travel);
  
  hook.style.transform = `translateY(${top}px)`;

  line.style.height = `${top + 1}px`;

  track.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  track.setAttribute('aria-valuetext', `${Math.round(progress * 100)}% da página`);
  track.hidden = maximum === 0;
}

function schedule() {

  if (queued) return;
  queued = true;
  requestAnimationFrame(update);

}

function seek(clientY) {

  const top = track.getBoundingClientRect().top;
  const progress = Math.min(
    1,
    Math.max(0, (clientY - top - drag.offset - start) / Math.max(1, travel)),
  );
  window.scrollTo({ top: progress * maximum, behavior: 'instant' });
}

hit.addEventListener('pointerdown', (event) => {

  if (event.button !== 0) return;
  event.preventDefault();
  update();
  const box = hook.getBoundingClientRect();
  drag = {
    id: event.pointerId,
    offset:
      event.clientY >= box.top && event.clientY <= box.bottom
        ? event.clientY - box.top
        : box.height / 2,
  };
  hit.setPointerCapture(event.pointerId);
  hit.classList.add('is-dragging');
  track.focus({ preventScroll: true });
  seek(event.clientY);
});

hit.addEventListener('pointermove', (event) => {

  if (drag?.id === event.pointerId) seek(event.clientY);
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  hit.addEventListener(type, () => {
    drag = null;
    hit.classList.remove('is-dragging');
  });
}

track.addEventListener('keydown', (event) => {
  let target;
  
  if (event.key === 'Home') target = 0;

  else if (event.key === 'End') target = maximum;
  else if (event.key === 'ArrowDown') target = scrollY + 40;
  else if (event.key === 'ArrowUp') target = scrollY - 40;
  else if (event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey))
    target = scrollY + innerHeight * 0.9;
  else if (event.key === 'PageUp' || (event.key === ' ' && event.shiftKey))
    target = scrollY - innerHeight * 0.9;
  else return;
  event.preventDefault();
  
  window.scrollTo({ top: target, behavior: 'instant' });
});

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule);
window.addEventListener('pageshow', schedule);
window.visualViewport?.addEventListener('resize', schedule);

new ResizeObserver(schedule).observe(document.body);
update();
