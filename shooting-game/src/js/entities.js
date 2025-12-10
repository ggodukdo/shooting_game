class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.speed = 5;
        this.health = 100;
    this.firing = false;
    }

    move(direction) {
        switch (direction) {
            case 'left':
                this.x = Math.max(0, this.x - this.speed);
                break;
            case 'right':
                this.x = Math.min(360 - this.width, this.x + this.speed);
                break;
            case 'up':
                this.y -= this.speed;
                break;
            case 'down':
                this.y += this.speed;
                break;
        }
    }

    shoot() {
    this.flash();
    return new Bullet(this.x + this.width / 2 - 2.5, this.y);
    }

    update() {
        // clamp to bounds already handled in move
    }

    draw(ctx) {
        // draw pink heart for player
    ctx.fillStyle = '#ff7ab6';
    const cx = this.x + this.width/2;
    const cy = this.y + this.height/2 - 6;
    // if flashing large, draw bigger
    const flashScale = this.isFlashing ? 1.6 : 1;
    const scale = (Math.min(this.width, this.height) / 50) * flashScale;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6*scale);
    ctx.bezierCurveTo(cx + 12*scale, cy - 8*scale, cx + 12*scale, cy + 12*scale, cx, cy + 18*scale);
    ctx.bezierCurveTo(cx - 12*scale, cy + 12*scale, cx - 12*scale, cy - 8*scale, cx, cy + 6*scale);
    ctx.fill();
        if (this.firing) {
            // muzzle flash: small rectangle above the player center
            ctx.fillStyle = 'orange';
            const fx = this.x + this.width / 2 - 6;
            const fy = this.y - 8;
            ctx.fillRect(fx, fy, 12, 6);
        }
    }

    flash() {
        this.firing = true;
        setTimeout(() => { this.firing = false; }, 100);
    }

    flashLarge(duration = 400) {
        this.isFlashing = true;
        setTimeout(() => { this.isFlashing = false; }, duration);
    }
}

class Bullet {
    // Player bullet that can render text like '사랑해' or '고마워'
    constructor(x, y, text = '', color = '#ff7ab6') {
        // x,y represent center of bullet in CSS pixels
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.width = 36;
        this.height = 18;
        this.speed = 10;
    }

    update() {
        this.y -= this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
    }
}

class Enemy {
    constructor(x, y, health = 1) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.health = health;
        // random 'bad word' like symbol string 2-5 length
        const symbols = ['#','@','$','%','!','&','*'];
        const len = 2 + Math.floor(Math.random()*4);
        let txt = '';
        for (let i=0;i<len;i++) txt += symbols[Math.floor(Math.random()*symbols.length)];
        this.text = txt;
        // shooting timing for enemy bullets
        this.lastShot = Date.now();
        this.shootInterval = 1500; // ms
    }

    // Enemies do not move from their spawn position
    move() {
        // intentionally empty — enemies are static
    }

    draw(ctx) {
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x + this.width/2, this.y + this.height/2 + 6);
    }
}

class EnemyBullet {
    constructor(x, y) {
        this.x = x; // center
        this.y = y; // center
        this.r = 6;
        this.speed = 4;
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fill();
    }
}

// Expose classes as globals so classic script tags can access them (index.html uses non-module scripts)
window.Player = Player;
window.Bullet = Bullet;
window.Enemy = Enemy;
window.EnemyBullet = EnemyBullet;
