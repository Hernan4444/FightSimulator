// Importar constantes desde constants.js
import {
    ARENA,
    PLAYER,
    WEAPONS,
    WEAPON_SPAWN,
    COLLISION,
    WEAPON_COLORS,
    LOOP_BREAKER,
    EVENTS,
    EVENT_SPAWN,
    EVENT_COLORS
} from './constants.js';
import { addRandomDeflection, addRandomDeflectionWithMin, angularDelta, normalizeToSpeed } from './game_utils.js';
import { ArenaPickup } from './pickups.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const ARENA_CENTER = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

let gameRunning = true;
let gameOverShown = false;
let gamePhase = 'running';
let deathAnimation = null;

class DeathExplosion {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.startTime = Date.now();
        this.duration = 900;
        this.particles = [];

        for (let i = 0; i < 38; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.8 + Math.random() * 4.8;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 24 + Math.floor(Math.random() * 24),
                maxLife: 48,
                size: 2 + Math.random() * 4
            });
        }
    }

    getProgress() {
        return Math.min(1, (Date.now() - this.startTime) / this.duration);
    }

    isFinished() {
        return this.getProgress() >= 1;
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.965;
            p.vy *= 0.965;
            p.life -= 1;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        const t = this.getProgress();
        const ringR = 16 + t * 76;
        const ringA = Math.max(0, 0.9 * (1 - t));

        ctx.strokeStyle = `rgba(255, 180, 80, ${ringA})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 120, 60, ${Math.max(0, 0.35 * (1 - t))})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 18 + t * 28, 0, Math.PI * 2);
        ctx.fill();

        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = `rgba(255, 210, 130, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ==================== CLASES ====================

class Player {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = PLAYER.RADIUS;
        this.color = color;
        
        // Inicializar velocidad con dirección aleatoria y magnitud constante
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * PLAYER.SPEED;
        this.vy = Math.sin(angle) * PLAYER.SPEED;
        
        this.lives = PLAYER.MAX_LIVES;
        this.isEliminated = false;
        this.weapon = null;
        this.rotation = 0;

        // Estado de congelamiento
        this.frozenUntil = 0;
        this.savedVelocity = null;

        // Efecto visual de daño
        this.hitFlashUntil = 0;
        this.hitRingUntil = 0;
        this.hitParticles = [];

        // Efecto visual de curacion
        this.healFlashUntil = 0;
        this.healRingUntil = 0;
        this.healParticles = [];

        // Estado anti-loop
        this.lastHeading = Math.atan2(this.vy, this.vx);
        this.stableHeadingFrames = 0;
    }

    update() {
        const now = Date.now();

        // Restaurar velocidad al terminar congelamiento
        if (this.frozenUntil > 0 && now >= this.frozenUntil) {
            if (this.savedVelocity) {
                this.vx = this.savedVelocity.vx;
                this.vy = this.savedVelocity.vy;
            }
            this.frozenUntil = 0;
            this.savedVelocity = null;
        }

        // Si esta congelado no se mueve ni usa arma
        if (this.frozenUntil > now) {
            this.updateParticles();
            return;
        }

        // Movimiento
        this.x += this.vx;
        this.y += this.vy;

        // Colisión con las paredes del círculo
        const dx = this.x - ARENA_CENTER.x;
        const dy = this.y - ARENA_CENTER.y;
        const distFromCenter = Math.hypot(dx, dy);

        if (distFromCenter + this.radius > ARENA.RADIUS) {
            // Posicionar en el borde exacto
            const normalLength = distFromCenter || 1;
            const nx = dx / normalLength;
            const ny = dy / normalLength;

            this.x = ARENA_CENTER.x + nx * (ARENA.RADIUS - this.radius);
            this.y = ARENA_CENTER.y + ny * (ARENA.RADIUS - this.radius);

            // Física de rebote: reflejar velocidad respecto a la normal
            const dotProduct = this.vx * nx + this.vy * ny;
            if (dotProduct > 0) {
                this.vx = (this.vx - 2 * dotProduct * nx) * COLLISION.WALL_RESTITUTION;
                this.vy = (this.vy - 2 * dotProduct * ny) * COLLISION.WALL_RESTITUTION;

                // Pequeña perturbacion para romper trayectorias periodicas perfectas
                const deflected = addRandomDeflectionWithMin(
                    this.vx,
                    this.vy,
                    LOOP_BREAKER.WALL_MIN_DEFLECTION_RAD,
                    LOOP_BREAKER.WALL_DEFLECTION_RAD,
                    PLAYER.SPEED
                );
                this.vx = deflected.vx;
                this.vy = deflected.vy;
            }
        }

        // Mantener velocidad constante siempre
        const speedNormalized = normalizeToSpeed(this.vx, this.vy, PLAYER.SPEED);
        this.vx = speedNormalized.vx;
        this.vy = speedNormalized.vy;

        // Anti-loop por heading estable
        const heading = Math.atan2(this.vy, this.vx);
        if (angularDelta(heading, this.lastHeading) < 0.0025) {
            this.stableHeadingFrames += 1;
        } else {
            this.stableHeadingFrames = 0;
        }
        this.lastHeading = heading;

        if (this.stableHeadingFrames > LOOP_BREAKER.STABLE_HEADING_FRAMES) {
            const deflected = addRandomDeflection(
                this.vx,
                this.vy,
                LOOP_BREAKER.LOOP_DEFLECTION_RAD,
                PLAYER.SPEED
            );
            this.vx = deflected.vx;
            this.vy = deflected.vy;
            this.stableHeadingFrames = 0;
        }

        // Actualizar rotación para mirar al enemigo
        const enemy = players.find(p => p.id !== this.id);
        if (enemy) {
            this.rotation = Math.atan2(enemy.y - this.y, enemy.x - this.x);
        }

        // Actualizar arma
        if (this.weapon) {
            this.weapon.update();
        }

        this.updateParticles();
    }

    draw() {
        const now = Date.now();

        // Cuerpo
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Flash rojo breve cuando recibe daño
        if (now < this.hitFlashUntil) {
            const alpha = (this.hitFlashUntil - now) / 180;
            ctx.fillStyle = `rgba(255, 60, 60, ${Math.max(0, Math.min(0.65, alpha))})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Flash verde de curacion
        if (now < this.healFlashUntil) {
            const alpha = (this.healFlashUntil - now) / 220;
            ctx.fillStyle = `rgba(80, 255, 140, ${Math.max(0, Math.min(0.55, alpha))})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Overlay de congelamiento
        if (now < this.frozenUntil) {
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
            ctx.fillStyle = `rgba(120, 210, 255, ${0.2 + pulse * 0.18})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Borde
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Anillo expansivo de impacto
        if (now < this.hitRingUntil) {
            const progress = 1 - (this.hitRingUntil - now) / 240;
            const ringRadius = this.radius + 4 + progress * 12;
            const ringAlpha = 0.7 * (1 - progress);
            ctx.strokeStyle = `rgba(255, 100, 100, ${Math.max(0, ringAlpha)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Anillo de curacion
        if (now < this.healRingUntil) {
            const progress = 1 - (this.healRingUntil - now) / 300;
            const ringRadius = this.radius + 4 + progress * 14;
            const ringAlpha = 0.75 * (1 - progress);
            ctx.strokeStyle = `rgba(120, 255, 160, ${Math.max(0, ringAlpha)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Anillo pulsante de congelamiento
        if (now < this.frozenUntil) {
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.016);
            ctx.strokeStyle = `rgba(140, 230, 255, ${0.35 + pulse * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Partículas de impacto
        for (const p of this.hitParticles) {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = `rgba(255, 140, 140, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Particulas de curacion
        for (const p of this.healParticles) {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = `rgba(130, 255, 180, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dirección (punto en frente)
        const pointX = this.x + Math.cos(this.rotation) * (this.radius + 5);
        const pointY = this.y + Math.sin(this.rotation) * (this.radius + 5);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(pointX, pointY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Dibujar arma si tiene
        if (this.weapon) {
            this.weapon.draw(this);
        }
    }

    updateParticles() {
        const pools = [this.hitParticles, this.healParticles];
        for (const pool of pools) {
            for (let i = pool.length - 1; i >= 0; i--) {
                const p = pool[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.96;
                p.vy *= 0.96;
                p.life -= 1;

                if (p.life <= 0) {
                    pool.splice(i, 1);
                }
            }
        }
    }

    takeDamage(damage, hitX = this.x, hitY = this.y) {
        this.lives -= damage;

        const now = Date.now();
        this.hitFlashUntil = now + 180;
        this.hitRingUntil = now + 240;

        // Generar partículas desde el punto de impacto
        const particleCount = 6 + Math.min(8, damage * 3);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.2 + Math.random() * 2.2;
            this.hitParticles.push({
                x: hitX,
                y: hitY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 14 + Math.floor(Math.random() * 10),
                maxLife: 24,
                size: 1.6 + Math.random() * 2.2
            });
        }
    }

    applyHeal(amount) {
        const previousLives = this.lives;
        this.lives = Math.min(PLAYER.MAX_LIVES, this.lives + amount);
        const healed = this.lives - previousLives;
        if (healed <= 0) {
            return;
        }

        const now = Date.now();
        this.healFlashUntil = now + 220;
        this.healRingUntil = now + 300;

        const particleCount = 8 + healed * 3;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.healParticles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 16 + Math.floor(Math.random() * 12),
                maxLife: 28,
                size: 1.8 + Math.random() * 2.3
            });
        }
    }

    freeze(durationMs) {
        const now = Date.now();
        if (this.frozenUntil <= now) {
            this.savedVelocity = { vx: this.vx, vy: this.vy };
        }
        this.frozenUntil = Math.max(this.frozenUntil, now + durationMs);
        this.vx = 0;
        this.vy = 0;
    }

    pickupWeapon(weapon) {
        this.weapon = weapon;
        weapon.owner = this;
    }

    dropWeapon() {
        if (this.weapon) {
            this.weapon.owner = null;
            this.weapon = null;
        }
    }
}

class Weapon {
    constructor(type, x, y) {
        this.type = type; // 'B' o 'C'
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.owner = null;
        this.color = type === 'B' ? '#FFD700' : '#FF69B4';
    }

    update() {
        if (this.owner) {
            // El arma sigue al propietario
            this.x = this.owner.x;
            this.y = this.owner.y;
        }
    }

    draw(owner) {
        if (this.type === 'B') {
            this.drawBazooka(owner);
        } else if (this.type === 'E') {
            this.drawShotgun(owner);
        } else if (this.type === 'M') {
            this.drawSMG(owner);
        } else if (this.type === 'C') {
            this.drawSpikeShield(owner);
        }
    }

    drawBazooka(owner) {
        const offsetX = Math.cos(owner.rotation) * 25;
        const offsetY = Math.sin(owner.rotation) * 25;
        const weaponX = owner.x + offsetX;
        const weaponY = owner.y + offsetY;

        // Arma (círculo)
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(weaponX, weaponY, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Letra
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', weaponX, weaponY);
    }

    drawSpikeShield(owner) {
        const cfg = WEAPONS.SPIKE_SHIELD;
        const baseRadius = owner.radius + cfg.RING_PADDING;
        const now = Date.now();
        const spin = (now * 0.004) % (Math.PI * 2);

        // Aro del escudo
        ctx.strokeStyle = 'rgba(255, 120, 200, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(owner.x, owner.y, baseRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Pinchos
        ctx.fillStyle = WEAPON_COLORS.C;
        for (let i = 0; i < cfg.SPIKE_COUNT; i++) {
            const angle = spin + (i / cfg.SPIKE_COUNT) * Math.PI * 2;
            const ax = Math.cos(angle);
            const ay = Math.sin(angle);

            const innerX = owner.x + ax * baseRadius;
            const innerY = owner.y + ay * baseRadius;
            const outerX = owner.x + ax * (baseRadius + cfg.SPIKE_LENGTH);
            const outerY = owner.y + ay * (baseRadius + cfg.SPIKE_LENGTH);

            const px = -ay;
            const py = ax;
            const w = 2.4;

            ctx.beginPath();
            ctx.moveTo(innerX + px * w, innerY + py * w);
            ctx.lineTo(innerX - px * w, innerY - py * w);
            ctx.lineTo(outerX, outerY);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawShotgun(owner) {
        const offsetX = Math.cos(owner.rotation) * WEAPONS.SHOTGUN.OFFSET_FROM_PLAYER;
        const offsetY = Math.sin(owner.rotation) * WEAPONS.SHOTGUN.OFFSET_FROM_PLAYER;
        const weaponX = owner.x + offsetX;
        const weaponY = owner.y + offsetY;

        ctx.fillStyle = WEAPON_COLORS.E;
        ctx.beginPath();
        ctx.arc(weaponX, weaponY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#1f2d1f';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', weaponX, weaponY);
    }

    drawSMG(owner) {
        const offsetX = Math.cos(owner.rotation) * WEAPONS.SMG.OFFSET_FROM_PLAYER;
        const offsetY = Math.sin(owner.rotation) * WEAPONS.SMG.OFFSET_FROM_PLAYER;
        const weaponX = owner.x + offsetX;
        const weaponY = owner.y + offsetY;

        ctx.fillStyle = WEAPON_COLORS.M;
        ctx.beginPath();
        ctx.arc(weaponX, weaponY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#1a2738';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', weaponX, weaponY);
    }
}

class Bazooka extends Weapon {
    constructor(x, y) {
        super('B', x, y);
        this.lastShotTime = Date.now();
        this.fireInterval = WEAPONS.BAZOOKA.FIRE_INTERVAL;
        this.uses = WEAPONS.BAZOOKA.USES;
    }

    update() {
        super.update();

        if (this.owner && Date.now() - this.lastShotTime > this.fireInterval) {
            this.fire();
            this.lastShotTime = Date.now();
        }
    }

    fire() {
        if (this.owner && this.uses > 0) {
            const projectile = new Projectile(
                this.owner.x,
                this.owner.y,
                this.owner.rotation,
                this.owner,
                WEAPONS.BAZOOKA.PROJECTILE_DAMAGE,
                WEAPONS.BAZOOKA.PROJECTILE_SPEED,
                WEAPONS.BAZOOKA.PROJECTILE_RADIUS,
                WEAPONS.BAZOOKA.PROJECTILE_MAX_DISTANCE
            );
            projectiles.push(projectile);

            this.uses--;
            if (this.uses <= 0) {
                this.owner.dropWeapon();
            }
        }
    }
}

class Shotgun extends Weapon {
    constructor(x, y) {
        super('E', x, y);
        this.lastShotTime = Date.now();
        this.fireInterval = WEAPONS.SHOTGUN.FIRE_INTERVAL;
        this.uses = WEAPONS.SHOTGUN.USES;
    }

    update() {
        super.update();
        if (this.owner && this.uses > 0 && Date.now() - this.lastShotTime > this.fireInterval) {
            this.fire();
            this.lastShotTime = Date.now();
        }
    }

    fire() {
        if (!this.owner) return;

        const pellets = WEAPONS.SHOTGUN.PELLETS;
        const spread = WEAPONS.SHOTGUN.SPREAD_ANGLE;
        const start = this.owner.rotation - spread / 2;
        const step = pellets > 1 ? spread / (pellets - 1) : 0;

        for (let i = 0; i < pellets; i++) {
            const pelletAngle = start + i * step;
            projectiles.push(
                new Projectile(
                    this.owner.x,
                    this.owner.y,
                    pelletAngle,
                    this.owner,
                    WEAPONS.SHOTGUN.PROJECTILE_DAMAGE,
                    WEAPONS.SHOTGUN.PROJECTILE_SPEED,
                    WEAPONS.SHOTGUN.PROJECTILE_RADIUS,
                    WEAPONS.SHOTGUN.PROJECTILE_MAX_DISTANCE
                )
            );
        }

        this.uses--;
        if (this.uses <= 0) {
            this.owner.dropWeapon();
        }
    }
}

class SMG extends Weapon {
    constructor(x, y) {
        super('M', x, y);
        this.lastBurstTime = Date.now();
        this.burstInterval = WEAPONS.SMG.BURST_INTERVAL;
        this.uses = WEAPONS.SMG.USES;
        this.pendingShots = 0;
        this.nextShotAt = 0;
    }

    update() {
        super.update();
        if (!this.owner) return;

        const now = Date.now();

        if (this.pendingShots === 0 && this.uses > 0 && now - this.lastBurstTime > this.burstInterval) {
            this.pendingShots = WEAPONS.SMG.BURST_SHOTS;
            this.nextShotAt = now;
            this.lastBurstTime = now;
            this.uses--;
        }

        if (this.pendingShots > 0 && now >= this.nextShotAt) {
            this.fireOne();
            this.pendingShots--;
            this.nextShotAt = now + WEAPONS.SMG.SHOT_DELAY;

            if (this.pendingShots === 0 && this.uses <= 0 && this.owner) {
                this.owner.dropWeapon();
            }
        }
    }

    fireOne() {
        if (!this.owner) return;
        projectiles.push(
            new Projectile(
                this.owner.x,
                this.owner.y,
                this.owner.rotation,
                this.owner,
                WEAPONS.SMG.PROJECTILE_DAMAGE,
                WEAPONS.SMG.PROJECTILE_SPEED,
                WEAPONS.SMG.PROJECTILE_RADIUS,
                WEAPONS.SMG.PROJECTILE_MAX_DISTANCE
            )
        );
    }
}

class SpikeShield extends Weapon {
    constructor(x, y) {
        super('C', x, y);
        this.uses = WEAPONS.SPIKE_SHIELD.USES;
        this.maxUses = WEAPONS.SPIKE_SHIELD.USES;
        this.lastContactAt = 0;
    }

    update() {
        super.update();
    }

    consumeUse() {
        if (this.uses <= 0) {
            return false;
        }

        this.uses--;
        if (this.uses <= 0 && this.owner) {
            this.owner.dropWeapon();
        }
        return true;
    }

    tryContactDamage(enemy) {
        if (!this.owner || this.uses <= 0) {
            return;
        }

        const now = Date.now();
        if (now - this.lastContactAt < WEAPONS.SPIKE_SHIELD.CONTACT_COOLDOWN_MS) {
            return;
        }

        enemy.takeDamage(WEAPONS.SPIKE_SHIELD.CONTACT_DAMAGE, enemy.x, enemy.y);
        this.consumeUse();
        this.lastContactAt = now;
    }
}

class Projectile {
    constructor(x, y, angle, owner, damage, speed, radius, maxDistance) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = radius;
        this.owner = owner;
        this.damage = damage;
        this.traveled = 0;
        this.maxDistance = maxDistance;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.traveled += Math.hypot(this.vx, this.vy);

        // Colisión con paredes
        const distFromCenter = Math.hypot(this.x - ARENA_CENTER.x, this.y - ARENA_CENTER.y);
        if (distFromCenter + this.radius > ARENA.RADIUS) {
            return false; // Eliminar proyectil
        }

        // Si viajó demasiado, eliminar
        if (this.traveled > this.maxDistance) {
            return false;
        }

        return true;
    }

    draw() {
        ctx.fillStyle = '#FF6347';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    checkCollision(player) {
        if (player === this.owner) return false;

        const distance = Math.hypot(player.x - this.x, player.y - this.y);
        return distance < player.radius + this.radius;
    }
}

// ==================== VARIABLES GLOBALES ====================

let players = [];
let projectiles = [];
let weaponPickups = [];
let eventPickups = [];
let lastWeaponSpawn = Date.now();
let lastEventSpawn = Date.now();
const weaponSpawnInterval = WEAPON_SPAWN.INTERVAL;
const eventSpawnInterval = EVENT_SPAWN.INTERVAL;

// ==================== INICIALIZACIÓN ====================

function init() {
    players = [
        new Player(1, 150, 300, '#FF6B6B'),
        new Player(2, 450, 300, '#4ECDC4')
    ];
    projectiles = [];
    weaponPickups = [];
    eventPickups = [];
    gameRunning = true;
    gameOverShown = false;
    gamePhase = 'running';
    deathAnimation = null;
    document.getElementById('gameOver').classList.remove('show');
}

// ==================== SPAWN DE ARMAS ====================

function spawnWeapon() {
    if (Date.now() - lastWeaponSpawn > weaponSpawnInterval) {
        const weaponTypes = ['B', 'C', 'E', 'M'];
        const type = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
        const angle = Math.random() * Math.PI * 2;
        const x = ARENA_CENTER.x + Math.cos(angle) * WEAPON_SPAWN.SPAWN_DISTANCE;
        const y = ARENA_CENTER.y + Math.sin(angle) * WEAPON_SPAWN.SPAWN_DISTANCE;

        weaponPickups.push(new ArenaPickup(type, x, y, 'weapon', WEAPON_SPAWN.LIFETIME));
        lastWeaponSpawn = Date.now();
    }
}

function spawnEvent() {
    if (Date.now() - lastEventSpawn > eventSpawnInterval) {
        const eventTypes = [EVENTS.HEART.TYPE, EVENTS.TIME.TYPE];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.max(40, WEAPON_SPAWN.SPAWN_DISTANCE - 20);
        const x = ARENA_CENTER.x + Math.cos(angle) * distance;
        const y = ARENA_CENTER.y + Math.sin(angle) * distance;

        eventPickups.push(new ArenaPickup(type, x, y, 'event', EVENT_SPAWN.LIFETIME));
        lastEventSpawn = Date.now();
    }
}

// ==================== COLISIONES ====================

function checkCollisions() {
    // Colisión entre jugadores - choque elástico
    if (players.length === 2) {
        const p1 = players[0];
        const p2 = players[1];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distSquared = dx * dx + dy * dy;
        const minDist = p1.radius + p2.radius;
        
        if (distSquared < minDist * minDist) {
            // Hay colisión
            const dist = Math.sqrt(distSquared) || 0.1;
            
            // Vector normal unitario (de p1 a p2)
            const nx = dx / dist;
            const ny = dy / dist;

            const now = Date.now();
            const p1Frozen = now < p1.frozenUntil;
            const p2Frozen = now < p2.frozenUntil;
            
            // Separar los círculos
            const overlap = minDist - dist;
            if (p1Frozen && !p2Frozen) {
                p2.x += nx * overlap;
                p2.y += ny * overlap;
            } else if (!p1Frozen && p2Frozen) {
                p1.x -= nx * overlap;
                p1.y -= ny * overlap;
            } else {
                const separationX = (nx * overlap) / 2;
                const separationY = (ny * overlap) / 2;
                p1.x -= separationX;
                p1.y -= separationY;
                p2.x += separationX;
                p2.y += separationY;
            }

            // Escudo de pinchos: daño por choque
            if (p1.weapon && p1.weapon.type === 'C' && typeof p1.weapon.tryContactDamage === 'function') {
                p1.weapon.tryContactDamage(p2);
            }
            if (p2.weapon && p2.weapon.type === 'C' && typeof p2.weapon.tryContactDamage === 'function') {
                p2.weapon.tryContactDamage(p1);
            }
            
            // Velocidades relativas
            const dvx = p2.vx - p1.vx;
            const dvy = p2.vy - p1.vy;
            
            // Velocidad relativa en la dirección de colisión
            const dvn = dvx * nx + dvy * ny;
            
            // Solo resolver si se aproximan
            if (dvn < 0) {
                if (p1Frozen || p2Frozen) {
                    // Rebote contra objetivo congelado (anclado)
                    if (p1Frozen && !p2Frozen) {
                        const dot = p2.vx * nx + p2.vy * ny;
                        p2.vx = p2.vx - 2 * dot * nx;
                        p2.vy = p2.vy - 2 * dot * ny;
                        const d2 = addRandomDeflection(
                            p2.vx,
                            p2.vy,
                            LOOP_BREAKER.PLAYER_COLLISION_DEFLECTION_RAD,
                            PLAYER.SPEED
                        );
                        p2.vx = d2.vx;
                        p2.vy = d2.vy;
                        p1.vx = 0;
                        p1.vy = 0;
                    } else if (!p1Frozen && p2Frozen) {
                        const dot = p1.vx * nx + p1.vy * ny;
                        p1.vx = p1.vx - 2 * dot * nx;
                        p1.vy = p1.vy - 2 * dot * ny;
                        const d1 = addRandomDeflection(
                            p1.vx,
                            p1.vy,
                            LOOP_BREAKER.PLAYER_COLLISION_DEFLECTION_RAD,
                            PLAYER.SPEED
                        );
                        p1.vx = d1.vx;
                        p1.vy = d1.vy;
                        p2.vx = 0;
                        p2.vy = 0;
                    }
                } else {
                    // Para masas iguales en choque elástico
                    const impulse = (1 + COLLISION.PLAYER_RESTITUTION) * dvn / 2;

                    p1.vx += impulse * nx * COLLISION.FRICTION_FACTOR;
                    p1.vy += impulse * ny * COLLISION.FRICTION_FACTOR;
                    p2.vx -= impulse * nx * COLLISION.FRICTION_FACTOR;
                    p2.vy -= impulse * ny * COLLISION.FRICTION_FACTOR;

                    // Mantener velocidad constante en ambos jugadores
                    const speed1 = Math.hypot(p1.vx, p1.vy);
                    const speed2 = Math.hypot(p2.vx, p2.vy);

                    if (speed1 > 0) {
                        p1.vx = (p1.vx / speed1) * PLAYER.SPEED;
                        p1.vy = (p1.vy / speed1) * PLAYER.SPEED;
                    }
                    if (speed2 > 0) {
                        p2.vx = (p2.vx / speed2) * PLAYER.SPEED;
                        p2.vy = (p2.vy / speed2) * PLAYER.SPEED;
                    }

                    // Rompe simetrias que producen orbitas repetitivas
                    const d1 = addRandomDeflection(
                        p1.vx,
                        p1.vy,
                        LOOP_BREAKER.PLAYER_COLLISION_DEFLECTION_RAD,
                        PLAYER.SPEED
                    );
                    const d2 = addRandomDeflection(
                        p2.vx,
                        p2.vy,
                        LOOP_BREAKER.PLAYER_COLLISION_DEFLECTION_RAD,
                        PLAYER.SPEED
                    );
                    p1.vx = d1.vx;
                    p1.vy = d1.vy;
                    p2.vx = d2.vx;
                    p2.vy = d2.vy;
                }
            }
        }
    }

    // Colisión proyectiles con jugadores
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let removed = false;
        for (let player of players) {
            if (projectiles[i].checkCollision(player)) {
                player.takeDamage(projectiles[i].damage, projectiles[i].x, projectiles[i].y);
                projectiles.splice(i, 1);
                removed = true;
                break;
            }
        }
    }

    // Colisión jugadores con armas
    for (let i = weaponPickups.length - 1; i >= 0; i--) {
        const pickup = weaponPickups[i];
        for (const player of players) {
            if (pickup.checkPickup(player)) {
                if (player.weapon) {
                    player.dropWeapon();
                }

                let newWeapon;
                if (pickup.type === 'B') {
                    newWeapon = new Bazooka(player.x, player.y);
                } else if (pickup.type === 'E') {
                    newWeapon = new Shotgun(player.x, player.y);
                } else if (pickup.type === 'M') {
                    newWeapon = new SMG(player.x, player.y);
                } else {
                    newWeapon = new SpikeShield(player.x, player.y);
                }

                player.pickupWeapon(newWeapon);
                weaponPickups.splice(i, 1);
                break;
            }
        }
    }

    // Colisión jugadores con eventos
    for (let i = eventPickups.length - 1; i >= 0; i--) {
        const eventPickup = eventPickups[i];
        for (const player of players) {
            if (!eventPickup.checkPickup(player)) {
                continue;
            }

            if (eventPickup.type === EVENTS.HEART.TYPE) {
                player.applyHeal(EVENTS.HEART.HEAL_AMOUNT);
            } else if (eventPickup.type === EVENTS.TIME.TYPE) {
                const enemy = players.find(p => p.id !== player.id);
                if (enemy) {
                    enemy.freeze(EVENTS.TIME.FREEZE_DURATION_MS);
                }
            }

            eventPickups.splice(i, 1);
            break;
        }
    }
}

function triggerDeathSequence(loser, winner) {
    if (!loser || !winner || gamePhase !== 'running') {
        return;
    }

    gamePhase = 'death';
    loser.isEliminated = true;
    loser.dropWeapon();
    deathAnimation = new DeathExplosion(loser.x, loser.y, loser.color);

    winner.vx = 0;
    winner.vy = 0;
    winner.dropWeapon();
}

// ==================== ACTUALIZACIÓN ====================

function update() {
    if (!gameRunning) return;

    if (gamePhase === 'death') {
        if (deathAnimation) {
            deathAnimation.update();
            if (deathAnimation.isFinished()) {
                gameRunning = false;
                showGameOver();
            }
        }
        updateUI();
        return;
    }

    // Actualizar jugadores
    for (let player of players) {
        player.update();
    }

    // Actualizar proyectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (!projectiles[i].update()) {
            projectiles.splice(i, 1);
        }
    }

    // Actualizar armas en el piso
    for (let i = weaponPickups.length - 1; i >= 0; i--) {
        if (!weaponPickups[i].update()) {
            weaponPickups.splice(i, 1);
        }
    }

    // Actualizar eventos en el piso
    for (let i = eventPickups.length - 1; i >= 0; i--) {
        if (!eventPickups[i].update()) {
            eventPickups.splice(i, 1);
        }
    }

    // Spawn de armas
    spawnWeapon();

    // Spawn de eventos
    spawnEvent();

    // Colisiones
    checkCollisions();

    // Verificar fin del juego
    if (players[0].lives <= 0 || players[1].lives <= 0) {
        const loser = players[0].lives <= 0 ? players[0] : players[1];
        const winner = loser.id === players[0].id ? players[1] : players[0];
        triggerDeathSequence(loser, winner);
    }

    // Actualizar UI
    updateUI();
}

// ==================== DIBUJO ====================

function draw() {
    // Limpiar todo el canvas para evitar rastros fuera de la arena
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Dibujar fondo de la arena
    ctx.fillStyle = 'rgba(135, 206, 235, 0.3)';
    ctx.beginPath();
    ctx.arc(ARENA_CENTER.x, ARENA_CENTER.y, ARENA.RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Borde de la arena
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Dibujar armas en el piso
    for (let weapon of weaponPickups) {
        weapon.draw(ctx, WEAPON_COLORS, EVENT_COLORS);
    }

    // Dibujar eventos en el piso
    for (let eventPickup of eventPickups) {
        eventPickup.draw(ctx, WEAPON_COLORS, EVENT_COLORS);
    }

    // Dibujar jugadores
    for (let player of players) {
        if (!player.isEliminated) {
            player.draw();
        }
    }

    if (deathAnimation) {
        deathAnimation.draw(ctx);
    }

    // Dibujar proyectiles
    for (let projectile of projectiles) {
        projectile.draw();
    }
}

// ==================== UI ====================

function updateUI() {
    const p1Frozen = Date.now() < players[0].frozenUntil ? ' (Congelado)' : '';
    const p2Frozen = Date.now() < players[1].frozenUntil ? ' (Congelado)' : '';
    document.getElementById('lives1').textContent = `${players[0].lives}${p1Frozen}`;
    document.getElementById('lives2').textContent = `${players[1].lives}${p2Frozen}`;

    const weaponNameByType = {
        B: 'Bazuca',
        C: 'Escudo de pinchos',
        E: 'Escopeta',
        M: 'Metralleta'
    };

    const maxUsesByType = {
        B: WEAPONS.BAZOOKA.USES,
        C: WEAPONS.SPIKE_SHIELD.USES,
        E: WEAPONS.SHOTGUN.USES,
        M: WEAPONS.SMG.USES
    };

    // Jugador 1
    if (!players[0].isEliminated && players[0].weapon) {
        const weaponName = weaponNameByType[players[0].weapon.type] || 'Ninguna';
        document.getElementById('weapon1').textContent = weaponName;
        if (typeof players[0].weapon.uses === 'number') {
            document.getElementById('ammo1').textContent = `Usos: ${players[0].weapon.uses}/${maxUsesByType[players[0].weapon.type]}`;
        } else {
            document.getElementById('ammo1').textContent = '';
        }
    } else {
        document.getElementById('weapon1').textContent = 'Ninguna';
        document.getElementById('ammo1').textContent = '';
    }

    // Jugador 2
    if (!players[1].isEliminated && players[1].weapon) {
        const weaponName = weaponNameByType[players[1].weapon.type] || 'Ninguna';
        document.getElementById('weapon2').textContent = weaponName;
        if (typeof players[1].weapon.uses === 'number') {
            document.getElementById('ammo2').textContent = `Usos: ${players[1].weapon.uses}/${maxUsesByType[players[1].weapon.type]}`;
        } else {
            document.getElementById('ammo2').textContent = '';
        }
    } else {
        document.getElementById('weapon2').textContent = 'Ninguna';
        document.getElementById('ammo2').textContent = '';
    }
}

function showGameOver() {
    if (gameOverShown) return;
    gameOverShown = true;

    const gameOverDiv = document.getElementById('gameOver');
    const survivingPlayer = players.find(p => !p.isEliminated) || players.find(p => p.lives > 0);
    const winner = survivingPlayer && survivingPlayer.id === 1 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Cyan)';

    document.getElementById('gameOverText').textContent = '¡GAME OVER!';
    document.getElementById('winnerText').textContent = `${winner} ganó!`;

    gameOverDiv.classList.add('show');
}

// ==================== LOOP PRINCIPAL ====================

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Iniciar
init();
gameLoop();
