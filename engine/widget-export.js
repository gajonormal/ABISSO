import { sanitize } from './genes.js';

const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const utf8Base64 = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
};
const moduleName = (url) => 'abisso/' + new URL(url).pathname.slice(1);
const importsPattern = /(\bfrom\s*|\bimport\s*)(['"])(\.[^'"]+)\2/g;

// Embed the module graph once per session. The saved widget makes no network requests.
let bundlePromise;
async function loadBundle() {
    const entryURL = new URL('./widget-runtime.js', import.meta.url).href;
    const modules = {};
    const visited = new Set();
    let pending = [entryURL];
    while (pending.length) {
        const batch = [...new Set(pending)].filter((url) => !visited.has(url));
        pending = [];
        batch.forEach((url) => visited.add(url));
        const sources = await Promise.all(batch.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw Error('Could not load the widget engine. Please try again.');
            return { url, source: await response.text() };
        }));
        for (const { url, source } of sources) {
            const rewritten = source.replace(importsPattern, (_, prefix, quote, path) => {
                const dependency = new URL(path, url).href;
                pending.push(dependency);
                return prefix + quote + moduleName(dependency) + quote;
            });
            modules[moduleName(url)] = 'data:text/javascript;base64,' + utf8Base64(rewritten);
        }
    }
    const licenseResponse = await fetch(new URL('./vendor/THREE-LICENSE.txt', import.meta.url));
    if (!licenseResponse.ok) throw Error('Could not load the Three.js license. Please try again.');
    return { modules, entry: moduleName(entryURL), license: await licenseResponse.text() };
}

export function widgetHTML(state, { random = false, transparent = true, rotation = true, zoom = true } = {}, bundle) {
    const config = { random, transparent, rotation, zoom, state: random ? null : sanitize(state) };
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Abisso Aquarium Widget</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;color-scheme:light dark;background:${transparent ? 'transparent' : '#080a0d'}}
#aquarium{width:100%;height:100%;touch-action:${rotation ? 'none' : 'auto'}}
#status{position:absolute;inset:0;display:grid;place-items:center;margin:0;padding:24px;text-align:center;font:14px system-ui;color:#888;pointer-events:none}
</style>
<script type="importmap">${json({ imports: bundle.modules })}</script>
<script type="application/json" id="three-license">${json(bundle.license)}</script>
</head>
<body>
<div id="aquarium" role="img" aria-label="Animated Abisso aquarium.${rotation ? ' Drag to rotate.' : ''}${zoom ? ' Scroll to zoom.' : ''}"></div>
<p id="status" role="status">Loading aquarium…</p>
<script type="module">
try {
    const { mountWidget } = await import(${json(bundle.entry)});
    mountWidget(document.getElementById('aquarium'), ${json(config)});
    document.getElementById('status').remove();
} catch (error) {
    document.getElementById('status').textContent = 'This aquarium needs a modern browser with WebGL and JavaScript enabled.';
    console.error('Abisso widget:', error);
}
</script>
</body>
</html>`;
}

export async function createWidgetHTML(state, options) {
    if (!bundlePromise) bundlePromise = loadBundle().catch((error) => {
        bundlePromise = null;
        throw error;
    });
    return widgetHTML(state, options, await bundlePromise);
}

export function widgetEmbed() {
    return '<iframe src="abisso-widget.html" title="Abisso aquarium" loading="lazy" sandbox="allow-scripts" style="display:block;width:100%;height:420px;border:0;background:transparent"></iframe>';
}
