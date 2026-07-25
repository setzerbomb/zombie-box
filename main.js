const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas 2D não está disponível.");
}

let game = null;
let paused = false;
let words = [];
let lastWord = null;

const keyboard = {
  left: false,
  right: false,
  up: false,
  down: false,
  shooting: false,
};

const challenge = {
  active: false,
  word: "",
  typed: "",
  timeLimit: 0,
  timeRemaining: 0,
  mistakeFlash: 0,
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

async function loadWords() {
  const response = await fetch("./words.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível carregar words.json: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.words)) {
    throw new Error(
      "words.json precisa conter uma propriedade words com um array.",
    );
  }

  const loadedWords = data.words
    .filter((word) => typeof word === "string")
    .map((word) => word.trim().toLocaleLowerCase("pt-BR"))
    .filter((word) => word.length > 0);

  if (loadedWords.length === 0) {
    throw new Error("words.json não contém palavras válidas.");
  }

  return loadedWords;
}

function clearKeyboard() {
  keyboard.left = false;
  keyboard.right = false;
  keyboard.up = false;
  keyboard.down = false;
  keyboard.shooting = false;
}

function clearChallenge() {
  challenge.active = false;
  challenge.word = "";
  challenge.typed = "";
  challenge.timeLimit = 0;
  challenge.timeRemaining = 0;
  challenge.mistakeFlash = 0;
}

function chooseWord() {
  if (words.length === 1) {
    return words[0];
  }

  let selectedWord = words[Math.floor(Math.random() * words.length)];

  while (selectedWord === lastWord) {
    selectedWord = words[Math.floor(Math.random() * words.length)];
  }

  lastWord = selectedWord;

  return selectedWord;
}

function beginChallenge() {
  clearKeyboard();

  game.setInput(0, 0, 0, 0);
  game.setShooting(0);

  challenge.active = true;
  challenge.word = chooseWord();
  challenge.typed = "";
  challenge.timeLimit = game.getChallengeTimeLimit();
  challenge.timeRemaining = challenge.timeLimit;
  challenge.mistakeFlash = 0;
}

function completeChallenge() {
  if (!challenge.active) {
    return;
  }

  clearChallenge();
  game.resolveChallengeSuccess();
  previousTime = performance.now();
}

function failChallenge() {
  if (!challenge.active) {
    return;
  }

  clearChallenge();
  game.resolveChallengeFailure();
}

function syncChallengeState() {
  const wasmChallengeActive = game.getChallengeActive() !== 0;

  if (wasmChallengeActive && !challenge.active) {
    beginChallenge();
  }
}

function updateChallenge(deltaSeconds) {
  if (!challenge.active) {
    return;
  }

  challenge.timeRemaining -= deltaSeconds;
  challenge.mistakeFlash = Math.max(0, challenge.mistakeFlash - deltaSeconds);

  if (challenge.timeRemaining <= 0) {
    challenge.timeRemaining = 0;
    failChallenge();
  }
}

function handleChallengeKey(event) {
  event.preventDefault();

  if (!challenge.active || event.repeat) {
    return;
  }

  if (event.code === "Backspace") {
    challenge.typed = "";
    return;
  }

  if (event.key.length !== 1) {
    return;
  }

  const typedCharacter = event.key.toLocaleLowerCase("pt-BR");

  const expectedCharacter = challenge.word[challenge.typed.length];

  if (typedCharacter !== expectedCharacter) {
    challenge.typed = "";
    challenge.mistakeFlash = 0.22;
    return;
  }

  challenge.typed += typedCharacter;

  if (challenge.typed === challenge.word) {
    completeChallenge();
  }
}

function togglePause() {
  if (challenge.active || game.getGameOver()) {
    return;
  }

  paused = !paused;

  if (paused) {
    clearKeyboard();

    game.setInput(0, 0, 0, 0);
    game.setShooting(0);
  } else {
    previousTime = performance.now();
  }
}

function restartGame() {
  if (challenge.active) {
    return;
  }

  clearKeyboard();
  clearChallenge();

  paused = false;

  game.reset();
  game.setInput(0, 0, 0, 0);
  game.setShooting(0);

  previousTime = performance.now();
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
      if (pressed && !event.repeat && game) {
        togglePause();
      }

      event.preventDefault();
      break;

    case "KeyR":
      if (pressed && !event.repeat && game) {
        restartGame();
      }

      event.preventDefault();
      break;
  }
}

window.addEventListener("keydown", (event) => {
  if (challenge.active) {
    handleChallengeKey(event);
    return;
  }

  setKeyState(event, true);
});

window.addEventListener("keyup", (event) => {
  if (challenge.active) {
    event.preventDefault();
    return;
  }

  setKeyState(event, false);
});

window.addEventListener("blur", () => {
  clearKeyboard();

  if (game) {
    game.setInput(0, 0, 0, 0);
    game.setShooting(0);
  }
});

[game, words] = await Promise.all([loadGame(), loadWords()]);

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

  "getChallengeActive",
  "getChallengeTimeLimit",
  "getSuccessfulEscapes",
  "resolveChallengeSuccess",
  "resolveChallengeFailure",
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
    "WASD/Setas: mover | Espaço: atirar | Enter: pausar | R: reiniciar",
    30,
    85,
  );

  context.fillText(
    `Salvamentos: ${game.getSuccessfulEscapes()} | Próximo desafio: ${game.getChallengeTimeLimit().toFixed(2)}s`,
    30,
    120,
  );
}

function drawPause() {
  if (!paused || challenge.active || game.getGameOver()) {
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

function drawChallenge() {
  if (!challenge.active) {
    return;
  }

  context.fillStyle =
    challenge.mistakeFlash > 0
      ? "rgba(127, 29, 29, 0.84)"
      : "rgba(0, 0, 0, 0.82)";

  context.fillRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  context.textAlign = "center";
  context.fillStyle = "#ef4444";
  context.font = "bold 52px system-ui, sans-serif";

  context.fillText("ZUMBI AGARROU VOCÊ", centerX, centerY - 190);

  context.fillStyle = "#ffffff";
  context.font = "28px system-ui, sans-serif";

  context.fillText(
    "Digite o golpe antes que o tempo acabe",
    centerX,
    centerY - 135,
  );

  const displayWord = challenge.word.toLocaleUpperCase("pt-BR");

  const typedDisplay = displayWord.slice(0, challenge.typed.length);

  const remainingDisplay = displayWord.slice(challenge.typed.length);

  context.font = "bold 64px monospace";

  const fullWidth = context.measureText(displayWord).width;

  const typedWidth = context.measureText(typedDisplay).width;

  const wordStartX = centerX - fullWidth / 2;

  context.textAlign = "left";
  context.fillStyle = "#22c55e";

  context.fillText(typedDisplay, wordStartX, centerY - 35);

  context.fillStyle = "#ffffff";

  context.fillText(remainingDisplay, wordStartX + typedWidth, centerY - 35);

  const barWidth = Math.min(760, canvas.width - 160);

  const barHeight = 34;
  const barX = centerX - barWidth / 2;
  const barY = centerY + 45;

  const progress =
    challenge.timeLimit > 0
      ? Math.max(0, Math.min(1, challenge.timeRemaining / challenge.timeLimit))
      : 0;

  context.fillStyle = "#1f2937";
  context.fillRect(barX, barY, barWidth, barHeight);

  context.fillStyle =
    progress > 0.5 ? "#22c55e" : progress > 0.25 ? "#facc15" : "#ef4444";

  context.fillRect(barX, barY, barWidth * progress, barHeight);

  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.strokeRect(barX, barY, barWidth, barHeight);

  context.textAlign = "center";
  context.fillStyle = "#ffffff";
  context.font = "bold 28px system-ui, sans-serif";

  context.fillText(
    `${challenge.timeRemaining.toFixed(2)}s`,
    centerX,
    barY + 82,
  );

  context.font = "22px system-ui, sans-serif";

  context.fillText(
    "Errou uma letra? A palavra recomeça do zero.",
    centerX,
    barY + 125,
  );

  if (challenge.mistakeFlash > 0) {
    context.fillStyle = "#ffffff";
    context.font = "bold 28px system-ui, sans-serif";

    context.fillText("ERROU — RECOMECE", centerX, barY + 170);
  }

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
  drawChallenge();
  drawGameOver();
}

let previousTime = performance.now();

function gameLoop(currentTime) {
  let deltaSeconds = (currentTime - previousTime) / 1000;

  previousTime = currentTime;

  deltaSeconds = Math.min(deltaSeconds, 0.05);

  if (challenge.active) {
    updateChallenge(deltaSeconds);
  } else if (!paused) {
    game.setInput(
      keyboard.left ? 1 : 0,
      keyboard.right ? 1 : 0,
      keyboard.up ? 1 : 0,
      keyboard.down ? 1 : 0,
    );

    game.setShooting(keyboard.shooting ? 1 : 0);

    game.update(deltaSeconds);
    syncChallengeState();
  }

  render();

  requestAnimationFrame(gameLoop);
}

game.setSeed(Date.now() >>> 0);
game.reset();

requestAnimationFrame(gameLoop);
