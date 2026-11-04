import { Vector3 } from './vendor/three.module.js';

export const CRAWLERS = ['shrimp', 'snail', 'crab'];
export function obstacleForce(position, velocity, obstacles, radius) {

  const force = new Vector3();
  const ahead = position.clone().addScaledVector(velocity, 0.55);

  for (const obstacle of obstacles) {
    const difference = ahead.clone().sub(obstacle.position),
      distance = difference.length();
    const reach = obstacle.radius + radius + 0.22;

    if (distance < reach) {
      const normal = distance > 0.0001 ? difference.divideScalar(distance) : new Vector3(1, 0, 0);
      force.addScaledVector(normal, (reach - distance) * 4);
      force.addScaledVector(new Vector3(-normal.z, 0, normal.x), 0.45);
    }
  }
  return force;
}

export function resolveObstacles(position, obstacles, radius, lockedY = null) {

  for (let pass = 0; pass < 3; pass++)
    for (const obstacle of obstacles) {
      const delta = position.clone().sub(obstacle.position);
      let limit = obstacle.radius + radius;

      if (lockedY !== null) {
        position.y = lockedY;
        const vertical = lockedY - obstacle.position.y;

        if (Math.abs(vertical) >= limit) continue;
        limit = Math.sqrt(limit * limit - vertical * vertical);
        delta.y = 0;
      }

      const distance = delta.length();

      if (distance < limit) {
        const y = position.y;
        position
          .copy(obstacle.position)
          .addScaledVector(
            distance > 0.0001 ? delta.divideScalar(distance) : new Vector3(1, 0, 0),
            limit + 0.005,
          );
          
        if (lockedY !== null) position.y = y;
      }
    }
}
