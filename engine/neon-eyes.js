import * as T from './vendor/three.module.js';

export function neonEyePosition(body, dimensions, side, radius) {

  const x = dimensions[0] * 0.61,
    y = dimensions[1] * 0.26;

  body.updateMatrixWorld(true);

  const ray = new T.Raycaster(
    new T.Vector3(x, y, side * (dimensions[2] + 0.2)),
    new T.Vector3(0, 0, -side),
  );
  
  const hit = ray.intersectObject(body, false)[0];
  const anchor = hit
    ? body.parent.worldToLocal(hit.point.clone())
    : new T.Vector3(x, y, side * dimensions[2] * 0.8);
  anchor.z -= side * radius * 0.25;

  return anchor;
}

export function bindNeonEyes({ root, material, mats }) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    parts = [];
  root.traverse((mesh) => {

    if (mesh.userData.neonEye && !mesh.userData.mutationBind) parts.push(mesh);
  });

  for (const mesh of parts) {
    const transform = new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    mesh.geometry.applyMatrix4(transform);
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    root.add(mesh);
    
    const original = mesh.material,
      eye = material.clone();
    eye.uniforms = {
      ...material.uniforms,
      uEyeColor: { value: original.color?.clone() || new T.Color('#ffffff') },
    };
    
    eye.fragmentShader = `
      uniform vec3 uEyeColor;

      void main() {
        gl_FragColor = vec4(uEyeColor, 1.);
      }
    `;
    eye.transparent = false;
    eye.depthWrite = true;
    mesh.material = eye;
    mats.push(eye);
    mesh.userData.pupil = false;
    mesh.userData.neonEyeBound = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingSphere = mesh.geometry.boundingBox.getBoundingSphere(new T.Sphere());
  }
}
