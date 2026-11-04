import * as T from './vendor/three.module.js';
import { finEdge } from './morphology.js';

export function buildCaudalFin({ gene, dimensions, finSize, add, material, secondary = false }) {
  const [x, y, z] = dimensions,
    rows = 36,
    steps = 24;
  const root = -x * 0.78;
  const length =
    (gene.tail === 'round' ? 0.24 : 0.32) *
    finSize *
    (gene.tailLength ?? 1) *
    (secondary ? 0.85 : 1);
  const height =
    (gene.tail === 'round' ? 0.21 : gene.tail === 'fork' ? 0.23 : 0.3) *
    finSize *
    (secondary ? 0.8 : 1);
  const positions = [],
    weights = [],
    indices = [];

  for (let i = 0; i <= rows; i++)
    for (let j = 0; j <= steps; j++) {
      const v = i / rows,
        u = j / steps,
        s = u * 2 - 1;
      const spread = T.MathUtils.smoothstep(v, 0.18, 1);
      const edge = finEdge(gene.finStyle || 'native', u);
      let reach = 1;

      if (gene.tail === 'fork') reach = 0.63 + 0.37 * Math.abs(s);

      else if (gene.tail === 'round') reach = 0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - s * s));

      else reach = 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - s * s));

      if (gene.tail === 'feather') reach *= 0.93 + 0.07 * Math.cos(u * Math.PI * 16);

      const travel = x * 0.22 * v + length * v * (1 - spread + spread * reach * edge);
      positions.push(
        root - travel,
        s * (y * 0.07 * (1 - spread) + height * spread),
        secondary ? z * 0.12 + z * 0.6 * spread : 0,
      );
      weights.push(spread * spread);
    }

  for (let i = 0; i < rows; i++)
    for (let j = 0; j < steps; j++) {
      const a = i * (steps + 1) + j,
        b = a + steps + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }

  const geometry = new T.BufferGeometry();

  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aFinFlex', new T.Float32BufferAttribute(weights, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mat = material.clone();

  for (const key of Object.keys(material.uniforms)) mat.uniforms[key] = material.uniforms[key];

  mat.defines = { ...material.defines, ANGEL_FIN: 1 };
  
  add(geometry, mat).userData.caudalFin = { rows, steps, secondary };
}
