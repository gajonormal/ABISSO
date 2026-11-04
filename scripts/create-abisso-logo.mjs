import { writeFile } from 'node:fs/promises';

const glyphs = {
  a: ['0000', '0000', '1111', '0001', '1111', '1001', '1111'],
  b: ['1000', '1000', '1110', '1001', '1001', '1001', '1111'],
  i: ['1', '0', '1', '1', '1', '1', '1'],
  s: ['0000', '0000', '1111', '1000', '1111', '0001', '1111'],
  o: ['0000', '0000', '1111', '1001', '1001', '1001', '1111'],
};

let offset = 0;

const cells = [];

for (const letter of 'abisso') {
  glyphs[letter].forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === '1') cells.push(`<rect x="${offset + x}" y="${y}" width="1" height="1"/>`);
    }),
  );
  offset += glyphs[letter][0].length + 1;
}

const width = offset - 1;

await writeFile(
  new URL('../assets/abisso.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 7" fill="#96999c" shape-rendering="crispEdges"><title>abisso</title><path d="M0 5H${width}V7H0Z" fill="#484b4f"/><g>${cells.join('')}</g></svg>\n`,
);
