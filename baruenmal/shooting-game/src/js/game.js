// This file contains the main game logic, including the game loop, player movement, bullet firing, enemy spawning, collision detection, and score tracking. It manages the game's state and updates the canvas accordingly.

const canvasEl = document.getElementById('gameCanvas');
const ctxEl = canvasEl ? canvasEl.getContext('2d') : null;

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

// Read input from main.js via global
function getInput() {
    return window.__INPUT_STATE__ || { left: false, right: false, shoot: false };
}

function gameInit() {
    console.log('gameInit called');
    // CSS pixel size used in main.js
    const CSS_HEIGHT = 600;
    const CSS_WIDTH = 360;
    // center player horizontally
    player = new Player(CSS_WIDTH / 2 - 25, CSS_HEIGHT - 80);
    // Draw a visual 'GAME START' immediately to confirm initialization
    try {
        if (ctxEl) {
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
        enemies.push(new Enemy(40, 80, 1));
        enemies.push(new Enemy(220, 120, 1));
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
    // Clear using CSS pixels: ctx is already scaled in main.js
    if (!ctxEl) return;
    ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);
    player.draw(ctxEl);
    bullets.forEach(bullet => bullet.draw(ctxEl));
    enemies.forEach(enemy => enemy.draw(ctxEl));
    enemyBullets.forEach(eb => eb.draw(ctxEl));
    drawScore();
    drawHealth();
}

function spawnEnemies() {
    const CSS_WIDTH = 360;
    const x = Math.random() * (CSS_WIDTH - 40);
    // enemy has HP 1 so it dies after 1 hit; could scale
    enemies.push(new Enemy(x, -40, 1));
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
    if (!ctxEl) return;
    ctxEl.fillStyle = 'black';
    ctxEl.font = '16px Arial';
    ctxEl.fillText(`Score: ${score}`, 8, 20);
}

// Expose init function for main.js to call
window.gameInit = gameInit;