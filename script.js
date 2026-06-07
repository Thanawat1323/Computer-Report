const languageEl = document.getElementById("language");
const menuScreen = document.getElementById("menuScreen");
const countdownScreen = document.getElementById("countdownScreen");
const countdownText = document.getElementById("countdownText");
const resultScreen = document.getElementById("resultScreen");
const modeCards = document.querySelectorAll(".mode-card");

const textDisplay = document.getElementById("textDisplay");
const statusEl = document.getElementById("status");
const modeLabelEl = document.getElementById("modeLabel");

const wpmEl = document.getElementById("wpm");
const charCountEl = document.getElementById("charCount");
const accuracyEl = document.getElementById("accuracy");
const timeEl = document.getElementById("time");
const livesEl = document.getElementById("lives");
const lifeBox = document.getElementById("lifeBox");

const resultWpmEl = document.getElementById("resultWpm");
const resultAccuracyEl = document.getElementById("resultAccuracy");
const resultTimeEl = document.getElementById("resultTime");
const resultCorrectEl = document.getElementById("resultCorrect");
const resultWrongEl = document.getElementById("resultWrong");
const resultModeEl = document.getElementById("resultMode");

const playAgainBtn = document.getElementById("playAgainBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");

const ROUND_TIME_MS = 60000;

// เสียง
const keySound = new Audio("sounds/Typing_1.wav");
keySound.volume = 0.3;

const wrongSound = new Audio("sounds/Typing_2.wav");
wrongSound.volume = 0.4;

let selectedMode = "";
let selectedLanguage = "thai";

let targetText = "";
let spans = [];
let currentIndex = 0;

let startTime = null;
let timer = null;
let finished = false;
let isPlaying = false;
let isCountingDown = false;

let totalTyped = 0;
let correctTyped = 0;
let wrongTyped = 0;
let survivalLives = 3;

let wrongFlashTimer = null;
let countdownTimer = null;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRoundText() {
  const pool = textPools[selectedLanguage];
  const targetLen = randomInt(130, 150);

  let text = "";
  while (text.length < targetLen) {
    const part = pool[Math.floor(Math.random() * pool.length)];
    text += (text ? " " : "") + part;
  }

  return text.slice(0, targetLen);
}

function pickText() {
  targetText = generateRoundText();
}

function normalizeChar(char) {
  if (selectedLanguage === "english") {
    return String(char).toLowerCase();
  }
  return String(char);
}

function playKeySound() {
  keySound.currentTime = 0;
  keySound.play().catch(() => {});
}

function playWrongSound() {
  wrongSound.currentTime = 0;
  wrongSound.play().catch(() => {});
}

function buildText() {
  textDisplay.innerHTML = "";
  spans = [];

  for (let i = 0; i < targetText.length; i++) {
    const span = document.createElement("span");
    span.className = "char pending";
    const ch = targetText[i];

    if (ch === " ") {
      span.classList.add("space");
      span.innerHTML = "&nbsp;";
    } else {
      span.textContent = ch;
    }

    textDisplay.appendChild(span);
    spans.push(span);
  }

  updateActiveChar();
}

function updateActiveChar() {
  spans.forEach((span, index) => {
    span.classList.toggle(
      "active",
      index === currentIndex &&
      !finished &&
      span.classList.contains("pending")
    );
  });

  const active = spans[currentIndex];
  if (active) {
    active.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center"
    });
  }
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function currentModeName() {
  if (selectedMode === "survival") return "การอยู่รอด";
  if (selectedMode === "normal") return "ปกติ";
  return "-";
}

function updateModeLabel() {
  modeLabelEl.textContent = selectedMode ? currentModeName() : "ยังไม่ได้เลือกโหมด";
}

function updateHud() {
  const elapsed = startTime ? Date.now() - startTime : 0;
  const remaining = Math.max(0, ROUND_TIME_MS - elapsed);
  const minutes = elapsed / 1000 / 60;

  const wpm = elapsed > 0 ? Math.round((correctTyped / 5) / minutes) : 0;
  const accuracy = totalTyped > 0 ? Math.round((correctTyped / totalTyped) * 100) : 100;

  wpmEl.textContent = String(wpm);
  charCountEl.textContent = `${currentIndex}/${targetText.length}`;
  accuracyEl.textContent = `${accuracy}%`;
  timeEl.textContent = formatTime(remaining);

  if (selectedMode === "survival") {
    livesEl.textContent = "❤️".repeat(Math.max(0, survivalLives));
    lifeBox.style.display = "block";
  } else {
    lifeBox.style.display = "none";
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function startTimer() {
  if (timer) return;

  startTime = Date.now();
  timer = setInterval(() => {
    updateHud();

    if (startTime && Date.now() - startTime >= ROUND_TIME_MS) {
      endGame("หมดเวลาแล้ว");
    }
  }, 50);
}

function spawnNextText() {
  pickText();
  buildText();
  currentIndex = 0;
  updateActiveChar();
}

function resetStats() {
  currentIndex = 0;
  startTime = null;
  finished = false;
  totalTyped = 0;
  correctTyped = 0;
  wrongTyped = 0;
  survivalLives = 3;
}

function startGame() {
  clearInterval(timer);
  timer = null;
  clearTimeout(wrongFlashTimer);

  resetStats();
  resultScreen.classList.add("hidden");
  menuScreen.classList.add("hidden");
  countdownScreen.classList.add("hidden");

  isPlaying = true;
  isCountingDown = false;

  spawnNextText();
  updateHud();
  updateModeLabel();
  setStatus("พิมพ์ไปเรื่อย ๆ จนครบ 1 นาที");

  startTimer();
}

function openMenu() {
  clearInterval(timer);
  timer = null;
  clearTimeout(countdownTimer);
  clearTimeout(wrongFlashTimer);

  isPlaying = false;
  isCountingDown = false;
  finished = false;
  startTime = null;

  menuScreen.classList.remove("hidden");
  countdownScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");

  setStatus("เลือกภาษาและโหมดก่อนเริ่มเล่น");
  updateHud();
}

function runCountdownThenStart() {
  const steps = ["3", "2", "1", "Go"];
  let index = 0;

  isCountingDown = true;
  countdownScreen.classList.remove("hidden");
  countdownText.textContent = steps[index];

  clearTimeout(countdownTimer);

  const nextStep = () => {
    index++;

    if (index < steps.length) {
      countdownText.textContent = steps[index];
      countdownTimer = setTimeout(nextStep, 1000);
    } else {
      countdownText.textContent = "Go";
      countdownTimer = setTimeout(() => {
        countdownScreen.classList.add("hidden");
        isCountingDown = false;
        startGame();
      }, 500);
    }
  };

  countdownTimer = setTimeout(nextStep, 1000);
}

function beginMode(mode) {
  selectedLanguage = languageEl.value;
  selectedMode = mode;
  updateModeLabel();

  menuScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  runCountdownThenStart();
}

function collectFinalStats() {
  const elapsed = startTime ? Date.now() - startTime : 0;
  const minutes = elapsed / 1000 / 60;
  const wpm = elapsed > 0 ? Math.round((correctTyped / 5) / minutes) : 0;
  const accuracy = totalTyped > 0 ? Math.round((correctTyped / totalTyped) * 100) : 100;

  resultWpmEl.textContent = String(wpm);
  resultAccuracyEl.textContent = `${accuracy}%`;
  resultTimeEl.textContent = formatTime(elapsed);
  resultCorrectEl.textContent = String(correctTyped);
  resultWrongEl.textContent = String(wrongTyped);
  resultModeEl.textContent = currentModeName();
}

function endGame(message) {
  if (finished) return;

  finished = true;
  isPlaying = false;
  isCountingDown = false;

  clearInterval(timer);
  timer = null;

  updateActiveChar();
  updateHud();
  setStatus(message || "จบเกมแล้ว");

  collectFinalStats();
  resultScreen.classList.remove("hidden");
}

function flashWrong(span) {
  if (!span) return;

  clearTimeout(wrongFlashTimer);
  span.classList.add("wrong-flash");

  wrongFlashTimer = setTimeout(() => {
    span.classList.remove("wrong-flash");
  }, 450);
}

function handleCorrect() {
  const span = spans[currentIndex];
  span.classList.remove("pending", "active", "wrong-flash");
  span.classList.add("correct");

  currentIndex++;
  correctTyped++;
  totalTyped++;

  if (currentIndex >= targetText.length) {
    endGame(" ");
    return;
  }

  updateActiveChar();
  updateHud();
}

function handleWrong() {
  const span = spans[currentIndex];
  flashWrong(span);

  wrongTyped++;
  totalTyped++;

  if (selectedMode === "survival") {
    survivalLives--;
    if (survivalLives <= 0) {
      updateHud();
      endGame("แพ้แล้ว กดเล่นอีกครั้งเพื่อเริ่มใหม่");
      return;
    }
  }

  updateActiveChar();
  updateHud();
}

function restoreCurrentChar() {
  if (currentIndex < 0 || currentIndex >= spans.length) return;

  const span = spans[currentIndex];
  span.className = "char pending";
  const ch = targetText[currentIndex];

  if (ch === " ") {
    span.classList.add("space");
    span.innerHTML = "&nbsp;";
  } else {
    span.textContent = ch;
  }
}

modeCards.forEach((card) => {
  card.addEventListener("click", () => {
    const mode = card.dataset.mode;
    beginMode(mode);
  });
});

playAgainBtn.addEventListener("click", () => {
  if (!selectedMode) {
    openMenu();
    return;
  }

  resultScreen.classList.add("hidden");
  runCountdownThenStart();
});

backToMenuBtn.addEventListener("click", openMenu);

languageEl.addEventListener("change", () => {
  if (menuScreen.classList.contains("hidden")) return;
  selectedLanguage = languageEl.value;
});

document.addEventListener("keydown", (e) => {
  if (!isPlaying || isCountingDown) return;

  if (e.key === "Tab") {
    e.preventDefault();
    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    openMenu();
    return;
  }

  if (finished) return;

  if (e.key === "Backspace") {
    e.preventDefault();

    if (currentIndex > 0) {
      currentIndex--;
      restoreCurrentChar();
      updateActiveChar();
      updateHud();
      setStatus("ย้อนกลับได้");
    }
    return;
  }

  if (e.key.length !== 1) return;

  e.preventDefault();

  const expected = normalizeChar(targetText[currentIndex]);
  const typed = normalizeChar(e.key);

  if (typed === expected) {
    playKeySound();
    handleCorrect();
  } else {
    playWrongSound();
    handleWrong();
  }
});

updateModeLabel();
openMenu();