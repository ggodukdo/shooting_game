const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Logical CSS size we want the canvas to appear as
const CSS_WIDTH = 360;
const CSS_HEIGHT = 600;

// Resize canvas backing store to devicePixelRatio for crisp rendering
function resizeCanvasForDPR() {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = CSS_WIDTH + 'px';
    canvas.style.height = CSS_HEIGHT + 'px';
    canvas.width = Math.floor(CSS_WIDTH * dpr);
    canvas.height = Math.floor(CSS_HEIGHT * dpr);
    // Scale the drawing context so drawing uses CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Input state
const inputState = {
    left: false,
    right: false,
    shoot: false
};

let joystickActive = false;
let autoFireInterval = null;
let joystickActiveMouse = false;
let mouseDown = false;

// Touch handling: translate touch movements into left/right flags
let touchStartX = null;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchStartX = e.touches[0].clientX - rect.left;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const currentX = e.touches[0].clientX - rect.left;
    if (touchStartX == null) { touchStartX = currentX; }

    if (currentX < touchStartX - 10) {
        inputState.left = true;
        inputState.right = false;
    } else if (currentX > touchStartX + 10) {
        inputState.right = true;
        inputState.left = false;
    } else {
        inputState.left = false;
        inputState.right = false;
    }
    // update reference so small continuous moves are handled
    touchStartX = currentX;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    inputState.left = false;
    inputState.right = false;
    touchStartX = null;
});

// Simple on-screen tap to shoot: tap with another finger (two-finger) or quick tap
canvas.addEventListener('touchstart', (e) => {
    // If more than one touch point, consider it a shoot
    if (e.touches.length > 1) {
        inputState.shoot = true;
    } else {
        // single touch: consider taps shorter than 200ms as shoot
        const touch = e.touches[0];
        const start = performance.now();
        const onEnd = () => {
            const dur = performance.now() - start;
            if (dur < 200) inputState.shoot = true;
            canvas.removeEventListener('touchend', onEnd);
        };
        canvas.addEventListener('touchend', onEnd);
    }
});

// Keyboard handlers
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') inputState.left = true;
    if (e.code === 'ArrowRight') inputState.right = true;
    if (e.code === 'Space') inputState.shoot = true;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') inputState.left = false;
    if (e.code === 'ArrowRight') inputState.right = false;
    if (e.code === 'Space') inputState.shoot = false;
});

// Hook up game logic to use inputState: we assume the game's update loop will read inputState
// Expose inputState globally for game.js
window.__INPUT_STATE__ = inputState;

// Initialize and start game
function init() {
    resizeCanvasForDPR();
    window.addEventListener('resize', resizeCanvasForDPR);
}

// Expose startGame to be called by the Start button
// Intro dialog sequence
const introTexts = [
    "모두가 바르게 살아야 한다는 것을 안다. 하지만 그걸 실천하는 사람은 얼마나 되는가?",
    "여태 상대방의 태도에 상처받은 이들을 많이 보았다. 아주 큰 상처이든 작은 상처이든.",
    "그래서 나는 다짐하였다. 이 세상의 나쁜말들을 부수기로."
];

let introIndex = 0;

window.showIntro = function() {
    console.log('showIntro called');
    // hide start overlay and show intro overlay
    const startOv = document.getElementById('startOverlay');
    if (startOv) startOv.style.display = 'none';
    const introOv = document.getElementById('introOverlay');
    const introText = document.getElementById('introText');
    introIndex = 0;
    if (!introOv || !introText) return;
    introText.textContent = introTexts[introIndex];
    introOv.style.display = 'flex';

    // advance on pointerdown inside the intro overlay (covers both mouse and touch)
    let lastAdvanceTime = 0;
    const advance = (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastAdvanceTime < 2000) return; // 2s debounce
        lastAdvanceTime = now;
        introIndex++;
        if (introIndex < introTexts.length) {
            introText.textContent = introTexts[introIndex];
        } else {
            // finished intros
            introOv.style.display = 'none';
            introOv.removeEventListener('pointerdown', advance);
            introOv.removeEventListener('click', advance);
            introOv.removeEventListener('touchstart', advance);
            introDialog.removeEventListener('pointerdown', advance);
            introDialog.removeEventListener('click', advance);
            introDialog.removeEventListener('touchstart', advance);
            // start actual game
            window.startGame();
        }
    };

    // also attach to the dialog itself in case overlay events are intercepted
    const introDialog = document.getElementById('introDialog');
    introOv.addEventListener('pointerdown', advance);
    introOv.addEventListener('click', advance);
    introOv.addEventListener('touchstart', advance);
    if (introDialog) {
        introDialog.addEventListener('pointerdown', advance);
        introDialog.addEventListener('click', advance);
        introDialog.addEventListener('touchstart', advance);
    }
};

// Global fallback: if Start overlay still visible, allow clicking anywhere or pressing Enter to start intro
// (removed global fallback handlers to avoid interfering with explicit Start button behavior)

// Debug: allow 's' key to start intro even if overlay hidden
document.addEventListener('keydown', (e) => {
    if (e.key === 's' || e.key === 'S') {
        console.log('S key pressed - forcing showIntro');

        // on-screen debug logger
        window.debugLog = function(msg) {
            try {
                const el = document.getElementById('debugLog');
                if (el) {
                    const p = document.createElement('div');
                    p.textContent = msg;
                    el.appendChild(p);
                    el.scrollTop = el.scrollHeight;
                }
            } catch (e) { console.log('debugLog error', e); }
        };
        if (typeof window.showIntro === 'function') window.showIntro();
    }
});

// Debug button handler
const dbg = document.getElementById('debugStart');
if (dbg) dbg.addEventListener('click', () => { if (typeof window.showIntro === 'function') window.showIntro(); });

// Start game: initialize canvas and game, set background to white and start everything
window.startGame = function() {
    console.log('startGame called');
    init();
    // set canvas background to white for gameplay
    canvas.style.background = '#fff';
    if (typeof window.gameInit === 'function') window.gameInit();
};

// On-screen diagnostics: a small status bar so users without console can see lifecycle events
function ensureDebugStatus() {
    let s = document.getElementById('gameStatus');
    if (!s) {
        s = document.createElement('div');
        s.id = 'gameStatus';
        Object.assign(s.style, { position:'absolute', left:'8px', top:'8px', padding:'6px 10px', background:'rgba(255,255,255,0.9)', color:'#000', zIndex:100000, borderRadius:'6px', fontSize:'13px' });
        document.body.appendChild(s);
    }
    return s;
}

function debugStatus(msg) {
    try {
        const el = ensureDebugStatus();
        el.textContent = msg;
    } catch (e) { console.log('debugStatus failed', e); }
}

function showFatalError(msg) {
    let el = document.getElementById('fatalErrorBox');
    if (!el) {
        el = document.createElement('div');
        el.id = 'fatalErrorBox';
        Object.assign(el.style, { position:'absolute', left:'8px', top:'48px', background:'rgba(255,0,0,0.95)', color:'#fff', padding:'8px 12px', borderRadius:'6px', zIndex:100001, fontSize:'14px', maxWidth:'calc(100% - 16px)' });
        document.body.appendChild(el);
    }
    el.textContent = msg;
    console.error(msg);
}

// Enhance startGame to update on-screen status and fail visibly when gameInit missing
const originalStartGame = window.startGame;
window.startGame = function() {
    debugStatus('startGame invoked');
    try {
        // hide overlays and debug UI before starting
        hideAllOverlays();
        originalStartGame();
        debugStatus('gameInit called (if present)');
        // check for gameInit presence
        if (typeof window.gameInit !== 'function') {
            showFatalError('gameInit not found — check script load order');
        }
    } catch (err) {
        showFatalError('startGame error: ' + (err && err.message ? err.message : String(err)));
    }
};

function hideAllOverlays() {
    // hide overlays but keep diagnostic status visible
    const hideIds = ['startOverlay','introOverlay','successOverlay','qrOverlay','gameOverOverlay','debugLog'];
    hideIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    // hide health bar (pink) if present by adding .hidden class
    const hb = document.querySelector('.health-bar'); if (hb) hb.classList.add('hidden');
    // keep gameStatus and fatalErrorBox visible (do not remove)
}

// Allow mouse hold anywhere on canvas for left/right movement (desktop convenience)
let mouseHold = false;
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    mouseHold = true;
    startAutoFire();
});
window.addEventListener('mouseup', () => {
    if (mouseHold) {
        mouseHold = false;
        inputState.left = false;
        inputState.right = false;
        stopAutoFire();
    }
});
canvas.addEventListener('mousemove', (e) => {
    if (!mouseHold) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // move relative to center
    if (x < CSS_WIDTH/2 - 8) { inputState.left = true; inputState.right = false; }
    else if (x > CSS_WIDTH/2 + 8) { inputState.right = true; inputState.left = false; }
    else { inputState.left = false; inputState.right = false; }
});

// Auto-fire when joystick active (interval 0.3s)
function startAutoFire() {
    if (autoFireInterval) return;
    autoFireInterval = setInterval(() => {
        inputState.shoot = true;
    }, 300);
}

function stopAutoFire() {
    if (!autoFireInterval) return;
    clearInterval(autoFireInterval);
    autoFireInterval = null;
}

// Simple joystick: if touch on left-bottom zone, use as joystick
canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    // joystick zone left-bottom 120x120
    if (x < 120 && y > CSS_HEIGHT - 140) {
        joystickActive = true;
        startAutoFire();
    }
});

// Mouse support for desktop: treat mousedown in joystick zone as joystick start
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left button only
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseDown = true;
    if (x < 120 && y > CSS_HEIGHT - 140) {
        joystickActiveMouse = true;
        startAutoFire();
        // set initial direction
        if (x < 60 - 8) { inputState.left = true; inputState.right = false; }
        else if (x > 60 + 8) { inputState.right = true; inputState.left = false; }
        else { inputState.left = false; inputState.right = false; }
    }
});

window.addEventListener('mouseup', (e) => {
    if (mouseDown) mouseDown = false;
    if (joystickActiveMouse) {
        joystickActiveMouse = false;
        inputState.left = false;
        inputState.right = false;
        stopAutoFire();
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!joystickActiveMouse || !mouseDown) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 60 - 8) { inputState.left = true; inputState.right = false; }
    else if (x > 60 + 8) { inputState.right = true; inputState.left = false; }
    else { inputState.left = false; inputState.right = false; }
});

canvas.addEventListener('touchend', (e) => {
    joystickActive = false;
    inputState.left = false;
    inputState.right = false;
    stopAutoFire();
});

canvas.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    // compare to center of joystick at x=60
    if (x < 60 - 8) { inputState.left = true; inputState.right = false; }
    else if (x > 60 + 8) { inputState.right = true; inputState.left = false; }
    else { inputState.left = false; inputState.right = false; }
});

// Success and gameover hooks
window.showSuccess = function() {
    const ov = document.getElementById('successOverlay');
    ov.style.display = 'flex';
    // create stars
    const stars = document.getElementById('stars');
    stars.innerHTML = '';
    for (let i=0;i<12;i++){ const s = document.createElement('div'); s.className='star'; stars.appendChild(s); }
    document.getElementById('successContinue').addEventListener('click', () => {
        ov.style.display='none';
        document.getElementById('qrOverlay').style.display='flex';
    });
};

window.showGameOver = function() {
    document.getElementById('gameOverOverlay').style.display = 'flex';
};