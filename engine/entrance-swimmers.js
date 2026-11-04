import * as T from './vendor/three.module.js';
import { fishGene } from './genes.js';
import { createFish, initialMotion, steerFish } from './fish.js';


export function createEntranceSwimmers() {

  const scene = new T.Scene(),
    frontScene = new T.Scene(),
    camera = new T.PerspectiveCamera(28, 1, 0.1, 60);
  camera.position.z = 20;

  for (const layer of [scene, frontScene]) {
    layer.add(new T.AmbientLight('#c8d7e9', 0.8), new T.HemisphereLight('#96b8df', '#1c2636', 1));
    const light = new T.DirectionalLight('#dce7f5', 1.3);
    light.position.set(3, 5, 8);
    layer.add(light);
  }

  const seed = 'entrance-' + Math.random().toString(36).slice(2),
    species = [
      'betta',
      'neon',
      'jellyfish',
      'angel',
      'ray',
      'puffer',
      'seahorse',
      'swordfish',
      'monkfish',
    ];

  const items = [];
  let aspect = 1,
    formArea = { left: 0.3, right: 0.7, top: 0.2, bottom: 0.7 };
  const target = () => ({ x: 0.04 + Math.random() * 0.92, y: 0.05 + Math.random() * 0.88 });

  for (let i = 0; i < 7; i++) {
    const gene = fishGene(seed, i, species[Math.floor(Math.random() * species.length)]),
      fish = createFish(gene);
    fish.motion = initialMotion(seed, gene);
    const holder = new T.Group();
    holder.add(fish.root);
    scene.add(holder);
    items.push({
      fish,
      holder,
      x: 0.08 + Math.random() * 0.84,
      y: 0.08 + Math.random() * 0.8,
      z: -2,
      vx: (i % 2 ? -1 : 1) * 0.025,
      vy: (Math.random() - 0.5) * 0.025,
      speed: 0.025 + Math.random() * 0.018,
      size: 0.65 + Math.random() * 0.3,
      target: target(),
      next: 0,
      yaw: i % 2 ? Math.PI : 0,
      roll: 0,
      phase: i === 1 ? 0.3 : i * 1.9,
      depthSpeed: 0.055 + Math.random() * 0.02,
      canFront: i % 3 === 1,
      front: false,
      previous: null,
    });
  }

  function resize(width, height, form) {
    aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    formArea = {
      left: form.left / width,
      right: form.right / width,
      top: form.top / height,
      bottom: form.bottom / height,
    };
    items.forEach((item, i) => {
      item.holder.visible = width > 650 || i < 4;
      item.previous = null;
    });
  }

  function update(time, dt) {

    for (const item of items) {
      if (!item.holder.visible) continue;
      const desiredZ = -1 + Math.sin(time * item.depthSpeed + item.phase) * 5;
      item.z = T.MathUtils.lerp(item.z, desiredZ, 1 - Math.exp(-dt * 0.6));
      const front = item.canFront && item.z > 2.3;

      if (front !== item.front) {
        item.front = front;
        (front ? frontScene : scene).add(item.holder);

        if (front) {
          item.target = {
            x: T.MathUtils.lerp(formArea.left, formArea.right, 0.25 + Math.random() * 0.5),
            y: T.MathUtils.lerp(formArea.top, formArea.bottom, 0.2 + Math.random() * 0.6),
          };
          item.next = time + 9;
        }
      }

      if (time > item.next || Math.hypot(item.target.x - item.x, item.target.y - item.y) < 0.05) {
        item.target = target();
        item.next = time + 8 + Math.random() * 12;
      }

      const dx = (item.target.x - item.x) * aspect,
        dy = item.target.y - item.y,
        dist = Math.max(0.001, Math.hypot(dx, dy));
      let ax = ((dx / dist) * item.speed) / Math.max(0.65, aspect),
        ay = (dy / dist) * item.speed;

      ax += Math.sin(time * 0.27 + item.phase) * 0.006;
      ay += Math.cos(time * 0.23 + item.phase) * 0.008;

      for (const other of items) {
        if (other === item || !other.holder.visible || Math.abs(item.z - other.z) > 1.5) continue;
        const ox = (item.x - other.x) * aspect,
          oy = item.y - other.y,
          od = Math.hypot(ox, oy);

        if (od > 0.001 && od < 0.08) {
          ax += (ox / od) * 0.015;
          ay += (oy / od) * 0.015;
        }
      }

      ax += item.x < 0.03 ? 0.08 : item.x > 0.97 ? -0.08 : 0;
      ay += item.y < 0.04 ? 0.08 : item.y > 0.94 ? -0.08 : 0;
      const blend = 1 - Math.exp(-dt * 0.9);
      item.vx = T.MathUtils.lerp(item.vx, ax, blend);
      item.vy = T.MathUtils.lerp(item.vy, ay, blend);
      item.x = T.MathUtils.clamp(item.x + item.vx * dt, -0.03, 1.03);
      item.y = T.MathUtils.clamp(item.y + item.vy * dt, 0.01, 0.98);
      const span = 2 * Math.tan((14 * Math.PI) / 180) * (20 - item.z);
      const position = new T.Vector3((item.x - 0.5) * span * aspect, (0.5 - item.y) * span, item.z);

      if (item.previous && dt > 0) {
        const velocity = position.clone().sub(item.previous).divideScalar(dt);
        const yaw = Math.atan2(-velocity.z, velocity.x),
          angle = Math.atan2(Math.sin(yaw - item.yaw), Math.cos(yaw - item.yaw));
        item.yaw += angle * (1 - Math.exp(-dt * 1.6));
        const pitch = T.MathUtils.clamp(
          Math.atan2(velocity.y, Math.hypot(velocity.x, velocity.z)),
          -0.65,
          0.65,
        );

        item.roll = T.MathUtils.lerp(item.roll, pitch, blend);
      }

      item.previous = position.clone();
      steerFish(item.fish, [item.fish], time, 0);
      item.fish.root.position.set(0, 0, 0);
      item.fish.root.rotation.set(0, item.yaw, item.roll);
      item.holder.position.copy(position);
      item.holder.scale.setScalar(item.size * (aspect < 0.7 ? 0.8 : 1));
    }
  }

  return { scene, frontScene, camera, resize, update };
  
}
