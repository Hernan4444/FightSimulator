export function normalizeToSpeed(vx, vy, targetSpeed) {
    const speed = Math.hypot(vx, vy);
    if (speed <= 0.0001) {
        return { vx: targetSpeed, vy: 0 };
    }

    const scale = targetSpeed / speed;
    return {
        vx: vx * scale,
        vy: vy * scale
    };
}

export function rotateVector(vx, vy, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        vx: vx * c - vy * s,
        vy: vx * s + vy * c
    };
}

export function addRandomDeflection(vx, vy, maxAngle, targetSpeed) {
    const angle = (Math.random() * 2 - 1) * maxAngle;
    const rotated = rotateVector(vx, vy, angle);
    return normalizeToSpeed(rotated.vx, rotated.vy, targetSpeed);
}

export function addRandomDeflectionWithMin(vx, vy, minAngle, maxAngle, targetSpeed) {
    const sign = Math.random() < 0.5 ? -1 : 1;
    const span = Math.max(0, maxAngle - minAngle);
    const angle = sign * (minAngle + Math.random() * span);
    const rotated = rotateVector(vx, vy, angle);
    return normalizeToSpeed(rotated.vx, rotated.vy, targetSpeed);
}

export function angularDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
}
