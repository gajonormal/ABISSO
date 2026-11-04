export const postFragment = `
uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform sampler2D uSubject;
uniform vec2 uPixel;
uniform float uBloom;
uniform float uPhoto;
uniform float uFocus;
varying vec2 vUv;

vec3 bright(vec2 p) {
  vec3 c = texture2D(uScene, p).rgb;
  return c * max(0., max(c.r, max(c.g, c.b)) - 1.05) / (max(c.r, max(c.g, c.b)) + .001);
}

void main() {
  vec3 color = texture2D(uScene, vUv).rgb;
  float blur = clamp(abs(texture2D(uDepth, vUv).r - uFocus) * 45.0, 0.0, 1.0) * uPhoto *
               (1.0 - texture2D(uSubject, vUv).r);

  if (blur > 0.01) {
    vec3 soft = color;

    for (int i = 0; i < 8; i++) {
      float a = float(i) * .785398;
      soft += texture2D(uScene, vUv + vec2(cos(a), sin(a)) * uPixel * blur * 5.0).rgb;
    }

    color = mix(color, soft / 9.0, blur);
  }

  vec3 glow = bright(vUv) * .12;

  for (int i = 0; i < 8; i++) {
    float a = float(i) * .785398;
    vec2 d = vec2(cos(a), sin(a)) * uPixel;
    glow += bright(vUv + d * 2.) * .055 + bright(vUv + d * 4.) * .037 + bright(vUv + d * 7.) * .025;
  }

  color += glow * uBloom;
  gl_FragColor = vec4(pow(max(color, vec3(0.)), vec3(1. / 2.2)), 1.);
}
`;
