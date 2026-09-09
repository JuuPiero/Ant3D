import { Vec3 } from 'cc';

/**
 * Quadratic Bezier position at t ([0,1]) through control points p0 (start), p1 (mid), p2 (end).
 */
export function bezierPoint(p0: Vec3, p1: Vec3, p2: Vec3, t: number, out: Vec3 = new Vec3()): Vec3 {
    const u = 1 - t;
    out.x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
    out.y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
    out.z = u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z;
    return out;
}

/**
 * Normalized derivative of the same curve at t, i.e. the travel direction.
 */
export function bezierTangent(p0: Vec3, p1: Vec3, p2: Vec3, t: number, out: Vec3 = new Vec3()): Vec3 {
    const u = 1 - t;
    out.x = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    out.y = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    out.z = 2 * u * (p1.z - p0.z) + 2 * t * (p2.z - p1.z);
    return out.lengthSqr() > 1e-8 ? out.normalize() : out;
}

/**
 * Mid control point for a leg between `from` and `to`: raises the arc off the ground and
 * offsets it sideways a little so parallel ants in a swarm don't overlap the same line.
 */
export function arcControlPoint(from: Vec3, to: Vec3, lift: number, sideJitter: number): Vec3 {
    const mid = Vec3.lerp(new Vec3(), from, to, 0.5);
    mid.y += lift;

    const dir = Vec3.subtract(new Vec3(), to, from);
    const side = new Vec3(-dir.z, 0, dir.x);
    if (side.lengthSqr() > 1e-8) {
        side.normalize();
        Vec3.scaleAndAdd(mid, mid, side, sideJitter);
    }

    return mid;
}
