export class ArenaPickup {
    constructor(type, x, y, kind, lifetime) {
        this.type = type;
        this.kind = kind; // 'weapon' | 'event'
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.rotationAngle = 0;
        this.createdTime = Date.now();
        this.lifetime = lifetime;
    }

    update() {
        this.rotationAngle += 0.05;
        return Date.now() - this.createdTime <= this.lifetime;
    }

    draw(ctx, weaponColors, eventColors) {
        const color = this.kind === 'weapon' ? weaponColors[this.type] : eventColors[this.type];

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#222';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type, this.x, this.y);
    }

    checkPickup(player) {
        const distance = Math.hypot(player.x - this.x, player.y - this.y);
        return distance < player.radius + this.radius;
    }
}
