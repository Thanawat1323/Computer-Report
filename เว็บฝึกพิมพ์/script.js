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
const accuracyEl = document.getElementById("accuracy");
const timeEl = document.getElementById("time");
const timeBarFillEl = document.getElementById("timeBarFill");

const resultWpmEl = document.getElementById("resultWpm");
const resultAccuracyEl = document.getElementById("resultAccuracy");
const resultTimeEl = document.getElementById("resultTime");
const resultCorrectEl = document.getElementById("resultCorrect");
const resultWrongEl = document.getElementById("resultWrong");
const resultModeEl = document.getElementById("resultMode");

const playAgainBtn = document.getElementById("playAgainBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");

const ROUND_TIME_MS = 60000;
const BOX_COUNT = 7;

// โหลดไฟล์เสียงระบบเกม
const correctSound = new Audio("./sounds/Typing_1.wav");
const wrongSound = new Audio("./sounds/Typing_2.mp3");

let selectedMode = "";
let selectedLanguage = "thai";

let targetText = "";
let targetChars = [];
let spans = [];
let currentIndex = 0;
let currentBuffer = ""; 

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

const modeMap = {
  easy: { label: "Easy", pools: () => window.EasyTextPools },
  normal: { label: "Normal", pools: () => window.NormalTextPools },
  hard: { label: "Hard", pools: () => window.HardTextPools },
  survival: { label: "Survival", pools: () => window.HardTextPools }
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ตรวจสอบสระบน-ล่าง วรรณยุกต์ เพื่อใส่ Zero-Width Space ให้แสดงผลลอยเดี่ยวได้สวยงาม
function isThaiDiacritic(char) {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (code === 0x0E31) || (code >= 0x0E34 && code <= 0x0E39) || (code >= 0x0E47 && code <= 0x0E4C);
}

function splitGraphemes(text) {
  const str = String(text ?? "");
  return Array.from(str);
}

function currentPoolObject() {
  const def = modeMap[selectedMode];
  if (!def) return null;
  return def.pools();
}

function getLanguagePool() {
  const poolObject = currentPoolObject();
  if (!poolObject) return [];
  return poolObject[selectedLanguage] || [];
}

function pickText() {
  const pool = getLanguagePool();
  if (!pool.length) {
    targetText = "";
    targetChars = [];
    return;
  }

  // สุ่มคำจาก pool
  const raw = pool[randomInt(0, pool.length - 1)];
  
  // ไม่ต้องตัดทิ้ง ให้เอามาทั้งคำ (และถ้าคำสั้นกว่า 7 ให้เติมช่องว่างจนครบ 7 หรือจะให้แสดงตามความยาวคำจริงๆ ก็ได้)
  const chars = splitGraphemes(raw); 
  
  targetChars = chars;
  targetText = chars.join("");
}

function normalizeChar(char) {
  if (selectedLanguage === "english") {
    return String(char).toUpperCase();
  }
  return String(char);
}

function buildText() {
  textDisplay.innerHTML = "";
  spans = [];

  for (let i = 0; i < targetChars.length; i++) {
    const boxWrapper = document.createElement("div");
    boxWrapper.className = "box-wrapper";

    const span = document.createElement("span");
    span.className = "char pending";
    const ch = targetChars[i];

    // กรณีเป็นช่องว่างในคำ
    if (ch === " ") {
      span.classList.add("space");
      span.textContent = " "; // ให้แสดงผลช่องว่าง
    } else {
      span.textContent = isThaiDiacritic(ch) ? "\u200B" + ch : ch;
    }

    boxWrapper.appendChild(span);
    textDisplay.appendChild(boxWrapper);
    spans.push(span);
  }
  updateActiveChar();
}

function updateActiveChar() {
  spans.forEach((span, index) => {
    const isActive = index === currentIndex && !finished && span.classList.contains("pending");
    span.classList.toggle("active", isActive);
    
    // จัดการ class ของ wrapper เพื่อคุมแท็บสีน้ำเงินด้านล่างกล่อง
    if (span.parentElement) {
      span.parentElement.classList.toggle("wrapper-active", isActive);
    }
  });
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function currentModeName() {
  if (!selectedMode) return "-";
  return modeMap[selectedMode]?.label || "-";
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
  accuracyEl.textContent = `${accuracy}%`;
  timeEl.textContent = formatTime(remaining);

  if (timeBarFillEl) {
    const progress = Math.min(100, (elapsed / ROUND_TIME_MS) * 100);
    timeBarFillEl.style.width = `${progress}%`;
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
  currentBuffer = ""; 
  pickText();
  currentIndex = 0;
  buildText();
  updateActiveChar();
}

function resetStats() {
  currentIndex = 0;
  currentBuffer = ""; 
  startTime = null;
  finished = false;
  totalTyped = 0;
  correctTyped = 0;
  wrongTyped = 0;
  survivalLives = 3;

  if (timeBarFillEl) {
    timeBarFillEl.style.width = "0%";
  }
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
  setStatus("พิมพ์แยกทีละตัวอักษรให้ครบ 7 ช่อง");

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
  currentBuffer = "";

  menuScreen.classList.remove("hidden");
  countdownScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");

  if (timeBarFillEl) {
    timeBarFillEl.style.width = "0%";
  }

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

  updateHud();

  if (timeBarFillEl) {
    timeBarFillEl.style.width = "100%";
  }

  setStatus(message || "จบเกมแล้ว");

  collectFinalStats();
  resultScreen.classList.remove("hidden");
}

function flashWrong(span) {
  if (!span) return;

  span.classList.remove("wrong-flash");
  void span.offsetWidth; // บังคับรีเซ็ตอนิเมชัน CSS
  span.classList.add("wrong-flash");
}

function createFlyingChar(targetSpan, char) {
  if (!targetSpan) return;
  const flyer = document.createElement("span");
  flyer.className = "flying-char";
  
  if (isThaiDiacritic(char)) {
    flyer.textContent = "\u200B" + char;
  } else {
    flyer.textContent = char === " " ? "␣" : char;
  }
  
  targetSpan.appendChild(flyer);
  
  setTimeout(() => {
    flyer.remove();
  }, 500);
}

function restoreCurrentChar() {
  if (currentIndex < 0 || currentIndex >= spans.length) return;

  const span = spans[currentIndex];
  span.className = "char pending";
  const ch = targetChars[currentIndex];

  if (ch === " ") {
    span.classList.add("space");
    span.textContent = "";
  } else {
    if (isThaiDiacritic(ch)) {
      span.textContent = "\u200B" + ch;
    } else {
      span.textContent = ch;
    }
  }
}

modeCards.forEach((card) => {
  card.addEventListener("click", () => {
    beginMode(card.dataset.mode);
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

    if (currentBuffer.length > 0) {
      currentBuffer = currentBuffer.slice(0, -1);
      setStatus("ลบตัวอักษรล่าสุด");
    } else if (currentIndex > 0) {
      currentIndex--;
      restoreCurrentChar();
      updateActiveChar();
      updateHud();
      currentBuffer = "";
      setStatus("ย้อนกลับ");
    }
    return;
  }

  if (e.key.length !== 1) return;

  e.preventDefault();

  const expected = normalizeChar(targetChars[currentIndex]);
  const typed = normalizeChar(e.key);

  const testBuffer = currentBuffer + typed;

  if (expected.startsWith(testBuffer)) {
    currentBuffer = testBuffer;
    correctTyped++;
    totalTyped++;

    correctSound.currentTime = 0;
    correctSound.play().catch(err => console.log(err));

    if (currentBuffer === expected) {
      const span = spans[currentIndex];
      span.classList.remove("pending", "active", "wrong-flash");
      span.classList.add("correct");

      currentIndex++;
      currentBuffer = ""; 

      if (currentIndex >= targetChars.length) {
        spawnNextText();
        return;
      }
      updateActiveChar();
    }
    updateHud();
  } else {
    wrongTyped++;
    totalTyped++;

    wrongSound.currentTime = 0;
    wrongSound.play().catch(err => console.log(err));

    const span = spans[currentIndex];
    flashWrong(span);
    createFlyingChar(span, e.key);

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
});

updateModeLabel();
openMenu();

// ========================================================
// 🔊 ระบบเสียง Typing_3 เมื่อเมาส์ Hover ปุ่มต่างๆ ในเกม
// ========================================================

// 1. โหลดไฟล์เสียง
const hoverSound = new Audio('sounds/Typing_3.wav');
hoverSound.volume = 0.6; // ปรับระดับความดัง (0.0 ถึง 1.0) เลือกตามความเหมาะสมได้เลยครับ

// 2. เลือก Elements ที่เป็นปุ่มหรือการ์ดแบบ Interactive ทั้งหมด
const interactiveElements = document.querySelectorAll('button, .mode-card, select');

// 3. ผูก Event เข้าไปให้ทำงานตอนเมาส์เลื่อนผ่าน
interactiveElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
        // รีเซ็ตเวลาเสียงให้เป็น 0 เสมอ เพื่อให้สามารถเล่นซ้อนกันทันทีเมื่อกวาดเมาส์ผ่านไวๆ
        hoverSound.currentTime = 0;
        
        // สั่งให้เสียงทำงาน
        hoverSound.play().catch(error => {
            // ป้องกัน Error กรณีเบราว์เซอร์บล็อกเสียงอัตโนมัติก่อนมีการคลิกหน้าจอครั้งแรก
            console.log("ระบบบล็อกการเล่นเสียงชั่วคราว จนกว่าผู้เล่นจะมีแอคชั่นแรกกับหน้าจอ:", error);
        });
    });
});