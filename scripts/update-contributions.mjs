import { mkdir, writeFile } from 'node:fs/promises';

const username = 'gajonormal';
const response = await fetch(`https://github.com/users/${username}/contributions`, {
  headers: { 'Accept-Language': 'en', 'User-Agent': 'Abisso-contribution-map' },
  signal: AbortSignal.timeout(20000),
});

if (!response.ok) throw new Error(`GitHub respondeu com ${response.status}`);

const html = await response.text();
const counts = new Map();

for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
  const id = match[1].match(/\bfor="([^"]+)"/)?.[1];
  const count = match[2].match(/([\d,]+) contributions? on/);

  if (id) counts.set(id, count ? Number(count[1].replaceAll(',', '')) : 0);
}

const days = [...html.matchAll(/<td\b[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g)]
  .map(([tag, date]) => ({
    date,
    level: Number(tag.match(/data-level="([0-4])"/)?.[1] ?? 0),
    count: counts.get(tag.match(/\bid="([^"]+)"/)?.[1]) ?? 0,
  }))
  .sort((a, b) => a.date.localeCompare(b.date));

if (days.length < 350) throw new Error('Calendário incompleto; o mapa anterior foi preservado.');

const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
const weeks = Math.ceil((offset + days.length) / 7);

const palette = ['#22364b', '#304b63', '#45647e', '#60829a', '#82a4b5'];
const cells = days.map((day, i) => {
  const index = i + offset;

  return `  <rect x="${Math.floor(index / 7) * 13}" y="${(index % 7) * 13}" width="10" height="10" fill="${palette[day.level]}" fill-opacity="${day.level === 0 ? 0.35 : 1}"><title>${day.date}: ${day.count} contributions</title></rect>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${weeks * 13 - 3} 88" shape-rendering="crispEdges" role="img" aria-labelledby="title">
  <title id="title">Contributions by ${username}: ${days[0].date} to ${days.at(-1).date}</title>
${cells.join('\n')}

</svg>\n`;

const output = new URL('../assets/github-contributions.svg', import.meta.url);

await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
await writeFile(output, svg);

console.log(`Mapa atualizado: ${days.length} dias, ${weeks} semanas (${days.at(-1).date}).`);
