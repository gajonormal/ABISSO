import assert from 'node:assert/strict';
import * as T from '../engine/vendor/three.module.js';
import { aquarium, sanitize, VARIANTS } from '../engine/genes.js';
import { environment, advanceGrowth, growthScale, TANK_SIZES } from '../engine/ecology.js';
import { sanitizeCollection } from '../engine/collection.js';
import { AquariumViewer } from '../engine/tank.js';
import { createFish } from '../engine/fish.js';

assert.equal(advanceGrowth(0.35, 0), 0.35);
assert.equal(advanceGrowth(0.35, 600), 1);
assert.equal(growthScale(0.35), 0.45);
assert.equal(growthScale(1), 1);
assert.equal(environment({ plants: 999, format: 'bad' }).plants, 1);
assert.equal(environment({ waterColor: 'url(bad)' }).waterColor, '#91c5ea');
const state = aquarium('life', 12);
const baby = { ...state.fish[0], id: 12, growth: 0.35 };
assert.equal(baby.growth, 0.35);
const collection = {
  type: 'mare-collection',
  version: 1,
  fish: [{ key: 'life:12', seed: 'life', gene: baby }],
};
assert.deepEqual(sanitizeCollection(collection), collection);
const transferred = { ...baby, id: 99, sourceSeed: 'life', collectionKey: 'life:12' };
assert.equal(transferred.id, 99);
assert.equal(transferred.growth, 0.35);
assert.equal(transferred.collectionKey, 'life:12');
assert.deepEqual(
  sanitize({ ...aquarium('elsewhere', 1), fish: [transferred] }).fish[0],
  transferred,
);
assert.throws(() =>
  sanitizeCollection({ ...collection, fish: [collection.fish[0], collection.fish[0]] }),
);
const variants = [];
for (const variant of Object.keys(VARIANTS)) {
  const f = createFish({ ...state.fish[0], variant });
  f.root.traverse((o) => assert(!o.geometry?.isTorusGeometry, 'Raised gill arcs must not return'));
  variants.push(f);
  f.dispose();
}

function viewer() {
  const v = Object.create(AquariumViewer.prototype);
  Object.assign(v, {
    scene: new T.Scene(),
    environment: new T.Group(),
    fish: [],
    food: [],
    time: 0,
    yaw: 0.68,
    pitch: 0.55,
    followId: null,
    minZoom: 0.55,
    maxZoom: 1.5,
    focus: new T.Vector3(0, 1.9, 0),
    camera: new T.OrthographicCamera(-6, 6, 4.5, -4.5, 0.1, 80),
    ambient: new T.AmbientLight(),
    key: new T.DirectionalLight(),
    post: { uniforms: { uBloom: { value: 0 } } },
    foodGeometry: new T.SphereGeometry(0.035, 6, 4),
    foodMaterial: new T.MeshBasicMaterial(),
    plantTime: { value: 0 },
    container: { dataset: {} },
    resize() {},
    render() {},
  });
  v.scene.add(v.environment);
  return v;
}
let habitats = 0;
for (const format of Object.keys(TANK_SIZES))
  for (const theme of ['reef', 'abyss', 'garden']) {
    const v = viewer(),
      s = sanitize(state);
    s.environment = { ...environment(), format, theme };
    s.fish.push({ ...baby });
    v.setState(s, { reset: true });
    assert(
      v.plants.length > 0 && v.plants.length <= Math.round(s.environment.plants * 30),
      'plant density must respect available space',
    );
    assert.equal(v.feed(), 6);
    assert.equal(v.food.length, 6);
    for (let i = 0; i < 300; i++) v.update(1 / 30);
    assert(s.fish.at(-1).growth > 0.35);
    for (const f of v.fish) {
      const bounds = new T.Box3().setFromObject(f.root),
        [x, y, z] = TANK_SIZES[format];
      assert(bounds.min.x > -x / 2 && bounds.max.x < x / 2);
      assert(bounds.min.z > -z / 2 && bounds.max.z < z / 2);
      assert(bounds.min.y > 0.12 && bounds.max.y < y);
    }
    // Food at a hungry fish is consumed; paused time cannot advance growth or pellets.
    const f = v.fish[0];
    const pellet = new T.Mesh(v.foodGeometry, v.foodMaterial);
    pellet.position.copy(f.motion.position);
    pellet.userData.age = 0;
    v.scene.add(pellet);
    v.food.push(pellet);
    f.motion.hunger = 1;
    v.update(1 / 30);
    assert(!v.food.includes(pellet));
    v.paused = true;
    const growth = s.fish.at(-1).growth,
      time = v.time,
      count = v.food.length;
    v.update(30);
    assert.equal(s.fish.at(-1).growth, growth);
    assert.equal(v.time, time);
    assert.equal(v.food.length, count);
    assert.equal(v.feed(), 0);
    v.follow(s.fish[0].id);
    assert.equal(v.camera.zoom, v.maxZoom);
    v.follow(null);
    assert.equal(v.camera.zoom, 1);
    v.paused = false;
    s.cycle = true;
    s.cyclePhase = 0;
    v.update(90);
    assert.equal(s.cyclePhase, 0, 'the aquarium must stay at night');
    // No rebuild needed on changes to light, growth or motion.
    const old = v.fish[0];
    v.setState(s);
    assert.equal(s.night, true);
    assert.equal(s.pixel, true);
    assert.equal(s.cycle, false);
    assert.equal(v.fish[0], old);
    v.fish.forEach((f) => f.dispose());
    habitats++;
  }
console.log(
  `OK: ${habitats} habitats/formatos; comida e consumo; crescimento/pausa; noite permanente; acompanhamento; coleção/transferência; variantes sem cílios.`,
);
