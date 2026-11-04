import assert from 'node:assert/strict';
import { fishGene, FINS } from '../engine/genes.js';
import { createFish } from '../engine/fish.js';

const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Sample the longitudinal swim field, including its secondary ripple. A coarse
// tail triangle interpolates a straight line through this curved spine.
function swimZ(x, y, time, uniforms) {
  const nx = x / uniforms.uLength.value,
    t = time * uniforms.uSwimPace.value,
    phase = uniforms.uPhase.value;
  const wave = Math.sin(t * 7.2 + phase + nx * 3.6);
  const spine = 1 - smooth(-1.35, 0.25, nx),
    head = smooth(0.15, 0.95, nx) * 0.06;
  const span = Math.max(
    Math.max(Math.abs(y) / uniforms.uHeight.value - 0.75, 0),
    Math.max(-nx - 0.75, 0),
  );
  return (
    (wave * spine * 0.22 - wave * head * 0.08) * uniforms.uBend.value * 10 +
    Math.sin(t * 8.2 + phase + nx * 4.5 + y * 3.5) * span * 0.045 * uniforms.uBend.value * 8
  );
}
let count = 0;
for (const species of ['angel', 'goldfish', 'discus', 'neon', 'puffer', 'catfish', 'lionfish'])
  for (const tail of ['fork', 'fan', 'round', 'feather'])
    for (const finStyle of Object.keys(FINS))
      for (const size of [0.7, 1.5]) {
        const gene = {
          ...fishGene('caudal-seam', 0, species),
          tail,
          finStyle,
          finSize: size,
          tailLength: size,
          bodyRatio: size,
          bodyWidth: 1.3,
          bodyHeight: 0.8,
          mutation: 'none',
          mutation2: 'none',
        };
        const fish = createFish(gene),
          fins = [];
        fish.root.traverse((mesh) => {
          if (mesh.userData.caudalFin) fins.push(mesh);
        });
        assert(fins.length >= 1, `${species}: missing caudal membrane`);
        const x = fish.material.uniforms.uLength.value,
          y = fish.material.uniforms.uHeight.value;
        for (const fin of fins) {
          const { rows, steps } = fin.userData.caudalFin,
            p = fin.geometry.attributes.position,
            flex = fin.geometry.attributes.aFinFlex;
          for (const key of [
            'uTime',
            'uPhase',
            'uBend',
            'uLength',
            'uMutation',
            'uSwimPace',
            'uSwimType',
          ])
            assert.equal(
              fin.material.uniforms[key],
              fish.material.uniforms[key],
              `${species}: mismatched swim field`,
            );
          assert.deepEqual(fin.position.toArray(), [0, 0, 0]);
          for (let j = 0; j <= steps; j++) {
            // Every root is buried in the posterior body, even the second fan.
            const px = p.getX(j),
              py = p.getY(j),
              pz = p.getZ(j);
            assert(Math.abs(px / x + 0.78) < 1e-6);
            assert(Math.abs(py / y) <= 0.071);
            assert.equal(flex.getX(j), 0, 'root must receive exactly the body wave');
            assert(Number.isFinite(pz));
          }
          // Adjacent longitudinal samples must track the curved spine throughout a
          // swim cycle; previously one triangle spanned the entire waving tail.
          for (let i = 0; i < rows; i++)
            for (let frame = 0; frame < 24; frame++) {
              const a = i * (steps + 1) + steps / 2,
                b = a + steps + 1;
              const ax = p.getX(a),
                ay = p.getY(a),
                bx = p.getX(b),
                by = p.getY(b),
                time = frame / 12;
              const midpoint = swimZ((ax + bx) / 2, (ay + by) / 2, time, fish.material.uniforms);
              const interpolated =
                (swimZ(ax, ay, time, fish.material.uniforms) +
                  swimZ(bx, by, time, fish.material.uniforms)) /
                2;
              assert(
                Math.abs(midpoint - interpolated) < 0.004,
                `${species}: tail cuts across spine motion`,
              );
            }
          assert(p.array.every(Number.isFinite));
          assert(!fin.userData.fin, 'must not apply a second rigid mesh rotation');
        }
        count++;
        fish.dispose();
      }
console.log(
  `OK: ${count} caudal shapes, sizes and fin styles; buried seams; shared animation; curved-spine interpolation.`,
);
