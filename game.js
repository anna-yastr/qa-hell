/* =========================
   SETTINGS
   ========================= */

// Center overlay text
const RULE_TEXT = "Click cursed shoes before they flood the screen";
const RULE_FONT_SIZE = 26;
const STATUS_FONT_SIZE = 22;
const RULE_Y_OFFSET = -10;
const STATUS_Y_OFFSET = 30;

// Game rules
const MAX_BUGS_ON_SCREEN = 15;

// Bug visuals
const IMAGE_SCALE = 1.75;     // базовый скейл ботинка
const BASE_BUG_SIZE = 120;    // базовый размер до скейла
const SIZE_JITTER = 0.20;     // ±20% (0.20 => [0.8..1.2])
const ROTATE_DEG = 30;        // ±30 градусов

// Spawn speed (geometric progression)
const SPAWN_INTERVAL_START_MS = 900;
const SPAWN_INTERVAL_MULTIPLIER = 0.96; // ближе к 1.0 = медленнее ускоряется
const SPAWN_INTERVAL_MIN_MS = 180;

// Defeat image sizing
const DEFEAT_IMG_W = 520;
const DEFEAT_IMG_H = 350;
const DEFEAT_IMG_Y_OFFSET = 20;

// Assets
const DEFEAT_SRC = "assets/defeat.png";
const SHOE_COUNT = 15;
const SHOE_PREFIX = "assets/shoe";

/* =========================
   GAME STATE
   ========================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const restartBtn = document.getElementById("restartBtn");
if(!restartBtn){
  console.error("restartBtn not found. Check index.html for: <button id='restartBtn' ...>");
} else {
  restartBtn.style.display = "none";
  // на всякий случай: чтобы точно ловила клики
  restartBtn.style.pointerEvents = "auto";
}

let bugs = [];
let score = 0;
let gameOver = false;

// spawn control
let spawnInterval = SPAWN_INTERVAL_START_MS;
let spawnTimerId = null;

// preload
const defeat = new Image();
const shoes = [];

let assetsToLoad = 1 + SHOE_COUNT; // defeat + shoes
let assetsLoaded = 0;
let readyToStart = false;

// countdown + loading dots
let countdown = 3;
let countdownActive = false;
let countdownTimerId = null;

let loadingDots = 0;
let loadingDotsTimerId = null;

/* =========================
   UTILS
   ========================= */

function randi(n){ return Math.floor(Math.random() * n); }
function randf(a,b){ return a + Math.random() * (b-a); }
function degToRad(d){ return d * Math.PI / 180; }

/* =========================
   SPAWN CONTROL
   ========================= */

function stopSpawning(){
  if(spawnTimerId !== null){
    clearTimeout(spawnTimerId);
    spawnTimerId = null;
  }
}

function scheduleNextSpawn(){
  if(gameOver) return;

  spawnTimerId = setTimeout(() => {
    spawnBug();
    spawnInterval = Math.max(SPAWN_INTERVAL_MIN_MS, Math.floor(spawnInterval * SPAWN_INTERVAL_MULTIPLIER));
    scheduleNextSpawn();
  }, spawnInterval);
}

function startSpawning(){
  stopSpawning();
  scheduleNextSpawn();
}

/* =========================
   RESET / RESTART
   ========================= */

function resetRunState(){
  if(restartBtn) restartBtn.style.display = "none";

  bugs = [];
  score = 0;
  gameOver = false;

  spawnInterval = SPAWN_INTERVAL_START_MS;
  stopSpawning();

  countdown = 3;
  countdownActive = false;

  if(countdownTimerId){
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }

  // если ассеты уже загружены — сразу запускаем отсчёт
  if(readyToStart){
    startCountdown();
  }
}

if(restartBtn){
  restartBtn.addEventListener("click", () => {
    resetRunState();
  });
}

// удобно: клавиша R
window.addEventListener("keydown", (e) => {
  if(e.key && e.key.toLowerCase() === "r"){
    resetRunState();
  }
});

/* =========================
   ASSET PRELOAD
   ========================= */

function markLoaded(){
  assetsLoaded++;
  if(assetsLoaded >= assetsToLoad){
    readyToStart = true;
    startCountdown();
  }
}

function startLoadingDots(){
  if(loadingDotsTimerId) return;
  loadingDotsTimerId = setInterval(() => {
    loadingDots = (loadingDots + 1) % 4; // 0..3
  }, 350);
}

function stopLoadingDots(){
  if(loadingDotsTimerId){
    clearInterval(loadingDotsTimerId);
    loadingDotsTimerId = null;
  }
}

defeat.onload = markLoaded;
defeat.onerror = markLoaded;
defeat.src = DEFEAT_SRC;

for(let i=1; i<=SHOE_COUNT; i++){
  const img = new Image();
  img.onload = markLoaded;
  img.onerror = markLoaded;
  img.src = `${SHOE_PREFIX}${i}.png`;
  shoes.push(img);
}

startLoadingDots();

/* =========================
   COUNTDOWN
   ========================= */

function startCountdown(){
  if(countdownActive || gameOver) return;

  stopLoadingDots();

  countdown = 3;
  countdownActive = true;

  countdownTimerId = setInterval(() => {
    countdown--;
    if(countdown <= 0){
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      countdownActive = false;
      startSpawning();
    }
  }, 1000);
}

/* =========================
   SPAWN / HIT
   ========================= */

function spawnBug(){
  if(gameOver) return;

  // базовый размер с jitter ±20%
  const baseSize = Math.max(10, Math.floor(BASE_BUG_SIZE * IMAGE_SCALE));
  const size = Math.max(10, Math.floor(baseSize * randf(1 - SIZE_JITTER, 1 + SIZE_JITTER)));

  // угол ±30°
  const rot = degToRad(randf(-ROTATE_DEG, ROTATE_DEG));

  // выбираем рандомный ботинок 1..15
  const img = shoes[randi(shoes.length)];

  // позиция так, чтобы не вылезало (с учётом size)
 const x = Math.random() * (canvas.width - size);

/* появляется немного выше поля */
const y = -size;

const vy = randf(2.5, 4.5);  // скорость падения

bugs.push({ x, y, size, img, rot, vy });

  if(bugs.length > MAX_BUGS_ON_SCREEN){
    gameOver = true;
    stopSpawning();
    if(countdownTimerId) clearInterval(countdownTimerId);

    // показываем кнопку сразу при фиксации gameOver
    if(restartBtn) restartBtn.style.display = "block";
  }
}

function pointerPos(evt){
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY
  };
}

function tryHit(mx, my){
  if(gameOver) return;
  if(!readyToStart || countdownActive) return;

  // кликаем по axis-aligned bbox
  for(let i = bugs.length - 1; i >= 0; i--){
    const b = bugs[i];
    const hit = (mx >= b.x && mx <= b.x + b.size && my >= b.y && my <= b.y + b.size);
    if(hit){
      bugs.splice(i, 1);
      score += 1;
      return;
    }
  }
}

canvas.addEventListener("click", (e) => {
  const p = pointerPos(e);
  tryHit(p.x, p.y);
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const p = pointerPos(e);
  tryHit(p.x, p.y);
}, { passive: false });

/* =========================
   DRAW
   ========================= */

function clearField(){
  ctx.clearRect(0,0,canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10,10,12,0.35)";
  ctx.fillRect(0,0,canvas.width, canvas.height);
}

function drawHUD(){
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, 14, 28);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "14px Arial";
  ctx.fillText(`Bugs: ${bugs.length}/${MAX_BUGS_ON_SCREEN}`, 14, 48);
}

function drawBug(b){
  const cx = b.x + b.size / 2;
  const cy = b.y + b.size / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(b.rot);
  ctx.drawImage(b.img, -b.size/2, -b.size/2, b.size, b.size);
  ctx.restore();
}

function drawBugs(){
  for(const b of bugs){

    /* движение вниз */
    if(b.vy){
      b.y += b.vy;
    }

    drawBug(b);
  }
}

function drawCenterOverlay(){
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `${RULE_FONT_SIZE}px Arial`;
  ctx.fillText(RULE_TEXT, canvas.width/2, canvas.height/2 + RULE_Y_OFFSET);

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `${STATUS_FONT_SIZE}px Arial`;

  let line = "";
  if(!readyToStart){
    const dots = ".".repeat(loadingDots);
    line = `Loading${dots}`;
  } else if(countdownActive){
    line = `Starting in: ${countdown}`;
  }

  if(line){
    ctx.fillText(line, canvas.width/2, canvas.height/2 + STATUS_Y_OFFSET);
  }

  ctx.textAlign = "left";
}

function drawGameOver(){
  // гарантируем что кнопка видима на экране поражения
  if(restartBtn) restartBtn.style.display = "block";

  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  // defeat image center (если успела прогрузиться — рисуем)
  const w = DEFEAT_IMG_W;
  const h = DEFEAT_IMG_H;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2 + DEFEAT_IMG_Y_OFFSET;

  if(defeat.complete && defeat.naturalWidth > 0){
    ctx.drawImage(defeat, x, y, w, h);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = "56px Arial";
  ctx.fillText("QA FAILED", canvas.width/2, canvas.height/2 + 120);

  ctx.textAlign = "left";
}

function loop(){
  clearField();

  if(!gameOver){
    if(restartBtn) restartBtn.style.display = "none";

    if(readyToStart && !countdownActive){
      drawBugs();
      drawHUD();
    } else {
      drawCenterOverlay();
      drawHUD();
    }
  } else {
    drawBugs();
    drawHUD();
    drawGameOver();
  }

  requestAnimationFrame(loop);
}

loop();
