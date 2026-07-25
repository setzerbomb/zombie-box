const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas 2D não está disponível.");
}

let game = null;
let paused = false;

const keyboard = {
  left: false,
  right: false,
  up: false,
  down: false,
  shooting: false,
};

async function loadGame() {
  const response = await fetch("./wasm/zig-out/bin/game.wasm", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível carregar game.wasm: ${response.status}`);
  }

  const wasmBytes = await response.arrayBuffer();

  const { instance } = await WebAssembly.instantiate(wasmBytes);

  return instance.exports;
}

function clearKeyboard() {
  keyboard.left = false;
  keyboard.right = false;
  keyboard.up = false;
  keyboard.down = false;
  keyboard.shooting = false;
}

function togglePause() {
  paused = !paused;

  /*
   * Evita que uma tecla permaneça ativa quando
   * o jogo for retomado.
   */
  if (paused) {
    clearKeyboard();

    game.setInput(0, 0, 0, 0);
    game.setShooting(0);
  }
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

    case "Space":
      keyboard.shooting = pressed;
      event.preventDefault();
      break;

    case "Enter":
    case "NumpadEnter":
      /*
       * event.repeat impediria o Enter segurado
       * de pausar e despausar várias vezes.
       */
      if (pressed && !event.repeat && game) {
        togglePause();
      }

      event.preventDefault();
      break;

    case "KeyR":
      if (pressed && !event.repeat && game) {
        clearKeyboard();

        paused = false;

        game.reset();
        game.setInput(0, 0, 0, 0);
        game.setShooting(0);
      }

      event.preventDefault();
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
  clearKeyboard();

  if (game) {
    game.setInput(0, 0, 0, 0);
    game.setShooting(0);
  }
});

game = await loadGame();

const requiredExports = [
  "setInput",
  "setShooting",
  "setSeed",
  "update",
  "reset",

  "getPlayerX",
  "getPlayerY",
  "getPlayerWidth",
  "getPlayerHeight",
  "getFacingX",
  "getFacingY",

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
  const x = game.getPlayerX();
  const y = game.getPlayerY();

  const width = game.getPlayerWidth();
  const height = game.getPlayerHeight();

  context.fillStyle = "#22c55e";

  context.fillRect(x, y, width, height);

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const facingX = game.getFacingX();
  const facingY = game.getFacingY();

  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.lineCap = "round";

  context.beginPath();

  context.moveTo(centerX, centerY);

  context.lineTo(centerX + facingX * 30, centerY + facingY * 30);

  context.stroke();

  context.lineCap = "butt";
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

function drawHud() {
  context.fillStyle = "#ffffff";
  context.textAlign = "left";

  context.font = "bold 32px system-ui, sans-serif";

  context.fillText(`Zombie Box — ${game.getScore()} pontos`, 30, 50);

  context.font = "22px system-ui, sans-serif";

  context.fillText(
    "WASD/Setas: mover | Espaço: atirar | Enter: pausar",
    30,
    85,
  );
}

function drawPause() {
  if (!paused || game.getGameOver()) {
    return;
  }

  context.fillStyle = "rgba(0, 0, 0, 0.68)";

  context.fillRect(0, 0, canvas.width, canvas.height);

  context.textAlign = "center";

  context.fillStyle = "#ffffff";
  context.font = "bold 90px system-ui, sans-serif";

  context.fillText("PAUSADO", canvas.width / 2, canvas.height / 2);

  context.font = "28px system-ui, sans-serif";

  context.fillText(
    "Pressione Enter para continuar",
    canvas.width / 2,
    canvas.height / 2 + 70,
  );

  context.textAlign = "left";
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

  context.textAlign = "left";
}

function render() {
  drawBackground();
  drawBullets();
  drawZombies();
  drawPlayer();
  drawHud();
  drawPause();
  drawGameOver();
}

let previousTime = performance.now();

function gameLoop(currentTime) {
  let deltaSeconds = (currentTime - previousTime) / 1000;

  previousTime = currentTime;

  deltaSeconds = Math.min(deltaSeconds, 0.05);

  /*
   * Enquanto pausado, o jogo continua sendo desenhado,
   * mas o estado no Zig não é atualizado.
   */
  if (!paused) {
    game.setInput(
      keyboard.left ? 1 : 0,
      keyboard.right ? 1 : 0,
      keyboard.up ? 1 : 0,
      keyboard.down ? 1 : 0,
    );

    game.setShooting(keyboard.shooting ? 1 : 0);

    game.update(deltaSeconds);
  }

  render();

  requestAnimationFrame(gameLoop);
}

game.setSeed(Date.now() >>> 0);
game.reset();

requestAnimationFrame(gameLoop);
