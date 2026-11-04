import * as T from './vendor/three.module.js';
import { createFish, initialMotion, steerFish } from './fish.js';
import { fishGene, hash, rng } from './genes.js';

export class LandingSchool {

  constructor(stage, anchor) {

    this.stage = stage;
    this.anchor = anchor;
    this.entries = [];
    this.time = 0;
    this.paused = false;
    this.visible = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = T.LinearSRGBColorSpace;
    this.layers = ['back', 'front'].map((side) => {
      const canvas = document.createElement('canvas');
      canvas.className = `school-canvas school-${side}`;
      canvas.setAttribute('aria-hidden', 'true');
      stage.prepend(canvas);
      return { canvas, context: canvas.getContext('2d') };
    });

    this.scene = new T.Scene();
    this.scene.add(new T.AmbientLight('#edf5ef', 1.7));
    const light = new T.DirectionalLight('#e1f4f2', 2);
    light.position.set(-2, 5, 10);
    this.scene.add(light);
    this.camera = new T.PerspectiveCamera(35, 1, 0.1, 2000);
    this.target = new T.WebGLRenderTarget(1, 1, {
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
    });

    this.postScene = new T.Scene();
    this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(
      new T.Mesh(
        new T.PlaneGeometry(2, 2),
        new T.ShaderMaterial({
          uniforms: { image: { value: this.target.texture } },
          vertexShader: `
            varying vec2 vUv;

            void main() {
              vUv = uv;
              gl_Position = vec4(position.xy, 0., 1.);
            }
          `,
          fragmentShader: `
              uniform sampler2D image;
              varying vec2 vUv;

              void main() {
                vec4 c = texture2D(image, vUv);
                gl_FragColor = vec4(pow(max(c.rgb, vec3(0.)), vec3(1. / 2.2)) * c.a, c.a);
              }
            `,
        }),
      ),
    );

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    this.observer.observe(anchor);
    this.observer.observe(anchor.closest('form'));

    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
    }).observe(stage);
    this.reduced.addEventListener('change', () => this.render(0));
    this.resize();
    this.regenerate();

    let last = performance.now(),
      painted = last;

    this.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;

      if (
        !this.visible ||
        document.hidden ||
        document.querySelector('dialog[open]') ||
        this.paused ||
        this.reduced.matches
      )
        return;
      this.time += dt;

      if (now - painted < 1000 / 30) return;
      painted = now;
      this.render();
    });
  }

  regenerate() {

    for (const entry of this.entries) {
      this.scene.remove(entry.holder);
      entry.fish.dispose();
    }

    this.entries = [];
    const seed = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    const random = rng(hash(seed));
    const palettes = [
      ['#729d9a', '#b3ccc2'],
      ['#8497a9', '#d1d6cd'],
      ['#b99562', '#e7d9af'],
    ];

    const [color, accent] = palettes[Math.floor(random() * palettes.length)];
    const species = ['neon', 'goldfish', 'angel'][Math.floor(random() * 3)];

    for (let index = 0; index < 14; index++) {
      const gene = fishGene(seed, index, species);
      const pigment = new T.Color(color).offsetHSL(
        (random() - 0.5) * 0.04,
        (random() - 0.5) * 0.12,
        (random() - 0.5) * 0.12,
      );

      const highlight = new T.Color(accent).offsetHSL(0, 0, (random() - 0.5) * 0.08);

      Object.assign(gene, {
        color: '#' + pigment.getHexString(),
        accent: '#' + highlight.getHexString(),
        mutation: 'none',
        mutation2: 'none',
        effect: 'natural',
        finish: 'matte',
        variant: 'ordinary',
      });

      const fish = createFish(gene);

      fish.motion = initialMotion(seed, gene);

      const box = new T.Box3().setFromObject(fish.root);
      const center = box.getCenter(new T.Vector3());
      const width = box.getSize(new T.Vector3()).x;
      const holder = new T.Group();

      holder.add(fish.root);

      this.scene.add(holder);
      this.entries.push({
        fish,
        holder,
        center,
        width,
        size: 27 + random() * 12,
        lane: random(),
        phase: (index / 14) * Math.PI * 2 + (random() - 0.5) * 0.4,
        drift: random() * Math.PI * 2,
        height: (random() - 0.5) * 48,
        position: new T.Vector3(),
        next: new T.Vector3(),
      });
    }

    this.render();
  }

  resize() {
    this.width = this.stage.clientWidth;
    this.height = this.stage.clientHeight;

    const stage = this.stage.getBoundingClientRect();
    const button = this.anchor.getBoundingClientRect();

    this.schoolScale = button.width / 120;
    this.centerX = button.left + button.width / 2 - stage.left - this.width / 2;
    this.centerY = this.height / 2 - (button.top + button.height / 2 - stage.top);
    this.mobile = this.width < 600;

    const width = Math.max(1, Math.round(this.width / 2));
    const height = Math.max(1, Math.round(this.height / 2));

    this.renderer.setSize(width, height, false);
    this.target.setSize(width, height);

    for (const layer of this.layers) {
      layer.canvas.width = width;
      layer.canvas.height = height;
    }

    this.camera.aspect = this.width / this.height;
    this.camera.position.z = this.height / (2 * Math.tan(T.MathUtils.degToRad(35 / 2)));
    this.camera.updateProjectionMatrix();

    if (this.entries.length) this.render();
  }

  positionAt(entry, time, target) {
    const phase = entry.phase + time * 0.3 + Math.sin(time * 0.35 + entry.drift) * 0.12;
    const scale = this.schoolScale;
    const radius = ((this.mobile ? 108 : 128) + entry.lane * 30) * scale;
    
    return target.set(
      this.centerX + Math.cos(phase) * radius + Math.sin(time * 0.65 + entry.drift) * 9 * scale,
      this.centerY +
        (-Math.sin(phase) * 24 + entry.height + Math.sin(time * 0.9 + entry.drift) * 9) * scale,
      Math.sin(phase) * (86 + entry.lane * 32) * scale,
    );

  }

  render() {
    const time = this.time;
    const forward = new T.Vector3(1, 0, 0);

    for (const entry of this.entries) {

      this.positionAt(entry, time, entry.position);
      this.positionAt(entry, time + 0.025, entry.next);

      steerFish(entry.fish, [entry.fish], time, 0);

      entry.fish.root.position.copy(entry.center).negate();
      entry.fish.root.rotation.set(0, 0, 0);
      entry.fish.material.uniforms.uTime.value = time;
      entry.fish.material.uniforms.uNight.value = 0;
      entry.holder.scale.setScalar((entry.size * this.schoolScale) / entry.width);
      entry.holder.position.copy(entry.position);

      entry.holder.quaternion.setFromUnitVectors(
        forward,
        entry.next.sub(entry.position).normalize(),
      );

      entry.holder.rotateX(Math.sin(time + entry.drift) * 0.1);
    }
    
    for (let index = 0; index < this.layers.length; index++) {

      const layer = this.layers[index];
      
      for (const entry of this.entries)
        entry.holder.visible = index === 0 ? entry.position.z <= 0 : entry.position.z > 0;
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
      layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.context.drawImage(this.renderer.domElement, 0, 0);
    }
  }
}
