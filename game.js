// This file contains the main game logic, including the game loop, player movement, bullet firing, enemy spawning, collision detection, and score tracking. It manages the game's state and updates the canvas accordingly.

// 안전한 canvas/ctx 초기화: DOM에 캔버스가 없어도 에러가 안 나도록 함
const canvasEl = document.getElementById('gameCanvas');
const ctxEl = canvasEl ? canvasEl.getContext('2d') : null;
if (!canvasEl || !ctxEl) {
    console.error('Canvas #gameCanvas not found or 2D context unavailable');
    // 이후 코드가 canvasEl/ctxEl를 사용하기 전에 null 체크하세요.
}

let player;
let bullets = [];
let enemies = [];
let enemyBullets = [];
let score = 0;
let gameOver = false;
let enemySpawnTimer = 0;
let playerHits = 0; // counts collisions, 5 -> death
let playerWasMoving = false;
let playerBulletToggle = 0; // toggles between two texts
let playerFireCooldown = 300; // ms between player shots
let lastPlayerFire = 0;

// --- NEW: tweakable enemy timing / spawn ranges ---
const ENEMY_BASE_SHOOT_INTERVAL = 1200; // ms (slightly slower than before)
const ENEMY_SHOOT_RANDOM_EXTRA = 300;   // per-enemy random extra ms
const ENEMY_MIN_SPAWN_Y_RATIO = 0.12;   // spawn Y min = canvasHeight * 0.12
const ENEMY_MAX_SPAWN_Y_RATIO = 0.28;   // spawn Y max = canvasHeight * 0.28
const MAX_ENEMIES_ON_SCREEN = 3;

// Read input from main.js via global
function getInput() {
    return window.__INPUT_STATE__ || { left: false, right: false, shoot: false };
}

function gameInit() {
    console.log('gameInit called');
    const CSS_HEIGHT = 600;
    const CSS_WIDTH = 360;
    player = new Player(CSS_WIDTH / 2 - 25, CSS_HEIGHT - 80);

    // Draw a visual 'GAME START' immediately to confirm initialization
    try {
        if (ctxEl && canvasEl) {
            ctxEl.clearRect(0,0,canvasEl.width,canvasEl.height);
            ctxEl.fillStyle = 'black';
            ctxEl.fillRect(0,0,canvasEl.width,canvasEl.height);
            ctxEl.fillStyle = 'white';
            ctxEl.font = '28px Arial';
            ctxEl.textAlign = 'center';
            ctxEl.fillText('GAME START', CSS_WIDTH/2, CSS_HEIGHT/2);
        }
    } catch(e) { console.error(e); }

    // Draw an initial frame and start the game loop immediately so objects appear right away
    try {
        draw();
    } catch (e) { console.error('Initial draw failed', e); }
    // force-spawn two enemies in visible area for immediate feedback
    try {
        // 보이는 영역(상단에서 너무 가깝지 않도록 Y값을 충분히 줌)
        enemies.push(new Enemy(40, 80, 1));
        enemies.push(new Enemy(220, 140, 1)); // 조금 더 아래로 조정
        if (player && typeof player.flashLarge === 'function') player.flashLarge(600);
    } catch (e) { console.error('spawn initial enemies failed', e); }
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameOver) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    const input = getInput();

    // movement only left/right
    playerWasMoving = false;
    if (input.left) { player.move('left'); playerWasMoving = true; }
    if (input.right) { player.move('right'); playerWasMoving = true; }

    // Fire only while moving. Alternate bullet text and color. Throttle by cooldown.
    if (playerWasMoving) {
        const now = Date.now();
        if (now - lastPlayerFire >= playerFireCooldown) {
            const text = (playerBulletToggle % 2 === 0) ? '사랑해' : '고마워';
            const color = (playerBulletToggle % 2 === 0) ? '#ff7ab6' : '#ff4d4d';
            bullets.push(new Bullet(player.x + player.width / 2, player.y, text, color));
            playerBulletToggle++;
            lastPlayerFire = now;
        }
    }

    bullets.forEach(bullet => bullet.update());

    // enemies are static but can shoot downward
    enemies.forEach(enemy => {
        enemy.move();
        const now = Date.now();
        if (!enemy.lastShot) enemy.lastShot = now;
        if (now - enemy.lastShot >= enemy.shootInterval) {
            // spawn an enemy bullet from its bottom center
            enemyBullets.push(new EnemyBullet(enemy.x + enemy.width/2, enemy.y + enemy.height + 4));
            enemy.lastShot = now;
        }
    });
    enemyBullets.forEach(eb => eb.update());

    // spawn enemies periodically but limit to 3 concurrent
    enemySpawnTimer++;
    if (enemySpawnTimer > 50 && enemies.length < 3) {
        spawnEnemies();
        enemySpawnTimer = 0;
    }

    checkCollisions();
    cleanUp();
}

function draw() {
    // Clear using CSS pixels: ctxEl is already scaled in main.js
    if (!ctxEl || !canvasEl) return;
    ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);
    player.draw(ctxEl);
    bullets.forEach(bullet => bullet.draw(ctxEl));
    enemies.forEach(enemy => enemy.draw(ctxEl));
    enemyBullets.forEach(eb => eb.draw(ctxEl));
    drawScore();
    drawHealth();
}

// Replace old spawnEnemies/spawnEnemy with this single safe spawner
function spawnEnemies() {
    const CSS_WIDTH = 360;
    const canvasElLocal = document.getElementById('gameCanvas');
    const cssH = canvasElLocal ? canvasElLocal.clientHeight || 600 : 600;

    // 상단에서 너무 가깝지 않게 minY를 설정 (예: 화면 높이의 8~35% 사이)
    const minY = Math.max(40, Math.floor(cssH * 0.08));
    const maxY = Math.max(minY + 20, Math.floor(cssH * 0.35));

    // 하나씩 생성 (이 함수가 호출될 때마다 1마리 추가)
    const x = Math.random() * (CSS_WIDTH - 40);
    const y = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
    enemies.push(new Enemy(x, y, 1));
}

function checkCollisions() {
    // player bullets hitting enemies (bullets are point-like centered at b.x,b.y)
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            if (b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) {
                bullets.splice(bi, 1);
                e.health -= 1;
                if (e.health <= 0) {
                    enemies.splice(ei, 1);
                    score += 100;
                    if (score >= 3000) {
                        gameOver = true;
                        if (typeof window.showSuccess === 'function') window.showSuccess();
                    }
                }
            }
        });
    });

    // enemy bullets hitting player
    enemyBullets.forEach((eb, eji) => {
        if (eb.x > player.x && eb.x < player.x + player.width && eb.y > player.y && eb.y < player.y + player.height) {
            enemyBullets.splice(eji, 1);
            playerHits += 1;
            if (playerHits >= 5) {
                gameOver = true;
                if (typeof window.showGameOver === 'function') window.showGameOver();
            }
        }
    });
}

function cleanUp() {
    bullets = bullets.filter(b => b.y > -40);
    enemyBullets = enemyBullets.filter(eb => eb.y < 700);
    enemies = enemies.filter(e => e.y < 700);
}

function drawHealth() {
    // draw health bar bottom-left based on playerHits
    const maxHits = 5;
    const fill = Math.max(0, (maxHits - playerHits) / maxHits) * 100;
    // use DOM health-fill if present
    const hf = document.querySelector('.health-fill');
    if (hf) hf.style.width = fill + '%';
}

function drawScore() {
    if (!ctx) return;
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText(`Score: ${score}`, 8, 20);
}

// Expose init function for main.js to call
window.gameInit = gameInit;

// --- changed: remove duplicate Enemy class or define only if not already defined ---
if (typeof Enemy === 'undefined') {
    // Fallback Enemy definition only if entities.js did not provide one.
    class Enemy {
        constructor(x, y, hp = 1) {
            this.x = x;
            this.y = y;
            this.health = hp;
            this.width = 32;
            this.height = 32;
            this.shootInterval = ENEMY_BASE_SHOOT_INTERVAL + Math.floor(Math.random() * ENEMY_SHOOT_RANDOM_EXTRA);
            this.lastShot = 0;
        }
        update() {
            const now = Date.now();
            if (now - this.lastShot >= this.shootInterval) {
                this.lastShot = now;
                enemyBullets.push(new EnemyBullet(this.x + this.width / 2, this.y + this.height));
            }
        }
        draw(ctx) {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// spawn function: use canvasEl clientHeight and ratios
function spawnEnemyRandom() {
    const canvasElLocal = document.getElementById('gameCanvas');
    const cssW = canvasElLocal ? (canvasElLocal.clientWidth || 360) : 360;
    const cssH = canvasElLocal ? (canvasElLocal.clientHeight || 640) : 640;

    if (enemies.length >= MAX_ENEMIES_ON_SCREEN) return;

    const minY = Math.max(40, Math.floor(cssH * ENEMY_MIN_SPAWN_Y_RATIO));
    const maxY = Math.max(minY + 20, Math.floor(cssH * ENEMY_MAX_SPAWN_Y_RATIO));
    const y = Math.floor(Math.random() * (maxY - minY + 1)) + minY;

    const margin = 24;
    const x = Math.floor(Math.random() * Math.max(1, (cssW - margin * 2))) + margin;

    enemies.push(new Enemy(x, y, 1));
}

// call spawnEnemyRandom() where you previously spawned enemies