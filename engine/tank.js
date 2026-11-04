import { rockMaterial, plantClusterGeometry, addFloorLife } from './aquarium-detail.js';
import { containDecoration, placePlant, buriedRockGeometry } from './decoration-bounds.js';
import * as T from './vendor/three.module.js';
import { hash, rng } from './genes.js';
import { createFish, initialMotion, steerFish } from './fish.js';
import { environment, TANK_SIZES, advanceGrowth, growthScale } from './ecology.js';
import { postFragment } from './optics.js';

const WATER = 3.7;

export class AquariumViewer {
  constructor(container, onSelect, { transparent = false, allowRotation = true, allowZoom = true } = {}) {
    this.container = container;
    this.transparent = transparent;
    this.allowRotation = allowRotation;
    this.allowZoom = allowZoom;
    this.onSelect = onSelect;
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-6, 6, 4.5, -4.5, 0.1, 80);
    this.onZoomChange = null;

    this.renderer = new T.WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: transparent,
    });

    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = T.LinearSRGBColorSpace;
    if (transparent) this.renderer.setClearColor(0x000000, 0);
    container.append(this.renderer.domElement);

    this.target = new T.WebGLRenderTarget(320, 240, {
      type: T.HalfFloatType,
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
    });

    this.target.depthTexture = new T.DepthTexture(320, 240);
    this.subjectTarget = new T.WebGLRenderTarget(320, 240, {
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
    });

    this.subjectMaterial = new T.MeshBasicMaterial({ color: '#ffffff', side: T.DoubleSide });
    this.maskBackground = new T.Color('#000000');
    this.postScene = new T.Scene();
    this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.post = new T.ShaderMaterial({
      uniforms: {
        uScene: { value: this.target.texture },
        uPixel: { value: new T.Vector2(1 / 320, 1 / 240) },
        uBloom: { value: 0.2 },
        uDepth: { value: this.target.depthTexture },
        uPhoto: { value: 0 },
        uFocus: { value: 0.2 },
        uTransparent: { value: transparent ? 1 : 0 },
        uSubject: { value: this.subjectTarget.texture },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0., 1.);
        }
      `,
      fragmentShader: postFragment,
    });
    this.postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.post));

    this.ambient = new T.AmbientLight('#f3e8fa', 1.6);
    this.key = new T.DirectionalLight('#fff3e0', 2.2);
    this.key.position.set(3, 9, 5);
    this.scene.add(this.ambient, this.key);

    this.environment = new T.Group();
    this.scene.add(this.environment);
    this.fish = [];
    this.selected = null;
    this.time = 0;
    this.yaw = 0.68;
    this.pitch = 0.55;
    this.paused = false;
    this.pixel = true;
    this.night = true;
    this.minZoom = 0.55;
    this.maxZoom = 1.5;
    this.config = environment();
    this.focus = new T.Vector3(0, 1.9, 0);
    this.followId = null;
    this.feeding = false;
    this.food = [];
    this.foodGeometry = new T.SphereGeometry(0.035, 6, 4);
    this.foodMaterial = new T.MeshBasicMaterial({ color: '#ffe1a0' });
    this.plantTime = { value: 0 };
    this.onStatus = null;

    this.raycaster = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.cursorWorldPos = null;
    this.interactionPlane = new T.Plane(new T.Vector3(0, 0, 1), 0);

    let drag = null;

    container.addEventListener(
      'wheel',
      (event) => {
        if (!this.allowZoom) return;
        event.preventDefault();
        const units =
          event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
        const delta = T.MathUtils.clamp(event.deltaY * units, -200, 200);
        this.setZoom(this.camera.zoom * Math.exp(-delta * 0.0015));
      },
      { passive: false },
    );

    container.addEventListener('pointerdown', (event) => {

      if (event.button !== 0) return;

      drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
      container.setPointerCapture(event.pointerId);
    });

    container.addEventListener('pointermove', (event) => {
      const rect = container.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hitWorld = new T.Vector3();

      if (this.raycaster.ray.intersectPlane(this.interactionPlane, hitWorld)) {
        this.cursorWorldPos = hitWorld;
      }

      if (!this.allowRotation || !drag || event.buttons !== 1) return;
      this.yaw -= (event.clientX - drag.x) * 0.008;
      this.pitch = T.MathUtils.clamp(this.pitch + (event.clientY - drag.y) * 0.004, 0.12, 1);
      drag.x = event.clientX;
      drag.y = event.clientY;
    });

    container.addEventListener('pointerleave', () => {
      this.cursorWorldPos = null;
    });

    container.addEventListener('pointercancel', () => (drag = null));
    container.addEventListener('lostpointercapture', () => (drag = null));

    container.addEventListener('pointerup', (event) => {

      if (drag && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) {
        const rect = container.getBoundingClientRect();
        this.pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);

        if (this.feeding) {
          const drop = new T.Vector3();
          const surface = new T.Plane(new T.Vector3(0, 1, 0), -this.waterHeight);

          if (
            this.raycaster.ray.intersectPlane(surface, drop) &&
            Math.abs(drop.x) < this.tankSize[0] / 2 - 0.2 &&
            Math.abs(drop.z) < this.tankSize[2] / 2 - 0.2
          )
            this.feed(drop);
          drag = null;

          return;
        }
        const hit = this.raycaster.intersectObjects(
          this.fish.map((f) => f.root),
          true,
        )[0];

        if (hit) {
          this.onSelect?.(hit.object.userData.fishId);
        } else {

          const hitPos = new T.Vector3();

          if (this.raycaster.ray.intersectPlane(this.interactionPlane, hitPos)) {
            this.spawnRipple(hitPos);
          }
        }
      }
      drag = null;
    });

    new ResizeObserver(() => this.resize()).observe(container);
    let last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;

      if (this.suspended) return;
      this.update(dt);
      this.render();
    });
  }

  spawnRipple(pos) {

    if (!this.bubbles) return;
    pos = pos.clone();
    pos.x = T.MathUtils.clamp(pos.x, -this.tankSize[0] / 2 + 0.4, this.tankSize[0] / 2 - 0.4);
    pos.z = T.MathUtils.clamp(pos.z, -this.tankSize[2] / 2 + 0.4, this.tankSize[2] / 2 - 0.4);
    pos.y = T.MathUtils.clamp(pos.y, 0.3, this.waterHeight - 0.2);
    this.disturbance = { position: pos.clone(), until: this.time + 1.6 };
    pos = this.environment.worldToLocal(pos);

    for (let i = 0; i < 4; i++) {
      const bubble = this.bubbles[Math.floor(Math.random() * this.bubbles.length)];

      if (bubble) {
        bubble.position.set(
          pos.x + (Math.random() - 0.5) * 0.4,
          pos.y + (Math.random() - 0.5) * 0.2,
          pos.z + (Math.random() - 0.5) * 0.4,
        );
      }
    }
  }

  feed(point = null) {

    if (this.paused || this.food.length >= 24) return 0;
    const r = rng(hash(this.seed + ':food:' + this.time));
    let added = 0;

    for (let i = 0; i < 6 && this.food.length < 24; i++) {
      const pellet = new T.Mesh(this.foodGeometry, this.foodMaterial);
      pellet.position.set(
        T.MathUtils.clamp(
          (point?.x ?? (r() - 0.5) * 3) + (r() - 0.5) * 0.4,
          -this.tankSize[0] / 2 + 0.2,
          this.tankSize[0] / 2 - 0.2,
        ),
        this.waterHeight - 0.1,
        T.MathUtils.clamp(
          (point?.z ?? (r() - 0.5) * 2) + (r() - 0.5) * 0.4,
          -this.tankSize[2] / 2 + 0.2,
          this.tankSize[2] / 2 - 0.2,
        ),
      );
      pellet.userData.age = 0;
      this.food.push(pellet);
      this.scene.add(pellet);
      added++;
    }

    return added;
  }

  follow(id) {

    if (id !== null && !this.fish.some((f) => f.gene.id === id)) return;

    if (id !== null && this.followId === null) {
      this.previousZoom = this.camera.zoom;
      this.setZoom(this.maxZoom);
    }

    if (id === null && this.followId !== null) this.setZoom(this.previousZoom ?? 1);
    this.followId = id;
  }

  buildEnvironment(seed) {
    this.environment.traverse((o) => {
      o.geometry?.dispose();

      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });

    this.scene.remove(this.environment);
    this.environment = new T.Group();
    this.tankSize = TANK_SIZES[this.config.format];
    this.waterHeight = (WATER * this.tankSize[1]) / 4;
    this.environment.scale.set(
      this.tankSize[0] / 7.1,
      this.tankSize[1] / 4,
      this.tankSize[2] / 4.4,
    );

    this.scene.add(this.environment);

    const r = rng(hash(seed + ':tank')),
      group = this.environment;
    this.obstacles = [];
    this.shelters = [];
    const solidBounds = [];
    const reserveSolid = (mesh) => {
      mesh.updateMatrix();
      mesh.geometry.computeBoundingBox();
      solidBounds.push(
        mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix).expandByScalar(0.08),
      );
      mesh.userData.solidDecoration = true;
    };

    const worldPoint = (p) => new T.Vector3(...p).multiply(group.scale);
    const mat = (color, extra = {}) => new T.MeshToonMaterial({ color, ...extra });
    const waterBase = new T.Color(this.config.waterColor);
    const waterHsl = { h: 0, s: 0, l: 0 };
    waterBase.getHSL(waterHsl);

    const frameSat =
      waterHsl.s < 0.05 ? waterHsl.s : Math.max(0.25, Math.min(0.65, waterHsl.s * 0.9));

    const rimSat = waterHsl.s < 0.05 ? waterHsl.s : Math.max(0.12, Math.min(0.4, waterHsl.s * 0.5));
    const frameColor = new T.Color().setHSL(waterHsl.h, frameSat, 0.038);
    const rimColor = new T.Color().setHSL(waterHsl.h, rimSat, 0.78);

    const frame = mat(frameColor),
      rim = mat(rimColor),
      stone = mat('#929eae');

    const box = (size, pos, material) => {
      const m = new T.Mesh(new T.BoxGeometry(...size), material);
      m.position.set(...pos);

      group.add(m);

      return m;
    };

    box([6.96, 0.09, 4.26], [0, 0.135, 0], mat('#b9c2bd'));

    for (const y of [0, 4]) {

      for (const z of [-2.2, 2.2]) box([7.2, 0.12, 0.12], [0, y, z], frame);
      for (const x of [-3.55, 3.55]) box([0.12, 0.12, 4.5], [x, y, 0], frame);
    }

    for (const x of [-3.55, 3.55]) {
      for (const z of [-2.2, 2.2]) box([0.12, 4, 0.12], [x, 2, z], frame);
    }

    for (const z of [-2.18, 2.18]) box([7.03, 0.025, 0.025], [0, 4.075, z], rim);
    for (const x of [-3.53, 3.53]) box([0.025, 0.025, 4.38], [x, 4.075, 0], rim);

    const glass = new T.MeshPhysicalMaterial({
      color: this.config.waterColor,
      transparent: true,
      opacity: 0.105,
      roughness: 0.1,
      metalness: 0.05,
      side: T.DoubleSide,
      depthWrite: false,
    });

    for (const z of [-2.19, 2.19]) box([7, 3.91, 0.015], [0, 1.99, z], glass);
    for (const x of [-3.53, 3.53]) box([0.015, 3.91, 4.35], [x, 1.99, 0], glass);

    const water = new T.Mesh(
      new T.PlaneGeometry(6.98, 4.3),
      new T.MeshBasicMaterial({
        color: this.config.waterColor,
        transparent: true,
        opacity: 0.16,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );

    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER;
    group.add(water);

    const caustics = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
      vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }
        `,
      fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uNight;

          void main() {
            float n = sin(vUv.x * 42. + sin(vUv.y * 23. + uTime * .6) * 2.) *
                      sin(vUv.y * 35. + sin(vUv.x * 17. - uTime * .4) * 2.);
            float a = pow(max(0., n), 5.) * .12 * (1. - uNight * .6);
            gl_FragColor = vec4(.68, .91, 1., a);
          }
        `,
      transparent: true,
      depthWrite: false,
    });

    this.caustics = caustics;
    const floor = new T.Mesh(new T.PlaneGeometry(6.98, 4.3), caustics);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.19;
    group.add(floor);

    const gravelGeo = new T.IcosahedronGeometry(0.105, 0);
    const gravelMat = mat('#ffffff');
    const gravel = new T.InstancedMesh(gravelGeo, gravelMat, 300);
    const dummy = new T.Object3D();
    const colors =
      this.config.theme === 'abyss'
        ? ['#354557', '#556478', '#66768a']
        : this.config.theme === 'garden'
          ? ['#d2c3da', '#dfd2cf', '#aebfd3']
          : ['#e6cf9d', '#dbc5a3', '#d8ceb8', '#b8c9c9', '#bcb4a1'];

    for (let i = 0; i < 300; i++) {
      dummy.position.set((r() - 0.5) * 6.8, 0.16 + r() * 0.025, (r() - 0.5) * 4.05);
      dummy.scale.set(0.6 + r() * 0.6, 0.28 + r() * 0.3, 0.65 + r() * 0.55);
      dummy.rotation.set(r() * 3, r() * 3, r() * 3);
      containDecoration(dummy, gravelGeo);
      gravel.setMatrixAt(i, dummy.matrix);
      gravel.setColorAt(i, new T.Color(colors[Math.floor(r() * colors.length)]));
    }
    group.add(gravel);

    for (let i = 0; i < 7; i++) {
      const rock = new T.Mesh(
        buriedRockGeometry(0.33 + r() * 0.3, r, i),
        rockMaterial(r, this.config.theme, i),
      );
      rock.position.set((r() - 0.5) * 5.8, 0.25, (r() - 0.5) * 3.1);
      rock.scale.set(1.05 + r() * 0.45, 0.65 + r() * 0.2, 0.7 + r() * 0.35);
      rock.rotation.y = r() * 6;
      
      containDecoration(rock);
      reserveSolid(rock);
      group.add(rock);

      this.obstacles.push({
        position: worldPoint(rock.position.toArray()),
        radius: rock.geometry.parameters.radius * Math.max(group.scale.x, group.scale.z) * 0.85,
      });
    }

    addFloorLife(group, r, this.config.theme, this.config.decoration);

    if (['mixed', 'coral'].includes(this.config.decoration)) {
      const coralColors =
        this.config.theme === 'abyss'
          ? ['#728fda', '#8573c9', '#65c6d3']
          : this.config.theme === 'garden'
            ? ['#cab3e2', '#e8b9ce', '#9ccdc5']
            : ['#df827c', '#f3aa80', '#b6a3d4'];

      for (let i = 0; i < 5; i++) {
        const coral = new T.Group();
        coral.position.set((r() - 0.5) * 5.5, 0.17, (r() - 0.5) * 3.2);
        const coralMat = mat(coralColors[i % 3]);

        for (let j = 0; j < 7; j++) {
          const height = 0.22 + r() * 0.45;
          const branch = new T.Mesh(new T.CylinderGeometry(0.022, 0.045, height, 5), coralMat);
          branch.position.set((r() - 0.5) * 0.35, height / 2, (r() - 0.5) * 0.3);
          branch.rotation.z = (r() - 0.5) * 0.45;
          coral.add(branch);
          const tip = new T.Mesh(
            new T.SphereGeometry(0.05, 6, 4),
            this.config.theme === 'abyss'
              ? new T.MeshBasicMaterial({
                  color: new T.Color(coralColors[i % 3]).multiplyScalar(1.6),
                })
              : coralMat,
          );

          tip.position.copy(branch.position);
          tip.position.y += height / 2;
          coral.add(tip);
        }

        containDecoration(coral);
        group.add(coral);
      }
    }

    if (['mixed', 'cave'].includes(this.config.decoration)) {
      const arch = new T.Mesh(new T.TorusGeometry(0.55, 0.22, 6, 16, Math.PI), stone);
      arch.position.set(-2.1, 0.2, -0.9);
      containDecoration(arch);
      reserveSolid(arch);
      group.add(arch);
      
      for (let i = 0; i <= 6; i++) {
        const angle = (i / 6) * Math.PI;
        this.obstacles.push({
          position: worldPoint([
            arch.position.x + Math.cos(angle) * 0.55,
            arch.position.y + Math.sin(angle) * 0.55,
            arch.position.z,
          ]),
          radius: 0.2 * Math.max(group.scale.x, group.scale.y),
        });
      }
    }

    this.plants = [];

    const plantCount = Math.round(this.config.plants * 30);

    for (let i = 0; i < plantCount; i++) {
      const kind = ['grass', 'ribbon', 'broadleaf', 'bush', 'stem', 'moss'][i % 6];
      const height =
        kind === 'moss'
          ? 0.18 + r() * 0.15
          : kind === 'grass'
            ? 0.35 + r() * 0.4
            : kind === 'broadleaf'
              ? 0.4 + r() * 0.35
              : kind === 'bush'
                ? 0.6 + r() * 0.5
                : kind === 'ribbon'
                  ? 1.1 + r() * 1.2
                  : 0.8 + r() * 1.1;
      const palettes = {
        reef: ['#65ad98', '#7eb69d', '#519e91', '#9dc690'],
        abyss: ['#5369a0', '#625891', '#608fa4'],
        garden: ['#7fbfc1', '#b99dcd', '#9dccab'],
      };

      const palette = palettes[this.config.theme] || palettes.reef;
      const material = mat(
        palette[
          Math.floor(
            i / 6 + ['grass', 'ribbon', 'broadleaf', 'bush', 'stem', 'moss'].indexOf(kind),
          ) % palette.length
        ],
        { side: T.DoubleSide, vertexColors: true },
      );

      const mesh = new T.Mesh(plantClusterGeometry(r, height, kind), material);
      mesh.userData.phase = r() * 6;
      mesh.userData.plantKind = kind;
      if (
        !placePlant(mesh, r, height, solidBounds, ['grass', 'moss'].includes(kind) ? 0.3 : 0.75)
      ) {
        mesh.geometry.dispose();
        material.dispose();
        continue;
      }

      this.shelters.push(worldPoint([mesh.position.x, 0.6, mesh.position.z]));
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uPlantTime = this.plantTime;
        shader.uniforms.uPlantPhase = { value: mesh.userData.phase };
        shader.vertexShader =
          `
            uniform float uPlantTime;
            uniform float uPlantPhase;
          ` +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
              #include <begin_vertex>
              transformed.x +=
                  sin(uPlantTime * .9 + position.y * 3. + uPlantPhase) * .065 * position.y * position.y;
            `,
          );
      };

      group.add(mesh);
      this.plants.push(mesh);
    }

    const particlesGeometry = new T.BufferGeometry(),
      particles = [];

    for (let i = 0; i < 100; i++)
      particles.push((r() - 0.5) * 6.7, 0.3 + r() * 3.2, (r() - 0.5) * 4);
    particlesGeometry.setAttribute('position', new T.Float32BufferAttribute(particles, 3));
    this.particles = new T.Points(
      particlesGeometry,
      new T.PointsMaterial({
        color: '#d1e6ed',
        size: 0.022,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );

    group.add(this.particles);

    this.bubbles = [];

    const bubbleGeo = new T.SphereGeometry(0.035, 8, 6);
    const bubbleMat = new T.MeshBasicMaterial({
      color: '#e8fcff',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    for (let i = 0; i < 34; i++) {
      const mesh = new T.Mesh(bubbleGeo, bubbleMat);
      mesh.position.set((r() - 0.5) * 6.3, r() * 3.65, (r() - 0.5) * 3.5);
      mesh.userData.speed = 0.17 + r() * 0.3;
      mesh.userData.phase = r() * 6;
      group.add(mesh);
      this.bubbles.push(mesh);
    }
  }

  setState(state, { reset = false } = {}) {
    const sameSeed = this.seed === state.seed;
    this.seed = state.seed;

    if (reset) {
      this.time = 0;
      this.disturbance = null;

      for (const pellet of this.food) this.scene.remove(pellet);
      this.food = [];
    }
    
    state.night = true;
    state.pixel = true;
    state.cycle = false;

    this.state = state;
    this.config = environment(state.environment);

    const environmentKey = state.seed + JSON.stringify(this.config);

    if (this.environmentKey !== environmentKey) {
      this.environmentKey = environmentKey;
      this.buildEnvironment(state.seed);

      for (const pellet of this.food) this.scene.remove(pellet);
      this.food = [];
    }

    const previous = new Map(this.fish.map((f) => [f.gene.id, f]));

    this.fish = state.fish.map((gene) => {
      const old = previous.get(gene.id);
      const signature = JSON.stringify({ ...gene, growth: undefined });

      if (sameSeed && !reset && old?.signature === signature) {
        old.gene = gene;
        previous.delete(gene.id);
        return old;
      }

      const f = createFish(gene);
      f.signature = signature;
      f.motion = old && sameSeed && !reset ? old.motion : initialMotion(state.seed, gene);
      this.scene.add(f.root);
      steerFish(f, [], this.time, 0);

      return f;
    });

    for (const f of previous.values()) {
      this.scene.remove(f.root);
      f.dispose();
    }

    for (const f of this.fish) {
      const fit = Math.min(
        1,
        (Math.min(this.tankSize[0], this.tankSize[2]) / 2 - 0.4) / f.clearance.horizontal,
        (this.waterHeight / 2 - 0.18) / f.clearance.vertical,
      );

      f.tankFit = fit;
      f.tankBounds = {
        x: this.tankSize[0] / 2 - 0.13,
        z: this.tankSize[2] / 2 - 0.15,
        top: this.waterHeight - 0.1,
        floor: (0.18 * this.tankSize[1]) / 4,
      };

      f.activeClearance = {
        horizontal: f.clearance.horizontal * fit,
        vertical: f.clearance.vertical * fit,
      };
      f.root.scale.copy(f.adultScale).multiplyScalar(fit * growthScale(f.gene.growth));
      steerFish(f, this.fish, this.time, 0);
    }

    if (this.followId !== null && !this.fish.some((f) => f.gene.id === this.followId))
      this.follow(null);

    this.pixel = state.pixel;
    this.paused = !state.motion;
    this.night = state.night;
    this.scene.background = new T.Color(this.night ? '#0c1930' : '#e6bcc8');
    this.ambient.intensity = this.night ? 0.35 : 1.6;
    this.key.intensity = this.night ? 0.45 : 2.2;
    this.key.color.set(this.night ? '#87a5db' : '#fff3e0');
    this.post.uniforms.uBloom.value = this.night ? 0.85 : 0.22;

    if (reset) {
      this.follow(null);
      this.yaw = 0.68;
      this.pitch = 0.55;
      this.setZoom(1);
    }
    this.container.dataset.fishCount = String(this.fish.length);
    this.resize();
    this.update(0);
    this.render();
  }

  setZoom(value) {

    if (!Number.isFinite(value)) return;
    this.camera.zoom = T.MathUtils.clamp(value, this.minZoom, this.maxZoom);
    this.camera.updateProjectionMatrix();
    this.onZoomChange?.(this.camera.zoom);
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const scale = 3;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.renderer.setSize(Math.round(w / scale), Math.round(h / scale), false);
    this.target.setSize(Math.round(w / scale), Math.round(h / scale));
    this.subjectTarget.setSize(Math.round(w / scale), Math.round(h / scale));
    this.post.uniforms.uPixel.value.set(scale / w, scale / h);
    const half = Math.max(4.6, (this.framePadding ?? 6.6) / (w / h));
    this.camera.left = -half * (w / h);
    this.camera.right = half * (w / h);
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {

    if (!this.paused) this.time += dt;
    const time = this.time;

    const darkness = 1;
    this.scene.background = this.transparent ? null : this.backdrop
      ? new T.Color(this.backdrop)
      : new T.Color(
          this.config.theme === 'abyss'
            ? '#2c4459'
            : this.config.theme === 'garden'
              ? '#ded1e7'
              : '#e6bcc8',
        ).lerp(new T.Color('#0c1930'), darkness);
    this.ambient.intensity = T.MathUtils.lerp(1.6, 0.35, darkness);
    this.key.intensity = T.MathUtils.lerp(2.2, 0.45, darkness);
    this.key.color.set('#fff3e0').lerp(new T.Color('#87a5db'), darkness);
    this.post.uniforms.uBloom.value = T.MathUtils.lerp(0.22, 0.85, darkness);

    for (const f of this.fish) {

      if (!this.paused) {
        f.gene.growth = advanceGrowth(f.gene.growth, dt);
        f.root.scale
          .copy(f.adultScale)
          .multiplyScalar((f.tankFit ?? 1) * growthScale(f.gene.growth));
        steerFish(f, this.fish, time, dt, this.cursorWorldPos, {
          food: this.food,
          night: darkness > 0.5,
          obstacles: this.obstacles,
          shelters: this.shelters,
          disturbance: this.disturbance,
        });

        if (f.targetFood && f.motion.position.distanceTo(f.targetFood.position) < 0.28) {
          f.targetFood.userData.eaten = true;
          f.motion.hunger = Math.max(0, f.motion.hunger - 0.45);
          f.motion.chewUntil = time + 0.9;
          f.motion.action = 'A comer';
        }
      }
      f.material.uniforms.uTime.value = time;
      f.material.uniforms.uNight.value = darkness;
      f.material.uniforms.uGrowth.value = f.gene.growth ?? 1;
    }
    for (const pellet of this.food) {

      if (!this.paused) {
        pellet.userData.age += dt;
        pellet.position.y = Math.max(0.3, pellet.position.y - dt * 0.13);
      }

      if (pellet.userData.eaten || pellet.userData.age > 60) this.scene.remove(pellet);
    }
    this.food = this.food.filter((p) => !p.userData.eaten && p.userData.age <= 60);
    const followed = this.fish.find((f) => f.gene.id === this.followId);
    const focus = followed?.root.position ?? new T.Vector3(0, this.tankSize[1] * 0.475, 0);
    this.focus.lerp(focus, dt > 0 ? 1 - Math.exp(-dt * 5) : 1);
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * 13,
      this.focus.y + Math.tan(this.pitch) * 13,
      this.focus.z + Math.cos(this.yaw) * 13,
    );
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    const photoFish = this.fish.find((f) => f.gene.id === this.selected);

    if (photoFish)
      this.post.uniforms.uFocus.value =
        photoFish.root.position.clone().project(this.camera).z * 0.5 + 0.5;
    this.plantTime.value = time;

    if (this.particles && !this.paused) {
      const attr = this.particles.geometry.attributes.position;

      for (let i = 0; i < attr.count; i++) {
        attr.setX(i, ((attr.getX(i) + 3.35 + dt * 0.025) % 6.7) - 3.35);
        attr.setY(i, ((attr.getY(i) - 0.3 + dt * 0.012) % 3.2) + 0.3);
      }
      attr.needsUpdate = true;
    }
    this.onStatus?.({ food: this.food.length, darkness, followId: this.followId });

    for (const leaf of this.plants || []) {

      leaf.rotation.z =
        Math.sin(time * 0.85 + leaf.userData.phase) * 0.05 +
        Math.sin(time * 1.65 + leaf.userData.phase * 1.3) * 0.02;
    }

    for (const bubble of this.bubbles || []) {

      if (!this.paused) {
        bubble.position.y += dt * bubble.userData.speed;
        bubble.position.x += Math.sin(time * 1.8 + bubble.userData.phase) * dt * 0.12;
        bubble.position.z += Math.cos(time * 1.5 + bubble.userData.phase) * dt * 0.08;

        if (bubble.position.y > WATER - 0.04) bubble.position.y = 0.2;
      }
      bubble.scale.setScalar(0.7 + Math.sin(time + bubble.userData.phase) * 0.15);
    }

    if (this.caustics) {

      this.caustics.uniforms.uTime.value = time;
      this.caustics.uniforms.uNight.value = darkness;
    }
  }

  render() {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);

    if (this.post.uniforms.uPhoto.value) {
      const subject = this.fish.find((f) => f.gene.id === this.selected),
        layers = [];

      if (subject)
        subject.root.traverse((o) => {
          layers.push([o, o.layers.mask]);
          o.layers.enable(2);
        });

      const background = this.scene.background,
        override = this.scene.overrideMaterial,
        cameraLayers = this.camera.layers.mask;

      this.camera.layers.set(2);
      this.scene.background = this.maskBackground;
      this.scene.overrideMaterial = this.subjectMaterial;
      this.renderer.setRenderTarget(this.subjectTarget);
      this.renderer.render(this.scene, this.camera);
      this.scene.background = background;
      this.scene.overrideMaterial = override;
      this.camera.layers.mask = cameraLayers;

      for (const [object, mask] of layers) object.layers.mask = mask;
    }

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  image() {
    this.render();

    const canvas = document.createElement('canvas');

    canvas.width = 1440;
    canvas.height = Math.round((1440 * this.container.clientHeight) / this.container.clientWidth);

    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = !this.pixel;
    ctx.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  }
}
