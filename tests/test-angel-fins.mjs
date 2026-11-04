import assert from 'node:assert/strict';
import { fishGene, FINS } from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
for (const style of Object.keys(FINS))
  for (const shape of ['oval', 'round', 'slender', 'diamond', 'radiant']) {
    const gene = {
      ...fishGene('angel-attachment', 0, 'angel'),
      finStyle: style,
      shape,
      finSize: 1.4,
      bodyHeight: 1.18,
      bodyWidth: 0.82,
      bodyRatio: 1.25,
      mutation: 'twist',
      mutation2: 'melt',
    };
    const fish = createFish(gene),
      fins = [];
    fish.root.traverse((mesh) => {
      if (mesh.userData.anchoredAngelFin) fins.push(mesh);
    });
    assert.equal(fins.length, 2);
    const x = fish.material.uniforms.uLength.value,
      y = fish.material.uniforms.uHeight.value;
    for (const fin of fins) {
      const { side, steps, rows } = fin.userData.anchoredAngelFin;
      assert.equal(fin.geometry.attributes.position.count, (steps + 1) * (rows + 1));
      assert.equal(fin.material.uniforms.uTime, fish.material.uniforms.uTime);
      assert.equal(fin.material.uniforms.uPhase, fish.material.uniforms.uPhase);
      assert.equal(fin.material.uniforms.uMutation, fish.material.uniforms.uMutation);
      assert.equal(fin.material.defines.ANGEL_FIN, 1);
      assert.equal(
        fish.material.defines.ANGEL_FIN,
        undefined,
        'ordinary meshes must not require the fin attribute',
      );
      assert.deepEqual(fin.position.toArray(), [0, 0, 0]);
      for (let i = 0; i <= steps; i++) {
        const root = i * (rows + 1),
          theta = 0.65 + ((2.58 - 0.65) * i) / steps;
        const bodyY = y * Math.sin(theta) * (1 + Math.max(0, Math.cos(theta)) * 0.12);
        assert(Math.abs(fin.geometry.attributes.position.getX(root) - x * Math.cos(theta)) < 1e-6);
        assert(
          Math.abs(fin.geometry.attributes.position.getY(root) - side * (bodyY - 0.008)) < 1e-6,
        );
        assert.equal(
          fin.geometry.attributes.aFinFlex.getX(root),
          0,
          'fin root must never receive extra ripple',
        );
        assert.equal(fin.geometry.attributes.aFinFlex.getX(root + rows), 1);
      }
    }
    fish.motion = initialMotion('angel-attachment', gene);
    for (let frame = 0; frame < 240; frame++) steerFish(fish, [fish], frame / 30, 1 / 30, null);
    assert(fish.root.position.toArray().every(Number.isFinite));
    fish.dispose();
  }
console.log(
  'OK: 25 angel shapes/fin styles; dense membranes; buried roots; zero root ripple; shared animation phase.',
);
for (const style of Object.keys(FINS))
  for (const tail of ['fork', 'fan', 'round', 'feather']) {
    const fish = createFish({
        ...fishGene('betta-rig', 0, 'betta'),
        finStyle: style,
        tail,
        mutation: 'none',
        mutation2: 'none',
      }),
      parts = [];
    fish.root.traverse((p) => parts.push(p));
    assert.equal(parts.filter((p) => p.userData.anchoredBettaFin).length, 2);
    assert.equal(parts.filter((p) => p.userData.bettaTail).length, 1);
    assert.equal(parts.filter((p) => p.userData.bettaPectoral).length, 2);
    for (const mesh of parts.filter(
      (p) => p.userData.anchoredBettaFin || p.userData.bettaTail || p.userData.bettaPectoral,
    )) {
      assert.equal(mesh.material.uniforms.uTime, fish.material.uniforms.uTime);
      assert.equal(mesh.material.uniforms.uPhase, fish.material.uniforms.uPhase);
      assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
      assert(mesh.geometry.attributes.position.count > 50);
      assert(!mesh.userData.fin, 'root-space membranes must not receive rigid mesh rotations');
      const flex = mesh.geometry.attributes.aFinFlex;
      assert(Math.min(...flex.array) === 0 && Math.max(...flex.array) === 1);
    }
    fish.dispose();
  }
console.log(
  'OK: 20 betta fin/tail combinations; all five fins share the body animation and retain fixed roots.',
);
