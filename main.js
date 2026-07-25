const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas 2D não está disponível.");
}

const keyboard = {
  left: false,
  right: false,
  up: false,
  down: false,
};

const mouse = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  shooting: false,
};

async function loadGame() {
  const response = await fetch("./wasm/zig-out/bin/game.wasm");

  if (!response.ok) {
    throw new Error(`Não foi possível carregar game.wasm: ${response.status}`);
  }

  const wasmBytes = await response.arrayBuffer();

  const { instance } = await WebAssembly.instantiate(wasmBytes);

  return instance.exports;
}

function updateMousePosition(event) {
  const bounds = canvas.getBoundingClientRect();

  /*
   * O canvas aparece no tamanho do navegador,
   * mas internamente continua sendo 1920×1080.
   */
  mouse.x = (event.clientX - bounds.left) * (canvas.width / bounds.width);

  mouse.y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
}

function setKeyState(event, pressed) {
  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      keyboard.left = pressed;
      event.preventDefault();
      break;

    case "ArrowRight":
    case "KeyD":
      keyboard.right = pressed;
      event.preventDefault();
      break;

    case "ArrowUp":
    case "KeyW":
      keyboard.up = pressed;
      event.preventDefault();
      break;

    case "ArrowDown":
    case "KeyS":
      keyboard.down = pressed;
      event.preventDefault();
      break;

    case "KeyR":
      if (pressed) {
        mouse.shooting = false;
        game.reset();
      }

      break;
  }
}

window.addEventListener("keydown", (event) => {
  setKeyState(event, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event, false);
});

window.addEventListener("blur", () => {
  keyboard.left = false;
  keyboard.right = false;
  keyboard.up = false;
  keyboard.down = false;

  mouse.shooting = false;
});

canvas.addEventListener("pointermove", (event) => {
  updateMousePosition(event);
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  updateMousePosition(event);
  mouse.shooting = true;
});

window.addEventListener("pointerup", (event) => {
  if (event.button === 0) {
    mouse.shooting = false;
  }
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

const game = await loadGame();

const requiredExports = [
  "setInput",
  "setAim",
  "setShooting",
  "setSeed",
  "update",
  "reset",

  "getPlayerX",
  "getPlayerY",
  "getPlayerWidth",
  "getPlayerHeight",

  "getMaxZombies",
  "isZombieActive",
  "getZombieX",
  "getZombieY",
  "getZombieSize",

  "getMaxBullets",
  "isBulletActive",
  "getBulletX",
  "getBulletY",
  "getBulletSize",

  "getScore",
  "getGameOver",
];

for (const exportName of requiredExports) {
  if (typeof game[exportName] !== "function") {
    throw new Error(
      `A função ${exportName} não foi exportada pelo módulo WASM.`,
    );
  }
}

function drawBackground() {
  context.fillStyle = "#030712";

  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "#1f2937";
  context.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function drawPlayer() {
  context.fillStyle = "#22c55e";

  context.fillRect(
    game.getPlayerX(),
    game.getPlayerY(),
    game.getPlayerWidth(),
    game.getPlayerHeight(),
  );
}

function drawZombies() {
  const maximum = game.getMaxZombies();
  const size = game.getZombieSize();

  context.fillStyle = "#ef4444";

  for (let index = 0; index < maximum; index += 1) {
    if (!game.isZombieActive(index)) {
      continue;
    }

    context.fillRect(
      game.getZombieX(index),
      game.getZombieY(index),
      size,
      size,
    );
  }
}

function drawBullets() {
  const maximum = game.getMaxBullets();
  const size = game.getBulletSize();

  context.fillStyle = "#facc15";

  for (let index = 0; index < maximum; index += 1) {
    if (!game.isBulletActive(index)) {
      continue;
    }

    context.fillRect(
      game.getBulletX(index),
      game.getBulletY(index),
      size,
      size,
    );
  }
}

function drawCrosshair() {
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;

  context.beginPath();
  context.moveTo(mouse.x - 15, mouse.y);
  context.lineTo(mouse.x + 15, mouse.y);
  context.stroke();

  context.beginPath();
  context.moveTo(mouse.x, mouse.y - 15);
  context.lineTo(mouse.x, mouse.y + 15);
  context.stroke();
}

function drawHud() {
  context.fillStyle = "#ffffff";
  context.font = "bold 32px system-ui, sans-serif";

  context.fillText(`Zombie Box — ${game.getScore()} pontos`, 30, 50);

  context.font = "22px system-ui, sans-serif";

  context.fillText("WASD: mover | Mouse: mirar | Clique: atirar", 30, 85);
}

function drawGameOver() {
  if (!game.getGameOver()) {
    return;
  }

  context.fillStyle = "rgba(0, 0, 0, 0.75)";

  context.fillRect(0, 0, canvas.width, canvas.height);

  context.textAlign = "center";

  context.fillStyle = "#ef4444";
  context.font = "bold 90px system-ui, sans-serif";

  context.fillText("VOCÊ MORREU", canvas.width / 2, canvas.height / 2 - 30);

  context.fillStyle = "#ffffff";
  context.font = "36px system-ui, sans-serif";

  context.fillText(
    `${game.getScore()} pontos`,
    canvas.width / 2,
    canvas.height / 2 + 40,
  );

  context.font = "28px system-ui, sans-serif";

  context.fillText(
    "Pressione R para reiniciar",
    canvas.width / 2,
    canvas.height / 2 + 100,
  );

  context.textAlign = "start";
}

function render() {
  drawBackground();
  drawBullets();
  drawZombies();
  drawPlayer();
  drawCrosshair();
  drawHud();
  drawGameOver();
}

let previousTime = performance.now();

function gameLoop(currentTime) {
  let deltaSeconds = (currentTime - previousTime) / 1000;

  previousTime = currentTime;

  deltaSeconds = Math.min(deltaSeconds, 0.05);

  game.setInput(
    keyboard.left ? 1 : 0,
    keyboard.right ? 1 : 0,
    keyboard.up ? 1 : 0,
    keyboard.down ? 1 : 0,
  );

  game.setAim(mouse.x, mouse.y);

  game.setShooting(mouse.shooting ? 1 : 0);

  game.update(deltaSeconds);

  render();

  requestAnimationFrame(gameLoop);
}

game.setSeed(Date.now() >>> 0);
game.reset();

requestAnimationFrame(gameLoop);
