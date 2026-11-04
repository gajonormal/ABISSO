import * as T from './vendor/three.module.js';
import { createEntranceReef } from './entrance-reef.js';
import { createEntranceSwimmers } from './entrance-swimmers.js';
import { createAurora } from './aurora.js';

export class EntranceEnvironment {
  constructor({ skyCanvas, bubblesCanvas, reefContainer }) {
    this.skyCanvas = skyCanvas;
    this.skyContext = skyCanvas.getContext('2d', { alpha: true });

    this.bubblesCanvas = bubblesCanvas;
    this.bubblesContext = bubblesCanvas.getContext('2d', { alpha: true });

    this.reefContainer = reefContainer;
    this.active = false;
    this.time = 0;
    this.frame = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');

    this.scrollProgress = 0;
    this.targetScroll = 0;
    this.initialized = false;

    this.groundY = -3.2;
    this.groundRotX = 0.36;
    this.groundZ = -0.8;

    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.className = 'entrance-ground';
    this.groundCanvas.setAttribute('aria-hidden', 'true');
    this.reefContainer.appendChild(this.groundCanvas);

    this.renderer = new T.WebGLRenderer({
      canvas: this.groundCanvas,
      antialias: false,
      alpha: true,
    });
    this.renderer.setPixelRatio(1 / 3);
    this.renderer.setClearColor(0, 0);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;

    this.frontCanvas = document.createElement('canvas');
    this.frontCanvas.className = 'entrance-foreground';
    this.frontCanvas.setAttribute('aria-hidden', 'true');
    this.reefContainer.appendChild(this.frontCanvas);

    this.frontRenderer = new T.WebGLRenderer({
      canvas: this.frontCanvas,
      antialias: false,
      alpha: true,
    });

    this.frontRenderer.setPixelRatio(1 / 3);
    this.frontRenderer.setClearColor(0, 0);
    this.frontRenderer.toneMapping = T.ACESFilmicToneMapping;

    this.scene = new T.Scene();
    this.scene.fog = new T.Fog('#182a45', 12, 38);

    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 80);
    this.camera.position.set(0, 3.4, 10);
    this.camera.lookAt(0, 2.6, -5);

    this.scene.add(
      new T.AmbientLight('#c5d4e8', 0.5),
      new T.HemisphereLight('#8eaed5', '#1a2332', 0.85),
    );

    const key = new T.DirectionalLight('#c8daf0', 1.35);
    key.position.set(3, 6, 4);
    this.scene.add(key);

    const fill = new T.DirectionalLight('#8a9ec0', 0.7);
    fill.position.set(-4, 2, 2);
    this.scene.add(fill);

    this.root = new T.Group();
    this.scene.add(this.root);

    const ramp = new T.DataTexture(new Uint8Array([115, 174, 255]), 3, 1, T.RedFormat);
    ramp.minFilter = ramp.magFilter = T.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;

    this.toon = (color, side = T.FrontSide) =>
      new T.MeshToonMaterial({ color, gradientMap: ramp, side });
    this.buildSand();
    this.reef = createEntranceReef(this.root, this.toon, this.elevation.bind(this));
    this.swimmers = createEntranceSwimmers();
    this.renderer.autoClear = false;
    this.dt = 0;

    this.aurora = createAurora();
    this.stars = Array.from({ length: 25 }, () => {
      const hue = Math.random();

      return {
        x: Math.random(),
        y: Math.random() ** 1.6 * 0.22,
        big: Math.random() < 0.18,
        color: hue < 0.72 ? '#f2f0ea' : hue < 0.88 ? '#9fd3e8' : '#f2d24c',
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        born: -0.8,
      };
    });

    this.nextMeteor = 1.8 + Math.random() * 1.2;
    this.meteor = null;

    this.particles = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * 6.28,
      speed: 0.3 + Math.random() * 0.7,
    }));
    this.bubbles = Array.from({ length: 12 }, () => ({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * 6.28,
      speed: 0.6 + Math.random() * 0.5,
      radius: 0.8 + Math.random() * 1.1,
    }));

    this.tick = (now) => {
      this.frame = 0;

      if (!this.active) return;
      this.dt = document.hidden ? 0 : Math.min(1 / 30, (now - this.last) / 1000);
      this.time += this.dt;
      this.last = now;

      this.scrollProgress +=
        (this.targetScroll - this.scrollProgress) * (1 - Math.exp(-16 * this.dt));
      this.applyScrollPose();

      this.draw();

      if (!this.reduced.matches) this.frame = requestAnimationFrame(this.tick);
    };

    this.resize = () => {
      const w = innerWidth,
        h = innerHeight;
      this.skyCanvas.width = Math.max(1, Math.round(w / 3));
      this.skyCanvas.height = Math.max(1, Math.round((h * 0.6) / 3));

      const bubblesRect = this.bubblesCanvas.getBoundingClientRect();
      const bubblesH = Math.max(h, bubblesRect.height || Math.round(h * 1.4));
      this.bubblesCanvas.width = Math.max(1, Math.round(w / 3));
      this.bubblesCanvas.height = Math.max(1, Math.round(bubblesH / 3));
      const waterTop = this.bubblesCanvas.parentElement.getBoundingClientRect().top;
      this.bubblesWaterline =
        (Math.max(0, waterTop - bubblesRect.top) / bubblesH) * this.bubblesCanvas.height;

      this.renderer.setSize(w, h, false);
      this.frontRenderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();

      const form = document.getElementById('card-bottom') || document.body;
      this.swimmers.resize(w, h, form.getBoundingClientRect());

      if (this.active) this.draw();
    };

    window.addEventListener('resize', this.resize);
    this.reduced.addEventListener('change', () => {

      if (this.active) {
        this.setActive(false);
        this.setActive(true);
      }
    });

    this.resize();
  }

  setScroll(val, immediate = false) {
    this.targetScroll = Math.max(0, Math.min(1, val));

    if (immediate || !this.initialized || this.reduced.matches) {
      this.initialized = true;
      this.scrollProgress = this.targetScroll;
      this.applyScrollPose();

      if (this.active) this.draw();
    }
  }

  applyScrollPose() {
    const p = this.scrollProgress;
    const ease = p * p * (3 - 2 * p);

    this.groundY = -3.2 * (1 - ease);
    this.groundRotX = 0.36 * (1 - ease);
    this.groundZ = -0.8 * (1 - ease);
    this.root.position.set(0, this.groundY, this.groundZ);
    this.root.rotation.x = this.groundRotX;
    this.camera.position.set(0, 3.4 + 1.2 * (1 - ease), 10);
    this.camera.lookAt(0, 2.6 - 0.35 * (1 - ease), -5);
  }

  elevation(x, z) {
    const edge = T.MathUtils.smoothstep(Math.hypot(x * 0.6, z - 4), 2, 9);
    return (
      (Math.sin(x * 0.19) * Math.cos(z * 0.16) * 0.5 +
        Math.sin(x * 0.41 + 1.7) * Math.sin(z * 0.32 + 0.6) * 0.2) *
      edge
    );
  }

  buildSand() {
    let terrain = new T.PlaneGeometry(90, 44, 90, 44);

    terrain.rotateX(-Math.PI / 2);
    terrain.translate(0, 0, -12);

    let positions = terrain.attributes.position;
    
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, this.elevation(positions.getX(i), positions.getZ(i)));
    const indexed = terrain;
    terrain = terrain.toNonIndexed();
    indexed.dispose();
    terrain.computeVertexNormals();
    positions = terrain.attributes.position;

    const colors = new Float32Array(positions.count * 3),
      sand = [new T.Color('#c5beaf'), new T.Color('#9dafc2')];

    for (let i = 0; i < positions.count; i += 3) {
      const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
      const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
      const color = sand[0]
        .clone()
        .lerp(sand[1], 0.5 + 0.5 * Math.sin(x * 0.45 + z * 0.7) * Math.sin(x * 0.8 - z * 0.3));

      for (let j = 0; j < 3; j++) color.toArray(colors, (i + j) * 3);
    }

    terrain.setAttribute('color', new T.BufferAttribute(colors, 3));
    const sandMesh = new T.Mesh(
      terrain,
      new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    );

    this.root.add(sandMesh);

    this.caustics = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
          varying vec3 vPoint;

          void main() {
            vPoint = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }
        `,
      fragmentShader: `
          varying vec3 vPoint;
          uniform float uTime;

          void main() {
            vec2 p = vPoint.xz;
            float n =
                sin(p.x * 2.4 + sin(p.y * 1.3 + uTime * .4)) * sin(p.y * 2.1 + sin(p.x * 1.7 - uTime * .3));
            float a = pow(max(0., n), 4.) * .16 * (1. - smoothstep(8., 26., -p.y));
            gl_FragColor = vec4(.62, .76, .94, a);
          }
        `,
    });

    const light = new T.Mesh(terrain.clone(), this.caustics);
    light.position.y = 0.025;
    this.root.add(light);
  }

  setActive(active) {

    if (this.active === active) return;
    this.active = active;
    cancelAnimationFrame(this.frame);
    this.frame = 0;

    if (active) {
      this.time = this.reduced.matches ? 2 : 0;
      this.dt = 0;
      this.resize();
      this.last = performance.now();
      this.draw();

      if (!this.reduced.matches) this.frame = requestAnimationFrame(this.tick);
    }
  }

  drawSky() {
    const c = this.skyContext,
      w = this.skyCanvas.width,
      h = this.skyCanvas.height,
      t = this.time;
    c.clearRect(0, 0, w, h);

    this.aurora.draw(c, w, h, t, this.reduced.matches);

    for (const star of this.stars) {
      const fade = T.MathUtils.clamp((t - star.born) / 0.8, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase);
      const x = Math.round(star.x * w);
      const y = Math.round(star.y * h);
      c.globalAlpha = fade * pulse * pulse;
      c.fillStyle = star.color;
      c.fillRect(x, y, 1, 1);

      if (star.big && pulse > 0.8) {
        c.globalAlpha *= (pulse - 0.8) / 0.2;
        c.fillRect(x - 1, y, 1, 1);
        c.fillRect(x + 1, y, 1, 1);
        c.fillRect(x, y - 1, 1, 1);
        c.fillRect(x, y + 1, 1, 1);
      }
    }

    if (!this.meteor && t > this.nextMeteor) {
      this.meteor = {
        x: 0.1 + Math.random() * 0.7,
        y: 0.14 * (0.1 + Math.random() * 0.4),
        dx: 1 + Math.random() * 0.4,
        dy: 0.22 + Math.random() * 0.16,
        start: t,
      };
      this.nextMeteor = t + 8 + Math.random() * 8;
    }

    if (this.meteor) {
      const m = this.meteor,
        prog = (t - m.start) / 0.7;

      if (prog >= 1) this.meteor = null;

      else {
        const x = m.x * w + m.dx * prog * 50,
          y = m.y * h + m.dy * prog * 50;
        c.fillStyle = '#f7f4ee';

        for (let i = 0; i < 9; i++) {
          c.globalAlpha = (1 - prog) * (1 - i / 9);
          c.fillRect(Math.round(x - m.dx * i * 1.6), Math.round(y - m.dy * i * 1.6), 1, 1);
        }
      }
    }

    c.globalAlpha = 1;

  }

  drawBubbles() {
    const c = this.bubblesContext,
      w = this.bubblesCanvas.width,
      h = this.bubblesCanvas.height,
      t = this.time;
    c.clearRect(0, 0, w, h);

    const waterline = this.bubblesWaterline || 0;
    const visibility = (y, radius) =>
      T.MathUtils.smoothstep(y, waterline + radius + 2, waterline + radius + h * 0.18) *
      T.MathUtils.smoothstep(h - y, radius, radius + h * 0.04);

    for (const particle of this.particles) {
      const x = (particle.x + Math.sin(t * 0.16 + particle.phase) * 0.006) * w;
      const y = ((particle.y - t * particle.speed * 0.009 + 10) % 1) * h;
      c.globalAlpha =
        (0.14 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.4 + particle.phase))) * visibility(y, 1);
      c.fillStyle = '#8eaacb';
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    c.strokeStyle = '#85a7cb';
    c.lineWidth = 1;

    for (const bubble of this.bubbles) {
      const x = (bubble.x + Math.sin(t * 0.55 + bubble.phase) * 0.012) * w;
      const y = ((bubble.y - t * bubble.speed * 0.024 + 10) % 1) * h;
      c.globalAlpha = 0.22 * visibility(y, bubble.radius);
      c.beginPath();
      c.arc(Math.round(x), Math.round(y), bubble.radius, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  draw() {
    this.drawSky();
    this.drawBubbles();

    this.reef.update(this.time);
    this.caustics.uniforms.uTime.value = this.time;

    const w = innerWidth,
      h = innerHeight;
  
    this.renderer.setViewport(0, 0, w, h);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    this.renderer.clearDepth();
    this.swimmers.update(this.time, this.dt);
    this.renderer.render(this.swimmers.scene, this.swimmers.camera);
    this.frontRenderer.render(this.swimmers.frontScene, this.swimmers.camera);
    this.dt = 0;
  }
}
