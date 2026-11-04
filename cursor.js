// Four moving bars share the exact pointer position; only their gap is animated.
const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
const root = document.documentElement;
const cursor = document.createElement('div');
cursor.className = 'crosshair-cursor';
cursor.setAttribute('aria-hidden', 'true');
cursor.innerHTML = `<div class="crosshair-shape">
    <i class="crosshair-top"></i><i class="crosshair-right"></i>
    <i class="crosshair-bottom"></i><i class="crosshair-left"></i>
</div>`;
document.body.append(cursor);

const interactive = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
    'summary', 'label[for]', '[role="button"]', '[role="link"]',
    '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
    '[data-cursor="interactive"]', '#aquarium-stage', '.fishing-scrollbar',
].join(',');

let x = 0, y = 0, frame = 0, visible = false, pressed = false;

function paint() {
    frame = 0;
    if (!visible) return;
    const host = document.querySelector('dialog[open]') || document.body;
    if (cursor.parentElement !== host) host.append(cursor);
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const target = document.elementFromPoint(x, y)?.closest(interactive);
    const actionable = target && !target.matches(':disabled, [aria-disabled="true"]')
        && !target.closest('[inert]');
    cursor.classList.toggle('is-focused', Boolean(actionable));
    cursor.classList.toggle('is-pressed', pressed);
}

function schedulePaint() {
    if (!frame) frame = requestAnimationFrame(paint);
}

function hide() {
    visible = false;
    pressed = false;
    root.classList.remove('crosshair-enabled');
    cursor.classList.remove('is-focused', 'is-pressed');
}

function trackPointer(event) {
    if (event.pointerType !== 'mouse' || !finePointer.matches || event.target instanceof HTMLIFrameElement) {
        hide();
        return;
    }
    x = event.clientX;
    y = event.clientY;
    if (!visible) {
        visible = true;
        // Position before hiding the native cursor to avoid a flash at the origin.
        paint();
        root.classList.add('crosshair-enabled');
    }
    schedulePaint();
}

document.addEventListener('pointermove', trackPointer, { passive: true });
document.addEventListener('pointerover', trackPointer, { passive: true });

document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') {
        hide();
        return;
    }
    trackPointer(event);
    pressed = true;
    schedulePaint();
}, { passive: true });

window.addEventListener('pointerup', () => {
    pressed = false;
    schedulePaint();
}, { passive: true });
document.addEventListener('scroll', schedulePaint, { capture: true, passive: true });
document.addEventListener('close', schedulePaint, true);
document.documentElement.addEventListener('pointerleave', hide);
window.addEventListener('pointercancel', hide);
window.addEventListener('blur', hide);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
});
finePointer.addEventListener('change', hide);
