import { SoundEngine } from "./audio.js";
import { CleanupCore, copyBoard, cellKey, areAdjacent, isInsideBoard } from "./game-core.js";
import { BOARD_SIZE, CHAPTERS, DEFAULT_SETTINGS, LEVELS, TILE_DEFS, describeGoal } from "./levels.js";

const PROFILE_KEY = "degame-mvp-save-v2";
const TILE_SIZE = 66;
const BOARD_PIXEL_SIZE = TILE_SIZE * BOARD_SIZE;
const BOARD_X = 96;
const BOARD_Y = 148;
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 760;
const IDLE_HINT_DELAY = 6500;
const SWIPE_THRESHOLD = 22;
const SWAP_DURATION = 170;
const CLEAR_DURATION = 230;
const DROP_DURATION_BASE = 250;
const SHUFFLE_DURATION = 280;
const PARTICLE_LIFE = 560;
const EFFECT_LIFE = 440;
const COMBO_BURST_LIFE = 820;
const FLASH_LIFE = 300;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function boardToPayload(board, row, col) {
  const cell = board[row]?.[col];
  if (!cell || !cell.tileType) {
    return null;
  }
  return { tileType: cell.tileType, special: cell.special };
}

function createSaveData(settings = {}) {
  return {
    currentLevel: 0,
    unlockedLevel: 0,
    bestStars: {},
    bestMoves: {},
    seenChapterIntro: {},
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

class DesktopCleanupApp {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext("2d");

    this.goalList = document.getElementById("goalList");
    this.activityList = document.getElementById("activityList");
    this.levelList = document.getElementById("levelList");
    this.chapterCards = document.getElementById("chapterCards");
    this.chapterLabel = document.getElementById("chapterLabel");
    this.levelTitle = document.getElementById("levelTitle");
    this.cleanlinessFill = document.getElementById("cleanlinessFill");
    this.cleanlinessLabel = document.getElementById("cleanlinessLabel");
    this.overallProgressText = document.getElementById("overallProgressText");
    this.overallProgressFill = document.getElementById("overallProgressFill");
    this.totalStarsValue = document.getElementById("totalStarsValue");
    this.chapterProgressText = document.getElementById("chapterProgressText");
    this.chapterCompleteCount = document.getElementById("chapterCompleteCount");
    this.bestRecordText = document.getElementById("bestRecordText");
    this.recommendedMoves = document.getElementById("recommendedMoves");
    this.movesUsed = document.getElementById("movesUsed");
    this.bestCombo = document.getElementById("bestCombo");
    this.scoreValue = document.getElementById("scoreValue");
    this.statusText = document.getElementById("statusText");
    this.restartButton = document.getElementById("restartButton");
    this.hintButton = document.getElementById("hintButton");
    this.shuffleButton = document.getElementById("shuffleButton");
    this.resetProgressButton = document.getElementById("resetProgressButton");
    this.soundToggle = document.getElementById("soundToggle");
    this.autoHintToggle = document.getElementById("autoHintToggle");
    this.contrastToggle = document.getElementById("contrastToggle");
    this.vibrationToggle = document.getElementById("vibrationToggle");
    this.resultOverlay = document.getElementById("resultOverlay");
    this.resultCard = document.getElementById("resultCard");
    this.resultEyebrow = document.getElementById("resultEyebrow");
    this.resultBadge = document.getElementById("resultBadge");
    this.resultTitle = document.getElementById("resultTitle");
    this.resultSummary = document.getElementById("resultSummary");
    this.resultUnlock = document.getElementById("resultUnlock");
    this.resultThemeChips = document.getElementById("resultThemeChips");
    this.resultStars = document.getElementById("resultStars");
    this.resultMetrics = document.getElementById("resultMetrics");
    this.resultProgressLabel = document.getElementById("resultProgressLabel");
    this.resultProgressValue = document.getElementById("resultProgressValue");
    this.resultProgressFill = document.getElementById("resultProgressFill");
    this.resultChapterSummary = document.getElementById("resultChapterSummary");
    this.resultReplay = document.getElementById("resultReplay");
    this.resultNext = document.getElementById("resultNext");
    this.chapterOverlay = document.getElementById("chapterOverlay");
    this.chapterIntroCard = document.getElementById("chapterIntroCard");
    this.chapterIntroEyebrow = document.getElementById("chapterIntroEyebrow");
    this.chapterIntroBadge = document.getElementById("chapterIntroBadge");
    this.chapterIntroTitle = document.getElementById("chapterIntroTitle");
    this.chapterIntroCopy = document.getElementById("chapterIntroCopy");
    this.chapterIntroChips = document.getElementById("chapterIntroChips");
    this.chapterIntroStats = document.getElementById("chapterIntroStats");
    this.chapterIntroProgressLabel = document.getElementById("chapterIntroProgressLabel");
    this.chapterIntroProgressValue = document.getElementById("chapterIntroProgressValue");
    this.chapterIntroProgressFill = document.getElementById("chapterIntroProgressFill");
    this.chapterIntroPrompt = document.getElementById("chapterIntroPrompt");
    this.chapterIntroContinue = document.getElementById("chapterIntroContinue");

    this.audio = new SoundEngine();
    this.saveData = this.loadProfile();
    this.currentLevelIndex = clamp(this.saveData.currentLevel, 0, LEVELS.length - 1);
    this.selectedCell = null;
    this.hoverHint = null;
    this.hintPulse = null;
    this.lastInputAt = performance.now();
    this.pointerSession = null;
    this.overlayAnimations = [];
    this.effects = [];
    this.particles = [];
    this.floatTexts = [];
    this.comboBursts = [];
    this.screenFlashes = [];
    this.specialCallouts = [];
    this.interactionLocked = false;
    this.liveSnapshot = null;
    this.core = null;
    this.displayBoard = null;
    this.activityEntries = [];

    this.createChapterCards();
    this.createLevelButtons();
    this.bindEvents();
    this.applySettings();
    this.startLevel(this.currentLevelIndex);

    requestAnimationFrame(this.render.bind(this));
  }

  loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) {
        return createSaveData();
      }

      const parsed = JSON.parse(raw);
      return {
        currentLevel: Number.isFinite(parsed.currentLevel) ? parsed.currentLevel : 0,
        unlockedLevel: Number.isFinite(parsed.unlockedLevel) ? parsed.unlockedLevel : 0,
        bestStars: parsed.bestStars || {},
        bestMoves: parsed.bestMoves || {},
        seenChapterIntro: parsed.seenChapterIntro || {},
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    } catch (error) {
      return createSaveData();
    }
  }

  persistProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(this.saveData));
  }

  get settings() {
    return this.saveData.settings;
  }

  applySettings() {
    document.body.classList.toggle("is-high-contrast", Boolean(this.settings.highContrast));
    this.audio.setEnabled(Boolean(this.settings.soundEnabled));
    if (this.core?.level?.theme) {
      this.applyLevelTheme(this.core.level.theme);
    }
    this.updateToggleLabels();
    this.persistProfile();
  }

  updateToggleLabels() {
    this.soundToggle.textContent = `音效 ${this.settings.soundEnabled ? "开" : "关"}`;
    this.autoHintToggle.textContent = `自动提示 ${this.settings.autoHint ? "开" : "关"}`;
    this.contrastToggle.textContent = `高对比 ${this.settings.highContrast ? "开" : "关"}`;
    this.vibrationToggle.textContent = `震动 ${this.settings.vibration ? "开" : "关"}`;

    this.soundToggle.classList.toggle("is-on", this.settings.soundEnabled);
    this.autoHintToggle.classList.toggle("is-on", this.settings.autoHint);
    this.contrastToggle.classList.toggle("is-on", this.settings.highContrast);
    this.vibrationToggle.classList.toggle("is-on", this.settings.vibration);
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown.bind(this));
    this.canvas.addEventListener("pointermove", this.handlePointerMove.bind(this));
    this.canvas.addEventListener("pointerup", this.handlePointerUp.bind(this));
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel.bind(this));
    this.canvas.addEventListener("pointerleave", this.handlePointerCancel.bind(this));

    this.restartButton.addEventListener("click", () => this.startLevel(this.currentLevelIndex));
    this.hintButton.addEventListener("click", () => this.showHint(true));
    this.shuffleButton.addEventListener("click", () => this.handleShuffle());
    this.resetProgressButton.addEventListener("click", () => this.handleResetProgress());
    this.soundToggle.addEventListener("click", () => {
      this.settings.soundEnabled = !this.settings.soundEnabled;
      this.applySettings();
      if (this.settings.soundEnabled) {
        this.activateAudio();
        this.audio.playHint();
      }
    });
    this.autoHintToggle.addEventListener("click", () => {
      this.settings.autoHint = !this.settings.autoHint;
      this.applySettings();
    });
    this.contrastToggle.addEventListener("click", () => {
      this.settings.highContrast = !this.settings.highContrast;
      this.applySettings();
    });
    this.vibrationToggle.addEventListener("click", () => {
      this.settings.vibration = !this.settings.vibration;
      this.applySettings();
    });

    this.resultReplay.addEventListener("click", () => {
      this.hideResult();
      this.startLevel(this.currentLevelIndex);
    });
    this.resultNext.addEventListener("click", () => {
      this.hideResult();
      if (this.currentLevelIndex >= LEVELS.length - 1) {
        this.startLevel(0);
        return;
      }
      this.startLevel(Math.min(this.currentLevelIndex + 1, LEVELS.length - 1));
    });
    this.chapterIntroContinue.addEventListener("click", () => {
      this.hideChapterIntro();
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (this.isResultVisible()) {
        if (key === "escape") {
          this.hideResult();
        } else if (key === "enter") {
          this.resultNext.click();
        }
        return;
      }

      if (this.isChapterIntroVisible()) {
        if (key === "escape" || key === "enter" || key === " ") {
          event.preventDefault();
          this.hideChapterIntro();
        }
        return;
      }

      if (key === "r") {
        this.startLevel(this.currentLevelIndex);
      } else if (key === "h") {
        this.showHint(true);
      }
    });
  }

  activateAudio() {
    this.audio.wake().catch(() => {});
  }

  maybeVibrate(pattern) {
    if (!this.settings.vibration || typeof navigator.vibrate !== "function") {
      return;
    }
    navigator.vibrate(pattern);
  }

  applyLevelTheme(theme) {
    const accent = theme?.accent || "#127475";
    const accentRgb = this.hexToRgb(accent);
    const strongMix = this.settings.highContrast ? 0.44 : 0.3;
    const softAlpha = this.settings.highContrast ? 0.2 : 0.14;
    const faintAlpha = this.settings.highContrast ? 0.12 : 0.08;
    document.body.style.setProperty("--theme-accent", accent);
    document.body.style.setProperty("--theme-accent-strong", this.mixColor(accent, "#10242a", strongMix));
    document.body.style.setProperty("--theme-accent-soft", `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${softAlpha})`);
    document.body.style.setProperty("--theme-accent-faint", `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${faintAlpha})`);
  }

  pushActivity(message, tone = "neutral") {
    const timestamp = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    if (this.activityEntries[0]?.message === message) {
      return;
    }

    this.activityEntries.unshift({ timestamp, message, tone });
    this.activityEntries = this.activityEntries.slice(0, 6);
    this.renderActivityFeed();
  }

  renderActivityFeed() {
    if (!this.activityList) {
      return;
    }

    this.activityList.innerHTML = "";
    this.activityEntries.forEach((item) => {
      const node = document.createElement("li");
      node.className = "activity-item";
      node.dataset.tone = item.tone;
      node.innerHTML = `
        <div class="activity-time">${item.timestamp}</div>
        <div class="activity-text">${item.message}</div>
      `;
      this.activityList.appendChild(node);
    });
  }

  isResultVisible() {
    return !this.resultOverlay.classList.contains("hidden");
  }

  isChapterIntroVisible() {
    return !this.chapterOverlay.classList.contains("hidden");
  }

  getChapterIndex(chapterId) {
    return CHAPTERS.findIndex((chapter) => chapter.id === chapterId);
  }

  getChapterLevels(chapterId) {
    return LEVELS.filter((level) => level.chapterId === chapterId);
  }

  getFirstLevelIndexForChapter(chapterId) {
    return LEVELS.findIndex((level) => level.chapterId === chapterId);
  }

  getLevelNumberInChapter(levelIndex = this.currentLevelIndex) {
    const level = LEVELS[levelIndex];
    return levelIndex - this.getFirstLevelIndexForChapter(level.chapterId) + 1;
  }

  getChapterCompletion(chapterId) {
    const levels = this.getChapterLevels(chapterId);
    const completed = levels.filter((level) => (this.saveData.bestStars[level.id] || 0) > 0).length;
    return { completed, total: levels.length };
  }

  getSuggestedLevelIndexForChapter(chapterId) {
    const levels = this.getChapterLevels(chapterId);
    const firstIncomplete = levels.find((level) => {
      const index = LEVELS.findIndex((item) => item.id === level.id);
      return index <= this.saveData.unlockedLevel && !(this.saveData.bestStars[level.id] || 0);
    });

    if (firstIncomplete) {
      return LEVELS.findIndex((level) => level.id === firstIncomplete.id);
    }

    return this.getFirstLevelIndexForChapter(chapterId);
  }

  getChapterStars(chapterId) {
    return this.getChapterLevels(chapterId)
      .reduce((sum, level) => sum + (this.saveData.bestStars[level.id] || 0), 0);
  }

  isChapterCompleted(chapterId) {
    const { completed, total } = this.getChapterCompletion(chapterId);
    return total > 0 && completed === total;
  }

  getCompletedLevelCount() {
    return LEVELS.filter((level) => (this.saveData.bestStars[level.id] || 0) > 0).length;
  }

  getCompletedChapterCount() {
    return CHAPTERS.filter((chapter) => this.isChapterCompleted(chapter.id)).length;
  }

  getTotalStars() {
    return LEVELS.reduce((sum, level) => sum + (this.saveData.bestStars[level.id] || 0), 0);
  }

  hasCompletedAllLevels() {
    return this.getCompletedLevelCount() === LEVELS.length;
  }

  handleResetProgress() {
    if (this.interactionLocked) {
      return;
    }

    const confirmed = window.confirm("确认清空当前进度并从第一章重新开始？设置选项会保留。");
    if (!confirmed) {
      return;
    }

    const preservedSettings = { ...this.settings };
    this.saveData = createSaveData(preservedSettings);
    this.currentLevelIndex = 0;
    this.activityEntries = [];
    this.hideResult();
    this.hideChapterIntro();
    this.persistProfile();
    this.refreshChapterCards();
    this.refreshLevelButtons();
    this.startLevel(0);
    this.setStatus("进度已重置，从第一章重新开始整理。");
    this.pushActivity("进度已重置，所有章节重新归零。", "warn");
  }

  createChapterCards() {
    this.chapterCards.innerHTML = "";
    CHAPTERS.forEach((chapter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chapter-card";
      button.style.setProperty("--chapter-card-accent", chapter.theme.accent);
      button.innerHTML = `
        <div class="chapter-card-title">
          <strong>${chapter.name}</strong>
          <span id="chapterStars-${chapter.id}">0★</span>
        </div>
        <div class="chapter-card-subtitle">${chapter.subtitle}</div>
        <div class="chapter-progress">
          <div class="chapter-progress-top">
            <span id="chapterCount-${chapter.id}">0 / 0 关</span>
            <span id="chapterLabel-${chapter.id}">待解锁</span>
          </div>
          <div class="chapter-progress-bar">
            <span id="chapterFill-${chapter.id}" style="width: 0%"></span>
          </div>
        </div>
      `;
      button.addEventListener("click", () => {
        if (this.interactionLocked) {
          return;
        }
        const firstLevelIndex = this.getFirstLevelIndexForChapter(chapter.id);
        if (firstLevelIndex > this.saveData.unlockedLevel) {
          this.setStatus(`章节 ${chapter.name} 还未解锁，先把前面的桌面整理完。`);
          return;
        }
        this.hideResult();
        this.startLevel(this.getSuggestedLevelIndexForChapter(chapter.id));
      });
      this.chapterCards.appendChild(button);
    });

    this.refreshChapterCards();
  }

  createLevelButtons() {
    this.levelList.innerHTML = "";
    LEVELS.forEach((level, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-button";
      button.innerHTML = `
        <span>
          <strong>${index + 1}. ${level.name}</strong>
          <span>${level.chapter}</span>
        </span>
        <span id="levelBadge-${index}">☆</span>
      `;
      button.addEventListener("click", () => {
        if (this.interactionLocked) {
          return;
        }
        if (index > this.saveData.unlockedLevel) {
          this.setStatus("这一关还没解锁，先把前面的桌面整理干净。");
          return;
        }
        this.hideResult();
        this.startLevel(index);
      });
      this.levelList.appendChild(button);
    });

    this.refreshLevelButtons();
  }

  refreshLevelButtons() {
    Array.from(this.levelList.children).forEach((button, index) => {
      button.classList.toggle("is-active", index === this.currentLevelIndex);
      button.classList.toggle("is-locked", index > this.saveData.unlockedLevel);
      const level = LEVELS[index];
      const stars = this.saveData.bestStars[level.id] || 0;
      const badge = button.querySelector(`#levelBadge-${index}`);
      if (badge) {
        badge.textContent = stars > 0 ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "☆";
      }
    });
  }

  refreshChapterCards() {
    Array.from(this.chapterCards.children).forEach((button, index) => {
      const chapter = CHAPTERS[index];
      const firstLevelIndex = this.getFirstLevelIndexForChapter(chapter.id);
      const { completed, total } = this.getChapterCompletion(chapter.id);
      const totalStars = this.getChapterStars(chapter.id);

      button.classList.toggle("is-active", LEVELS[this.currentLevelIndex].chapterId === chapter.id);
      button.classList.toggle("is-locked", firstLevelIndex > this.saveData.unlockedLevel);

      const countNode = button.querySelector(`#chapterCount-${chapter.id}`);
      const labelNode = button.querySelector(`#chapterLabel-${chapter.id}`);
      const fillNode = button.querySelector(`#chapterFill-${chapter.id}`);
      const starsNode = button.querySelector(`#chapterStars-${chapter.id}`);

      if (countNode) {
        countNode.textContent = `${completed} / ${total} 关`;
      }
      if (labelNode) {
        labelNode.textContent = firstLevelIndex > this.saveData.unlockedLevel
          ? "待解锁"
          : completed === total
            ? "已完成"
            : "进行中";
      }
      if (fillNode) {
        fillNode.style.width = `${(completed / total) * 100}%`;
      }
      if (starsNode) {
        starsNode.textContent = `${totalStars}★`;
      }
    });
  }

  startLevel(index) {
    this.hideResult();
    this.hideChapterIntro();
    this.currentLevelIndex = index;
    this.core = new CleanupCore(LEVELS[index]);
    this.applyLevelTheme(this.core.level.theme);
    this.displayBoard = copyBoard(this.core.board);
    this.liveSnapshot = null;
    this.selectedCell = null;
    this.hoverHint = null;
    this.hintPulse = null;
    this.pointerSession = null;
    this.overlayAnimations = [];
    this.effects = [];
    this.particles = [];
    this.floatTexts = [];
    this.comboBursts = [];
    this.screenFlashes = [];
    this.specialCallouts = [];
    this.interactionLocked = false;
    this.lastInputAt = performance.now();

    this.saveData.currentLevel = index;
    this.persistProfile();
    this.refreshChapterCards();
    this.refreshLevelButtons();
    this.updateHud();
    this.setStatus("交换相邻图标，先把这一屏从杂乱推回整洁。");
    this.pushActivity(`进入 ${this.core.level.chapter} · ${this.core.level.name}`, "neutral");
    this.maybeShowChapterIntro(index);
  }

  getCellFromPointerEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    if (x < BOARD_X || y < BOARD_Y || x > BOARD_X + BOARD_PIXEL_SIZE || y > BOARD_Y + BOARD_PIXEL_SIZE) {
      return null;
    }

    return {
      row: Math.floor((y - BOARD_Y) / TILE_SIZE),
      col: Math.floor((x - BOARD_X) / TILE_SIZE),
    };
  }

  handlePointerDown(event) {
    if (!this.core || this.interactionLocked || this.core.completed) {
      return;
    }
    const cell = this.getCellFromPointerEvent(event);
    if (!cell) {
      return;
    }

    this.activateAudio();
    this.pointerSession = {
      id: event.pointerId,
      origin: cell,
      startX: event.clientX,
      startY: event.clientY,
      resolved: false,
    };
    this.canvas.setPointerCapture?.(event.pointerId);
  }

  handlePointerMove(event) {
    if (!this.pointerSession || this.pointerSession.resolved || this.pointerSession.id !== event.pointerId) {
      return;
    }

    const dx = event.clientX - this.pointerSession.startX;
    const dy = event.clientY - this.pointerSession.startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      return;
    }

    const direction = Math.abs(dx) > Math.abs(dy)
      ? { row: 0, col: dx > 0 ? 1 : -1 }
      : { row: dy > 0 ? 1 : -1, col: 0 };

    const target = {
      row: this.pointerSession.origin.row + direction.row,
      col: this.pointerSession.origin.col + direction.col,
    };

    const origin = this.pointerSession.origin;
    this.pointerSession.resolved = true;
    this.clearPointerSession();

    if (!isInsideBoard(target.row, target.col)) {
      return;
    }

    this.requestSwap(origin, target);
  }

  handlePointerUp(event) {
    if (!this.pointerSession || this.pointerSession.id !== event.pointerId) {
      return;
    }

    const origin = this.pointerSession.origin;
    const resolved = this.pointerSession.resolved;
    this.clearPointerSession();
    if (!resolved) {
      this.handleTapSelection(origin);
    }
  }

  handlePointerCancel() {
    this.clearPointerSession();
  }

  clearPointerSession() {
    this.pointerSession = null;
  }

  handleTapSelection(cell) {
    if (this.interactionLocked || this.core.completed) {
      return;
    }

    this.lastInputAt = performance.now();
    this.hoverHint = null;
    this.hintPulse = null;

    if (!this.core.isInteractable(cell.row, cell.col)) {
      this.setStatus("这个格子被弹窗占住了，先从旁边把它关掉。");
      return;
    }

    if (!this.selectedCell) {
      this.selectedCell = cell;
      this.setStatus(`已选中 ${TILE_DEFS[this.displayBoard[cell.row][cell.col].tileType].label}。`);
      return;
    }

    if (this.selectedCell.row === cell.row && this.selectedCell.col === cell.col) {
      this.selectedCell = null;
      return;
    }

    if (!areAdjacent(this.selectedCell, cell)) {
      this.selectedCell = cell;
      this.setStatus(`重新选中 ${TILE_DEFS[this.displayBoard[cell.row][cell.col].tileType].label}。`);
      return;
    }

    const source = this.selectedCell;
    this.selectedCell = null;
    this.requestSwap(source, cell);
  }

  async requestSwap(a, b) {
    if (this.interactionLocked || this.core.completed) {
      return;
    }

    this.lastInputAt = performance.now();
    this.hoverHint = null;
    this.hintPulse = null;

    const result = this.core.performSwap(a, b);

    if (!result.valid) {
      this.interactionLocked = true;
      await this.animateInvalidSwap(result.startBoard, a, b);
      this.interactionLocked = false;
      this.updateHud();
      this.audio.playInvalid();
      this.pushActivity("无效交换，未形成整理链。", "warn");
      this.setStatus(result.reason === "invalid_target"
        ? "这两个位置不能交换。"
        : "这次交换没有形成整理链，图标自动回弹。");
      return;
    }

    this.interactionLocked = true;
    await this.animateSwap(result.startBoard, result.swapBoard, a, b, true);
    this.audio.playSwap();

    for (const cascade of result.cascades) {
      this.liveSnapshot = {
        cleanliness: cascade.cleanlinessAfter,
        score: cascade.scoreAfter,
        movesUsed: cascade.movesUsedAfter,
        bestCombo: cascade.bestComboAfter,
        goals: cascade.goalsAfter,
      };
      await this.animateCascade(cascade);
      this.updateHud();
    }

    this.displayBoard = copyBoard(this.core.board);
    this.liveSnapshot = null;
    this.updateHud();

    if (result.completed) {
      this.handleCompletion(result.stars);
      this.interactionLocked = false;
      return;
    }

    if (!this.core.findPossibleMove()) {
      await this.handleShuffle(true);
      this.setStatus("当前桌面没有可整理交换，系统已自动洗牌。");
    } else {
      this.setStatus("整理推进中，继续把桌面压回干净状态。");
    }

    this.interactionLocked = false;
  }

  async animateInvalidSwap(startBoard, a, b) {
    this.displayBoard = copyBoard(startBoard);
    await this.playOverlay({
      type: "swap",
      duration: SWAP_DURATION,
      easing: easeOutCubic,
      hiddenTileKeys: [cellKey(a.row, a.col), cellKey(b.row, b.col)],
      tiles: [
        { payload: boardToPayload(startBoard, a.row, a.col), from: a, to: b },
        { payload: boardToPayload(startBoard, b.row, b.col), from: b, to: a },
      ],
    });
    await this.playOverlay({
      type: "swap",
      duration: SWAP_DURATION,
      easing: easeOutBack,
      hiddenTileKeys: [cellKey(a.row, a.col), cellKey(b.row, b.col)],
      tiles: [
        { payload: boardToPayload(startBoard, b.row, b.col), from: a, to: b },
        { payload: boardToPayload(startBoard, a.row, a.col), from: b, to: a },
      ],
    });
    this.displayBoard = copyBoard(startBoard);
  }

  async animateSwap(startBoard, swapBoard, a, b) {
    this.displayBoard = copyBoard(startBoard);
    await this.playOverlay({
      type: "swap",
      duration: SWAP_DURATION,
      easing: easeOutCubic,
      hiddenTileKeys: [cellKey(a.row, a.col), cellKey(b.row, b.col)],
      tiles: [
        { payload: boardToPayload(startBoard, a.row, a.col), from: a, to: b },
        { payload: boardToPayload(startBoard, b.row, b.col), from: b, to: a },
      ],
    });
    this.displayBoard = copyBoard(swapBoard);
  }

  async animateCascade(cascade) {
    cascade.clearedTiles.forEach((tile) => {
      this.spawnParticles(tile.row, tile.col, tile.tileType, Math.min(3, cascade.combo));
    });

    cascade.effectBursts.forEach((effect) => {
      this.effects.push({
        ...effect,
        startedAt: performance.now(),
      });
      this.pushSpecialCallout(effect);
      this.audio.playSpecial(effect.type);
    });

    if (cascade.blockerEvents.length) {
      this.audio.playBlocker();
      this.maybeVibrate([10, 18, 10]);
    } else {
      this.maybeVibrate([10]);
    }

    this.audio.playClear(cascade.clearedTiles.length, cascade.combo);
    this.pushFloatText(`连锁 x${cascade.combo}`, 616, 112, this.core.level.theme.accent);

    if (cascade.combo >= 2) {
      this.pushComboBurst(cascade.combo, cascade.clearedTiles[0]?.tileType);
      this.pushScreenFlash(Math.min(1.6, 0.55 + cascade.combo * 0.12), cascade.clearedTiles[0]?.tileType);
    } else if (cascade.effectBursts.length) {
      this.pushScreenFlash(0.55, cascade.clearedTiles[0]?.tileType);
    }

    this.displayBoard = copyBoard(cascade.afterClearBoard);
    await this.playOverlay({
      type: "clear",
      duration: CLEAR_DURATION,
      easing: easeOutCubic,
      tiles: cascade.clearedTiles.map((tile) => ({
        payload: { tileType: tile.tileType, special: tile.special },
        at: { row: tile.row, col: tile.col },
      })),
    });

    if (cascade.drops.length) {
      const hiddenTileKeys = cascade.drops
        .filter((drop) => drop.from.row >= 0)
        .map((drop) => cellKey(drop.from.row, drop.from.col));
      await this.playOverlay({
        type: "drop",
        duration: DROP_DURATION_BASE + Math.min(140, this.maxDropDistance(cascade.drops) * 26),
        easing: easeInOutCubic,
        hiddenTileKeys,
        drops: cascade.drops,
      });
    }

    this.displayBoard = copyBoard(cascade.endBoard);
  }

  maxDropDistance(drops) {
    return drops.reduce((max, drop) => Math.max(max, Math.abs(drop.to.row - drop.from.row)), 1);
  }

  async handleShuffle(isAutomatic = false) {
    if (this.interactionLocked && !isAutomatic) {
      return;
    }

    const wasLocked = this.interactionLocked;
    this.interactionLocked = true;
    this.updateHud();
    const shuffleData = this.core.shuffle();
    this.displayBoard = copyBoard(shuffleData.beforeBoard);
    this.effects.push({
      type: "shuffle",
      row: 3,
      col: 3,
      tileType: "folder",
      startedAt: performance.now(),
    });

    await this.playOverlay({
      type: "shuffle",
      duration: SHUFFLE_DURATION,
      easing: easeInOutCubic,
      beforeBoard: shuffleData.beforeBoard,
      afterBoard: shuffleData.afterBoard,
    });

    this.displayBoard = copyBoard(shuffleData.afterBoard);
    this.interactionLocked = wasLocked;
    this.updateHud();
    this.pushActivity(isAutomatic ? "系统自动洗牌，桌面重新可整理。" : "手动执行洗牌，桌面已重排。", isAutomatic ? "warn" : "neutral");
    if (!isAutomatic) {
      this.setStatus("棋盘已经重新整理洗牌。");
    }
  }

  handleCompletion(stars) {
    const level = LEVELS[this.currentLevelIndex];
    const previousUnlockedLevel = this.saveData.unlockedLevel;
    const wasChapterCompleted = this.isChapterCompleted(level.chapterId);
    const wasAllCompleted = this.hasCompletedAllLevels();
    this.saveData.bestStars[level.id] = Math.max(this.saveData.bestStars[level.id] || 0, stars);
    const previousBestMoves = this.saveData.bestMoves[level.id];
    this.saveData.bestMoves[level.id] = Number.isFinite(previousBestMoves)
      ? Math.min(previousBestMoves, this.core.movesUsed)
      : this.core.movesUsed;
    this.saveData.unlockedLevel = Math.min(LEVELS.length - 1, Math.max(this.saveData.unlockedLevel, this.currentLevelIndex + 1));
    this.persistProfile();
    this.refreshChapterCards();
    this.refreshLevelButtons();
    this.updateHud();

    this.audio.playResult(stars);
    this.maybeVibrate([20, 40, 20]);
    this.pushActivity(`完成 ${level.name}，获得 ${stars} 星。`, "positive");
    this.showResult(stars, this.createResultState(previousUnlockedLevel, {
      wasChapterCompleted,
      wasAllCompleted,
    }));
  }

  buildUnlockMessage(previousUnlockedLevel, currentLevel, chapterCompleted, allCompleted) {
    if (allCompleted) {
      return "全部章节已经整理完成，可以从第一关继续刷星和最佳步数。";
    }

    if (this.currentLevelIndex + 1 > previousUnlockedLevel) {
      const nextLevel = LEVELS[this.currentLevelIndex + 1];
      if (!nextLevel) {
        return "全部章节已经整理完成，可以从第一关继续刷星和最佳步数。";
      }
      if (nextLevel.chapterId !== currentLevel.chapterId) {
        return `${currentLevel.chapter} 已整理完成，已解锁新章节：${nextLevel.chapter}。`;
      }
      return `已解锁下一关：${nextLevel.name}。`;
    }

    if (chapterCompleted) {
      return `${currentLevel.chapter} 已全部整理完成。`;
    }

    return "本关最佳星级与步数已保存。";
  }

  buildResultSummary(level) {
    const stepDelta = level.recommendedMoves - this.core.movesUsed;
    const paceText = stepDelta > 0
      ? `比推荐步数快 ${stepDelta} 步`
      : stepDelta < 0
        ? `比推荐步数多用了 ${Math.abs(stepDelta)} 步`
        : "刚好压在线上";

    return `本局用了 ${this.core.movesUsed} 步，最高连锁 ${this.core.bestCombo}，${paceText}，整洁度回满到 ${this.core.cleanliness}%。`;
  }

  renderMetricCards(container, metrics) {
    container.innerHTML = "";
    metrics.forEach((metric, index) => {
      const card = document.createElement("div");
      card.className = "result-metric";
      card.style.setProperty("--metric-delay", `${index * 70}ms`);
      card.innerHTML = `
        <div class="result-metric-label">${metric.label}</div>
        <div class="result-metric-value">${metric.value}</div>
      `;
      container.appendChild(card);
    });
  }

  getClutterLabel(clutter) {
    if (clutter === "paper") {
      return "散纸桌面";
    }
    if (clutter === "notes") {
      return "便签堆积";
    }
    if (clutter === "windows") {
      return "弹窗轰炸";
    }
    return "线缆残局";
  }

  getSpecialLabel(type) {
    if (type === "row") {
      return "横向归档";
    }
    if (type === "col") {
      return "纵向归档";
    }
    if (type === "bomb") {
      return "磁盘清扫";
    }
    if (type === "color") {
      return "全盘搜索";
    }
    if (type === "shuffle") {
      return "桌面重排";
    }
    return "整理工具";
  }

  renderThemeChips(container, chips) {
    if (!container) {
      return;
    }

    container.innerHTML = "";
    chips.forEach((chip) => {
      const node = document.createElement("div");
      node.className = "theme-chip";
      node.textContent = chip;
      container.appendChild(node);
    });
  }

  buildIntroChips(chapter, chapterLevels) {
    return [
      this.getClutterLabel(chapter.theme.clutter),
      `${chapterLevels.length} 关章节`,
      `章节累计 ${this.getChapterStars(chapter.id)}★`,
    ];
  }

  buildResultChips(level) {
    return [
      this.getClutterLabel(level.theme.clutter),
      `推荐 ${level.recommendedMoves} 步`,
      `${level.goals.length} 项任务`,
    ];
  }

  triggerOverlayEntrance(overlay, card) {
    overlay.classList.remove("is-animate-in");
    card.classList.remove("is-animate-in");
    void card.offsetWidth;
    overlay.classList.add("is-animate-in");
    card.classList.add("is-animate-in");
  }

  maybeShowChapterIntro(levelIndex) {
    const level = LEVELS[levelIndex];
    if (this.saveData.seenChapterIntro[level.chapterId]) {
      return;
    }
    this.showChapterIntro(level.chapterId, levelIndex);
  }

  showChapterIntro(chapterId, levelIndex = this.currentLevelIndex) {
    const chapter = CHAPTERS[this.getChapterIndex(chapterId)];
    const chapterLevels = this.getChapterLevels(chapterId);
    const { completed, total } = this.getChapterCompletion(chapterId);
    const totalStars = this.getChapterStars(chapterId);
    const levelNumber = this.getLevelNumberInChapter(levelIndex);
    const level = LEVELS[levelIndex];

    this.chapterOverlay.classList.remove("hidden");
    this.chapterIntroCard.style.setProperty("--chapter-accent", chapter.theme.accent);
    this.chapterIntroCard.style.setProperty("--chapter-clean-a", chapter.theme.cleanA);
    this.chapterIntroCard.style.setProperty("--chapter-clean-b", chapter.theme.cleanB);
    this.chapterIntroEyebrow.textContent = `章节 ${this.getChapterIndex(chapterId) + 1} / ${CHAPTERS.length}`;
    this.chapterIntroBadge.textContent = this.getCompletedLevelCount() === 0 ? "起始章节" : "新章节";
    this.chapterIntroTitle.textContent = `进入 ${chapter.name}`;
    this.chapterIntroCopy.textContent = chapter.subtitle;
    this.renderThemeChips(this.chapterIntroChips, this.buildIntroChips(chapter, chapterLevels));

    this.renderMetricCards(this.chapterIntroStats, [
      { label: "章节进度", value: `${completed} / ${total}` },
      { label: "章节星级", value: `${totalStars} / ${chapterLevels.length * 3}` },
      { label: "当前入口", value: `第 ${levelNumber} / ${chapterLevels.length} 关` },
      { label: "当前关卡", value: level.name },
    ]);

    this.chapterIntroProgressLabel.textContent = `${chapter.name} 进度`;
    this.chapterIntroProgressValue.textContent = `${completed} / ${total}`;
    this.chapterIntroProgressFill.style.width = `${(completed / total) * 100}%`;
    this.chapterIntroPrompt.textContent = completed === 0
      ? "这一章从这里展开。按 Enter 或点击开始整理。"
      : completed === total
        ? "这一章已经通关，可以继续刷星和最佳步数。"
        : `这一章还有 ${total - completed} 关待整理。按 Enter 或点击继续。`;

    this.saveData.seenChapterIntro[chapterId] = true;
    this.persistProfile();
    this.triggerOverlayEntrance(this.chapterOverlay, this.chapterIntroCard);
    this.setStatus(`已进入 ${chapter.name}，先熟悉这一章的整理主题。`);
    this.pushActivity(`章节展开：${chapter.name}`, "positive");
  }

  hideChapterIntro() {
    this.chapterOverlay.classList.add("hidden");
    this.chapterOverlay.classList.remove("is-animate-in");
    this.chapterIntroCard.classList.remove("is-animate-in");
    this.chapterIntroChips.innerHTML = "";
  }

  createResultState(previousUnlockedLevel, previousState) {
    const currentLevel = LEVELS[this.currentLevelIndex];
    const chapterLevels = this.getChapterLevels(currentLevel.chapterId);
    const chapterCompletion = this.getChapterCompletion(currentLevel.chapterId);
    const chapterStars = this.getChapterStars(currentLevel.chapterId);
    const completedLevels = this.getCompletedLevelCount();
    const completedChapters = this.getCompletedChapterCount();
    const totalStars = this.getTotalStars();
    const allCompleted = this.hasCompletedAllLevels();
    const chapterCompleted = this.isChapterCompleted(currentLevel.chapterId);
    const chapterJustCompleted = !previousState.wasChapterCompleted && chapterCompleted;
    const allJustCompleted = !previousState.wasAllCompleted && allCompleted;

    let mode = "level";
    let eyebrow = "整理完成";
    let badge = "本关完成";
    let title = `${currentLevel.name} 已整理完成`;
    let chapterSummary = `${currentLevel.chapter} 当前已完成 ${chapterCompletion.completed} / ${chapterCompletion.total} 关，累计 ${chapterStars} / ${chapterLevels.length * 3} 星。`;

    if (allJustCompleted) {
      mode = "all";
      eyebrow = "全盘归档";
      badge = "全部桌面完成";
      title = "所有章节整理完毕";
      chapterSummary = `4 个章节共 ${LEVELS.length} 关已全部整理，章节完成数 ${completedChapters} / ${CHAPTERS.length}，累计 ${totalStars} / ${LEVELS.length * 3} 星。`;
    } else if (chapterJustCompleted) {
      mode = "chapter";
      eyebrow = "章节完成";
      badge = `${currentLevel.chapter} 收尾`;
      title = `${currentLevel.chapter} 已整理完成`;
      chapterSummary = `${currentLevel.chapter} 的 ${chapterLevels.length} 关已全部打通，章节累计 ${chapterStars} / ${chapterLevels.length * 3} 星。`;
    }

    return {
      mode,
      eyebrow,
      badge,
      title,
      summary: this.buildResultSummary(currentLevel),
      unlockMessage: this.buildUnlockMessage(previousUnlockedLevel, currentLevel, chapterCompleted, allCompleted),
      chapterSummary,
      progressLabel: allCompleted ? "全局整理总览" : "全局整理进度",
      progressValue: `${completedLevels} / ${LEVELS.length}`,
      progressRate: completedLevels / LEVELS.length,
      totalStars,
      chapterStars,
    };
  }

  renderResultMetrics(stars, resultState) {
    const highlightLabel = resultState.mode === "chapter" ? "章节星级" : "总星级";
    const highlightValue = resultState.mode === "chapter"
      ? `${resultState.chapterStars} / ${this.getChapterLevels(this.core.level.chapterId).length * 3}`
      : `${resultState.totalStars} / ${LEVELS.length * 3}`;

    this.renderMetricCards(this.resultMetrics, [
      { label: "本关星级", value: `${stars} / 3` },
      { label: "本局步数", value: `${this.core.movesUsed} 步` },
      { label: "最高连锁", value: `${this.core.bestCombo}` },
      { label: highlightLabel, value: highlightValue },
    ]);
  }

  showResult(stars, resultState) {
    this.resultOverlay.classList.remove("hidden");
    this.resultCard.dataset.mode = resultState.mode;
    this.resultEyebrow.textContent = resultState.eyebrow;
    this.resultBadge.textContent = resultState.badge;
    this.resultTitle.textContent = resultState.title;
    this.resultSummary.textContent = resultState.summary;
    this.resultUnlock.textContent = resultState.unlockMessage;
    this.renderThemeChips(this.resultThemeChips, this.buildResultChips(this.core.level));
    this.resultStars.innerHTML = "";
    for (let index = 0; index < 3; index += 1) {
      const star = document.createElement("div");
      star.className = `result-star ${index < stars ? "is-earned" : "is-empty"}`;
      star.style.setProperty("--star-delay", `${140 + index * 120}ms`);
      star.textContent = "★";
      this.resultStars.appendChild(star);
    }
    this.renderResultMetrics(stars, resultState);
    this.resultProgressLabel.textContent = resultState.progressLabel;
    this.resultProgressValue.textContent = resultState.progressValue;
    this.resultProgressFill.style.width = `${resultState.progressRate * 100}%`;
    this.resultChapterSummary.textContent = resultState.chapterSummary;
    this.resultNext.disabled = false;
    this.resultNext.textContent = this.currentLevelIndex >= LEVELS.length - 1
      ? "回到第一关"
      : LEVELS[this.currentLevelIndex + 1].chapterId !== this.core.level.chapterId
        ? `进入 ${LEVELS[this.currentLevelIndex + 1].chapter}`
        : "下一关";
    if (resultState.mode === "chapter") {
      this.pushActivity(`章节完成：${this.core.level.chapter}`, "positive");
    } else if (resultState.mode === "all") {
      this.pushActivity("全章节整理完毕。", "positive");
    }
    this.triggerOverlayEntrance(this.resultOverlay, this.resultCard);
    this.setStatus(
      resultState.mode === "all"
        ? "全部章节已经归档完毕，可以从第一关继续刷星和最佳步数。"
        : resultState.mode === "chapter"
          ? "本章节已经收尾，可以进入下一张主题桌面。"
          : "这一关已经清空，可以继续推进下一张桌面。"
    );
  }

  hideResult() {
    this.resultOverlay.classList.add("hidden");
    this.resultOverlay.classList.remove("is-animate-in");
    this.resultCard.classList.remove("is-animate-in");
    this.resultCard.dataset.mode = "level";
    this.resultEyebrow.textContent = "整理完成";
    this.resultBadge.textContent = "本关完成";
    this.resultUnlock.textContent = "";
    this.resultThemeChips.innerHTML = "";
    this.resultMetrics.innerHTML = "";
    this.resultProgressLabel.textContent = "全局整理进度";
    this.resultProgressValue.textContent = `0 / ${LEVELS.length}`;
    this.resultProgressFill.style.width = "0%";
    this.resultChapterSummary.textContent = "";
    this.resultNext.textContent = "下一关";
  }

  showHint(manual) {
    if (this.interactionLocked || this.core.completed) {
      return;
    }

    const hint = this.core.findPossibleMove();
    if (!hint) {
      this.handleShuffle(true);
      return;
    }

    this.hoverHint = hint;
    this.hintPulse = { startedAt: performance.now() };
    this.lastInputAt = performance.now();
    if (manual) {
      this.audio.playHint();
      this.pushActivity("手动提示已显示。", "neutral");
      this.setStatus("提示已高亮：先从发亮的两个图标开始整理。");
    }
  }

  updateHud() {
    const level = this.core.level;
    const snapshot = this.liveSnapshot;
    const chapterLevels = this.getChapterLevels(level.chapterId);
    const chapterCompletion = this.getChapterCompletion(level.chapterId);
    const completedLevels = this.getCompletedLevelCount();
    const completedChapters = this.getCompletedChapterCount();
    const totalStars = this.getTotalStars();
    const bestStars = this.saveData.bestStars[level.id] || 0;
    const bestMoves = this.saveData.bestMoves[level.id];
    const bestRecordParts = [];

    if (bestStars > 0) {
      bestRecordParts.push(`${bestStars}★`);
    }
    if (Number.isFinite(bestMoves)) {
      bestRecordParts.push(`${bestMoves} 步`);
    }

    this.chapterLabel.textContent = `${level.chapter} · 第 ${this.getLevelNumberInChapter()} / ${this.getChapterLevels(level.chapterId).length} 关`;
    this.levelTitle.textContent = level.name;
    this.recommendedMoves.textContent = level.recommendedMoves;
    this.movesUsed.textContent = snapshot ? snapshot.movesUsed : this.core.movesUsed;
    this.bestCombo.textContent = snapshot ? snapshot.bestCombo : this.core.bestCombo;
    this.scoreValue.textContent = snapshot ? snapshot.score : this.core.score;
    this.overallProgressText.textContent = `${completedLevels} / ${LEVELS.length}`;
    this.overallProgressFill.style.width = `${(completedLevels / LEVELS.length) * 100}%`;
    this.totalStarsValue.textContent = `${totalStars} / ${LEVELS.length * 3}`;
    this.chapterProgressText.textContent = `当前章节 ${chapterCompletion.completed} / ${chapterLevels.length} · ${this.getChapterStars(level.chapterId)}★`;
    this.chapterCompleteCount.textContent = `${completedChapters} / ${CHAPTERS.length}`;
    this.bestRecordText.textContent = `本关最佳 ${bestRecordParts.length ? bestRecordParts.join(" · ") : "暂无"}`;

    const cleanliness = snapshot ? snapshot.cleanliness : this.core.cleanliness;
    this.cleanlinessFill.style.width = `${cleanliness}%`;
    this.cleanlinessLabel.textContent = `${cleanliness}%`;

    this.goalList.innerHTML = "";
    level.goals.forEach((goal, index) => {
      const key = this.core.goalKey(goal, index);
      const current = snapshot ? snapshot.goals[key] : this.core.getGoalCurrent(goal, index);
      const progressRate = clamp(current / goal.target, 0, 1);
      const item = document.createElement("li");
      item.className = `goal-item${current >= goal.target ? " is-complete" : ""}`;
      item.innerHTML = `
        <div class="goal-topline">
          <span class="goal-title">${describeGoal(goal)}</span>
          <span class="goal-progress">${Math.min(current, goal.target)} / ${goal.target}</span>
        </div>
        <div class="goal-meter"><span style="width: ${progressRate * 100}%"></span></div>
      `;
      this.goalList.appendChild(item);
    });

    const disabled = this.interactionLocked;
    this.restartButton.disabled = disabled;
    this.hintButton.disabled = disabled;
    this.shuffleButton.disabled = disabled;
  }

  setStatus(message) {
    this.statusText.textContent = message;
  }

  playOverlay(config) {
    return new Promise((resolve) => {
      this.overlayAnimations.push({
        ...config,
        startedAt: performance.now(),
        resolve,
      });
    });
  }

  render(timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.pruneTransientVisuals(timestamp);

    if (
      this.core &&
      this.settings.autoHint &&
      !this.core.completed &&
      !this.interactionLocked &&
      !this.isResultVisible() &&
      !this.isChapterIntroVisible()
    ) {
      if (timestamp - this.lastInputAt > IDLE_HINT_DELAY && !this.hoverHint) {
        this.showHint(false);
      }
    }

    this.drawBackdrop();
    this.drawBoardPanel();
    this.drawGoalStrip();
    this.drawBoard(timestamp);
    this.drawOverlayAnimations(timestamp);
    this.drawEffects(timestamp);
    this.drawScreenFlashes(timestamp);
    this.drawParticles(timestamp);
    this.drawComboBursts(timestamp);
    this.drawSpecialCallouts(timestamp);
    this.drawFloatTexts(timestamp);

    requestAnimationFrame(this.render.bind(this));
  }

  pruneTransientVisuals(timestamp) {
    const nextAnimations = [];
    for (const animation of this.overlayAnimations) {
      if (timestamp - animation.startedAt >= animation.duration) {
        animation.resolve();
      } else {
        nextAnimations.push(animation);
      }
    }
    this.overlayAnimations = nextAnimations;

    this.effects = this.effects.filter((effect) => timestamp - effect.startedAt < EFFECT_LIFE);
    this.particles = this.particles.filter((particle) => timestamp - particle.createdAt < particle.life);
    this.floatTexts = this.floatTexts.filter((text) => timestamp - text.createdAt < text.life);
    this.comboBursts = this.comboBursts.filter((burst) => timestamp - burst.createdAt < burst.life);
    this.screenFlashes = this.screenFlashes.filter((flash) => timestamp - flash.createdAt < flash.life);
    this.specialCallouts = this.specialCallouts.filter((callout) => timestamp - callout.createdAt < callout.life);

    if (this.hintPulse && timestamp - this.hintPulse.startedAt > 1400) {
      this.hoverHint = null;
      this.hintPulse = null;
    }
  }

  hiddenTileKeys() {
    const hidden = new Set();
    this.overlayAnimations.forEach((animation) => {
      (animation.hiddenTileKeys || []).forEach((key) => hidden.add(key));
    });
    return hidden;
  }

  drawBackdrop() {
    const theme = this.core.level.theme;
    const cleanliness = (this.liveSnapshot ? this.liveSnapshot.cleanliness : this.core.cleanliness) / 100;
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, this.mixColor(theme.messyA, theme.cleanA, cleanliness));
    gradient.addColorStop(1, this.mixColor(theme.messyB, theme.cleanB, cleanliness));
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.globalAlpha = 0.16 + cleanliness * 0.12;
    this.ctx.strokeStyle = this.mixColor("#fff3d0", "#ffffff", cleanliness);
    this.ctx.lineWidth = 1.4;
    for (let index = 0; index < 11; index += 1) {
      this.ctx.beginPath();
      this.ctx.arc(80 + index * 62, 62 + (index % 3) * 24, 12 + (index % 4) * 4, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();

    const messAlpha = 1 - cleanliness;
    this.ctx.save();
    this.ctx.globalAlpha = messAlpha * 0.65;
    if (theme.clutter === "paper") {
      this.drawPaperClutter();
    } else if (theme.clutter === "notes") {
      this.drawStickyClutter();
    } else if (theme.clutter === "windows") {
      this.drawWindowClutter();
    } else {
      this.drawCableClutter();
    }
    this.ctx.restore();
  }

  drawPaperClutter() {
    for (let index = 0; index < 8; index += 1) {
      this.ctx.save();
      this.ctx.translate(28 + index * 80, 46 + (index % 3) * 12);
      this.ctx.rotate(((index % 5) - 2) * 0.08);
      this.roundRect(this.ctx, 0, 0, 62, 42, 10);
      this.ctx.fillStyle = "#faf1de";
      this.ctx.fill();
      this.ctx.strokeStyle = "rgba(96, 82, 61, 0.14)";
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawStickyClutter() {
    for (let index = 0; index < 10; index += 1) {
      const x = 24 + (index * 66) % 560;
      const y = 32 + (index % 4) * 70;
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(((index % 6) - 3) * 0.06);
      this.roundRect(this.ctx, 0, 0, 48, 48, 12);
      this.ctx.fillStyle = index % 2 ? "#fbe59b" : "#ffcf87";
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  drawWindowClutter() {
    for (let index = 0; index < 6; index += 1) {
      const x = 30 + index * 106;
      const y = 30 + (index % 2) * 72;
      this.ctx.save();
      this.roundRect(this.ctx, x, y, 92, 58, 14);
      this.ctx.fillStyle = "#f8efe5";
      this.ctx.fill();
      this.ctx.fillStyle = "#d4b58e";
      this.ctx.fillRect(x + 12, y + 14, 60, 8);
      this.ctx.fillRect(x + 12, y + 28, 48, 8);
      this.ctx.restore();
    }
  }

  drawCableClutter() {
    this.ctx.strokeStyle = "#916c4d";
    this.ctx.lineWidth = 4;
    for (let index = 0; index < 5; index += 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(20, 70 + index * 60);
      this.ctx.bezierCurveTo(160, 40 + index * 40, 360, 116 + index * 26, 680, 60 + index * 56);
      this.ctx.stroke();
    }
  }

  drawBoardPanel() {
    this.ctx.save();
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    this.ctx.shadowBlur = 34;
    this.ctx.shadowOffsetY = 14;
    this.roundRect(this.ctx, BOARD_X - 22, BOARD_Y - 24, BOARD_PIXEL_SIZE + 44, BOARD_PIXEL_SIZE + 48, 32);
    this.ctx.fillStyle = "rgba(253, 248, 240, 0.74)";
    this.ctx.fill();
    this.ctx.restore();
  }

  drawGoalStrip() {
    const cleanliness = (this.liveSnapshot ? this.liveSnapshot.cleanliness : this.core.cleanliness) / 100;
    this.ctx.save();
    this.roundRect(this.ctx, 92, 40, 536, 76, 22);
    this.ctx.fillStyle = "rgba(255, 253, 246, 0.76)";
    this.ctx.fill();
    this.ctx.fillStyle = "rgba(18, 32, 40, 0.6)";
    this.ctx.font = '600 16px "Avenir Next", "PingFang SC", sans-serif';
    this.ctx.fillText("桌面恢复进程", 118, 70);
    this.ctx.font = '800 24px "Avenir Next", "PingFang SC", sans-serif';
    this.ctx.fillStyle = this.mixColor("#965224", "#127475", cleanliness);
    this.ctx.fillText(`${Math.round(cleanliness * 100)}%`, 118, 98);

    this.roundRect(this.ctx, 250, 64, 340, 18, 999);
    this.ctx.fillStyle = "rgba(18, 32, 40, 0.08)";
    this.ctx.fill();
    this.roundRect(this.ctx, 250, 64, 340 * cleanliness, 18, 999);
    this.ctx.fillStyle = this.createGradient(250, 64, 590, 82, "#f1b454", "#1ba79b");
    this.ctx.fill();
    this.ctx.restore();
  }

  drawBoard(timestamp) {
    const board = this.displayBoard || this.core.board;
    const hidden = this.hiddenTileKeys();

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = board[row][col];
        const x = BOARD_X + col * TILE_SIZE;
        const y = BOARD_Y + row * TILE_SIZE;
        const baseColor = (row + col) % 2 === 0 ? "rgba(255,255,255,0.5)" : "rgba(247, 240, 228, 0.76)";

        this.ctx.save();
        this.roundRect(this.ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 18);
        this.ctx.fillStyle = baseColor;
        this.ctx.fill();
        this.ctx.strokeStyle = "rgba(24, 32, 40, 0.08)";
        this.ctx.stroke();
        this.ctx.restore();

        if (this.selectedCell && this.selectedCell.row === row && this.selectedCell.col === col) {
          this.ctx.save();
          this.roundRect(this.ctx, x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 18);
          this.ctx.strokeStyle = "#127475";
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
          this.ctx.restore();
        }

        if (this.hoverHint && this.hoverHint.some((hint) => hint.row === row && hint.col === col)) {
          const pulse = this.hintPulse ? (Math.sin((timestamp - this.hintPulse.startedAt) / 180) + 1) / 2 : 0.5;
          this.ctx.save();
          this.roundRect(this.ctx, x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12, 16);
          this.ctx.strokeStyle = `rgba(18, 116, 117, ${0.24 + pulse * 0.34})`;
          this.ctx.lineWidth = 4;
          this.ctx.stroke();
          this.ctx.restore();
        }

        if (cell.tileType && !hidden.has(cellKey(row, col))) {
          this.drawTilePayload({ tileType: cell.tileType, special: cell.special }, x + TILE_SIZE / 2, y + TILE_SIZE / 2, 1, 1);
        }

        if (cell.blocker) {
          this.drawBlocker(cell.blocker, x, y);
        }
      }
    }
  }

  drawTilePayload(payload, centerX, centerY, scale = 1, alpha = 1) {
    const def = TILE_DEFS[payload.tileType];
    if (!def) {
      return;
    }

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(scale, scale);

    this.roundRect(this.ctx, -25, -25, 50, 50, 16);
    this.ctx.fillStyle = def.color;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(24, 32, 40, 0.08)";
    this.ctx.stroke();

    if (payload.special) {
      this.ctx.fillStyle = "rgba(18, 32, 40, 0.06)";
      this.roundRect(this.ctx, -21, -21, 42, 42, 14);
      this.ctx.fill();
    }

    this.drawTileIcon(def, payload.special);
    this.ctx.restore();
  }

  drawTileIcon(def, special) {
    this.ctx.save();
    this.ctx.fillStyle = def.accent;
    this.ctx.strokeStyle = def.accent;
    this.ctx.lineWidth = 2.4;

    if (def.id === "doc") {
      this.roundRect(this.ctx, -14, -18, 28, 36, 7);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(6, -18);
      this.ctx.lineTo(14, -10);
      this.ctx.lineTo(6, -10);
      this.ctx.closePath();
      this.ctx.stroke();
      for (let index = 0; index < 3; index += 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(-8, -6 + index * 8);
        this.ctx.lineTo(8, -6 + index * 8);
        this.ctx.stroke();
      }
    } else if (def.id === "screenshot") {
      this.roundRect(this.ctx, -17, -14, 34, 28, 8);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(-10, 10);
      this.ctx.lineTo(-2, 1);
      this.ctx.lineTo(5, 8);
      this.ctx.lineTo(12, -1);
      this.ctx.lineTo(16, 10);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(-8, -6, 3.2, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (def.id === "folder") {
      this.ctx.beginPath();
      this.ctx.moveTo(-16, -6);
      this.ctx.lineTo(-9, -14);
      this.ctx.lineTo(2, -14);
      this.ctx.lineTo(5, -9);
      this.ctx.lineTo(16, -9);
      this.ctx.lineTo(16, 14);
      this.ctx.lineTo(-16, 14);
      this.ctx.closePath();
      this.ctx.stroke();
    } else if (def.id === "zip") {
      this.roundRect(this.ctx, -15, -17, 30, 34, 8);
      this.ctx.stroke();
      for (let index = -10; index <= 10; index += 5) {
        this.ctx.fillRect(-1, index, 2, 3);
      }
    } else if (def.id === "shortcut") {
      this.roundRect(this.ctx, -16, -16, 32, 32, 9);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(-2, 9);
      this.ctx.lineTo(8, -1);
      this.ctx.lineTo(3, -1);
      this.ctx.lineTo(11, -9);
      this.ctx.lineTo(11, -1);
      this.ctx.lineTo(3, -1);
      this.ctx.stroke();
    } else if (def.id === "temp") {
      this.roundRect(this.ctx, -15, -15, 30, 30, 10);
      this.ctx.stroke();
      this.ctx.globalAlpha = 0.22;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      for (let row = -8; row <= 8; row += 8) {
        for (let col = -8; col <= 8; col += 8) {
          this.ctx.beginPath();
          this.ctx.arc(col, row, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    if (special) {
      this.ctx.fillStyle = "#182028";
      this.ctx.strokeStyle = "#182028";
      if (special === "row") {
        this.ctx.fillRect(-12, 16, 24, 3);
      } else if (special === "col") {
        this.ctx.fillRect(14, -12, 3, 24);
      } else if (special === "bomb") {
        this.ctx.beginPath();
        this.ctx.arc(15, 15, 6, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (special === "color") {
        this.ctx.beginPath();
        this.ctx.arc(15, 15, 7, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(15, 15, 2.4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  drawBlocker(blocker, x, y) {
    if (blocker.type === "dust") {
      this.ctx.save();
      this.ctx.globalAlpha = 0.48;
      this.ctx.fillStyle = "#c7a87a";
      for (let index = 0; index < 9; index += 1) {
        const px = x + 14 + (index * 7) % 34;
        const py = y + 12 + (index * 11) % 30;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 3 + (index % 3), 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (blocker.type === "sticky_note") {
      this.ctx.save();
      this.ctx.translate(x + 10, y + 10);
      this.ctx.rotate(-0.06);
      this.roundRect(this.ctx, 0, 0, TILE_SIZE - 20, TILE_SIZE - 20, 12);
      this.ctx.fillStyle = "#f8df7d";
      this.ctx.fill();
      this.ctx.fillStyle = "rgba(24, 32, 40, 0.18)";
      this.ctx.fillRect(8, 14, TILE_SIZE - 36, 4);
      this.ctx.fillRect(8, 24, TILE_SIZE - 28, 4);
      this.ctx.restore();
    } else if (blocker.type === "popup") {
      this.ctx.save();
      this.roundRect(this.ctx, x + 10, y + 12, TILE_SIZE - 20, TILE_SIZE - 24, 14);
      this.ctx.fillStyle = "#fbf7f1";
      this.ctx.fill();
      this.ctx.strokeStyle = "rgba(24, 32, 40, 0.16)";
      this.ctx.stroke();
      this.ctx.fillStyle = blocker.hp === 2 ? "#cc7c5a" : "#d9a56c";
      this.ctx.fillRect(x + 16, y + 18, TILE_SIZE - 32, 7);
      this.ctx.fillStyle = "rgba(24, 32, 40, 0.12)";
      this.ctx.fillRect(x + 18, y + 31, TILE_SIZE - 36, 6);
      this.ctx.fillRect(x + 18, y + 43, TILE_SIZE - 42, 6);
      this.ctx.fillStyle = "rgba(24, 32, 40, 0.46)";
      this.ctx.font = '700 13px "Avenir Next", "PingFang SC", sans-serif';
      this.ctx.fillText(`x${blocker.hp}`, x + 18, y + 60);
      this.ctx.restore();
    }
  }

  drawOverlayAnimations(timestamp) {
    for (const animation of this.overlayAnimations) {
      const rawProgress = clamp((timestamp - animation.startedAt) / animation.duration, 0, 1);
      const progress = animation.easing ? animation.easing(rawProgress) : rawProgress;

      if (animation.type === "swap") {
        animation.tiles.forEach((tile) => {
          const x = lerp(tile.from.col, tile.to.col, progress);
          const y = lerp(tile.from.row, tile.to.row, progress);
          const scale = 1 + Math.sin(rawProgress * Math.PI) * 0.04;
          this.drawTilePayload(tile.payload, BOARD_X + x * TILE_SIZE + TILE_SIZE / 2, BOARD_Y + y * TILE_SIZE + TILE_SIZE / 2, scale, 1);
        });
      } else if (animation.type === "clear") {
        animation.tiles.forEach((tile) => {
          const centerX = BOARD_X + tile.at.col * TILE_SIZE + TILE_SIZE / 2;
          const centerY = BOARD_Y + tile.at.row * TILE_SIZE + TILE_SIZE / 2;
          const alpha = 1 - rawProgress;
          const scale = 1 - rawProgress * 0.28;
          this.drawTilePayload(tile.payload, centerX, centerY, scale, alpha);
        });
      } else if (animation.type === "drop") {
        animation.drops.forEach((drop) => {
          const x = lerp(drop.from.col, drop.to.col, progress);
          const y = lerp(drop.from.row, drop.to.row, progress);
          this.drawTilePayload(
            { tileType: drop.tileType, special: drop.special },
            BOARD_X + x * TILE_SIZE + TILE_SIZE / 2,
            BOARD_Y + y * TILE_SIZE + TILE_SIZE / 2,
            1,
            1
          );
        });
      } else if (animation.type === "shuffle") {
        this.ctx.save();
        this.ctx.globalAlpha = 0.2 + Math.sin(rawProgress * Math.PI) * 0.28;
        this.ctx.fillStyle = "#ffffff";
        this.roundRect(this.ctx, BOARD_X - 12, BOARD_Y - 12, BOARD_PIXEL_SIZE + 24, BOARD_PIXEL_SIZE + 24, 26);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  drawEffects(timestamp) {
    this.effects.forEach((effect) => {
      const elapsed = timestamp - effect.startedAt;
      const progress = clamp(elapsed / EFFECT_LIFE, 0, 1);
      const color = TILE_DEFS[effect.tileType]?.accent || "#127475";
      this.ctx.save();
      this.ctx.globalAlpha = 1 - progress;
      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
      this.ctx.lineWidth = 6;

      if (effect.type === "row") {
        const y = BOARD_Y + effect.row * TILE_SIZE + TILE_SIZE / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(BOARD_X, y);
        this.ctx.lineTo(BOARD_X + BOARD_PIXEL_SIZE, y);
        this.ctx.stroke();
      } else if (effect.type === "col") {
        const x = BOARD_X + effect.col * TILE_SIZE + TILE_SIZE / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, BOARD_Y);
        this.ctx.lineTo(x, BOARD_Y + BOARD_PIXEL_SIZE);
        this.ctx.stroke();
      } else if (effect.type === "shuffle") {
        this.ctx.strokeStyle = "rgba(18, 116, 117, 0.32)";
        this.ctx.lineWidth = 8;
        this.roundRect(this.ctx, BOARD_X - 10, BOARD_Y - 10, BOARD_PIXEL_SIZE + 20, BOARD_PIXEL_SIZE + 20, 24);
        this.ctx.stroke();
      } else {
        const x = BOARD_X + effect.col * TILE_SIZE + TILE_SIZE / 2;
        const y = BOARD_Y + effect.row * TILE_SIZE + TILE_SIZE / 2;
        const radius = 18 + progress * 58;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  pushComboBurst(combo, tileType) {
    this.comboBursts.push({
      combo,
      tileType,
      createdAt: performance.now(),
      life: COMBO_BURST_LIFE,
    });
  }

  pushScreenFlash(strength, tileType) {
    this.screenFlashes.push({
      strength,
      tileType,
      createdAt: performance.now(),
      life: FLASH_LIFE + strength * 90,
    });
  }

  pushSpecialCallout(effect) {
    this.specialCallouts.push({
      ...effect,
      label: this.getSpecialLabel(effect.type),
      createdAt: performance.now(),
      life: 760,
    });
  }

  spawnParticles(row, col, tileType, intensity = 1) {
    const centerX = BOARD_X + col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = BOARD_Y + row * TILE_SIZE + TILE_SIZE / 2;
    const accent = TILE_DEFS[tileType].accent;
    const count = 8 + intensity * 4;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.5;
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * (14 + intensity * 3 + Math.random() * 14),
        vy: Math.sin(angle) * (14 + intensity * 3 + Math.random() * 14),
        size: 2 + Math.random() * (3 + intensity * 0.8),
        color: accent,
        createdAt: performance.now(),
        life: PARTICLE_LIFE + intensity * 40,
      });
    }
  }

  drawParticles(timestamp) {
    this.particles.forEach((particle) => {
      const progress = clamp((timestamp - particle.createdAt) / particle.life, 0, 1);
      const x = particle.x + particle.vx * progress * 1.9;
      const y = particle.y + particle.vy * progress * 1.9 + progress * 22;
      const size = particle.size * (1 - progress * 0.4);
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, 1 - progress);
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  drawScreenFlashes(timestamp) {
    this.screenFlashes.forEach((flash) => {
      const progress = clamp((timestamp - flash.createdAt) / flash.life, 0, 1);
      const alpha = (1 - progress) * (0.16 + flash.strength * 0.1);
      const accent = TILE_DEFS[flash.tileType]?.accent || this.core.level.theme.accent;
      const fill = this.hexToRgba(accent, alpha);
      const stroke = this.hexToRgba(accent, alpha * 1.2);

      this.ctx.save();
      this.roundRect(this.ctx, BOARD_X - 14, BOARD_Y - 14, BOARD_PIXEL_SIZE + 28, BOARD_PIXEL_SIZE + 28, 28);
      this.ctx.fillStyle = fill;
      this.ctx.fill();
      this.ctx.lineWidth = 8 + flash.strength * 6;
      this.ctx.strokeStyle = stroke;
      this.ctx.stroke();
      this.ctx.restore();
    });
  }

  drawSpecialCallouts(timestamp) {
    this.specialCallouts.forEach((callout) => {
      const progress = clamp((timestamp - callout.createdAt) / callout.life, 0, 1);
      const eased = easeOutCubic(progress);
      const alpha = 1 - progress;
      const accent = TILE_DEFS[callout.tileType]?.accent || this.core.level.theme.accent;
      const x = BOARD_X + callout.col * TILE_SIZE + TILE_SIZE / 2;
      const y = BOARD_Y + callout.row * TILE_SIZE + TILE_SIZE / 2 - 48 - eased * 18;
      const width = 122;
      const height = 34;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(x, y);
      this.ctx.scale(0.92 + eased * 0.08, 0.92 + eased * 0.08);
      this.roundRect(this.ctx, -width / 2, -height / 2, width, height, 999);
      this.ctx.fillStyle = this.createGradient(-width / 2, 0, width / 2, 0, "#f5c26b", accent);
      this.ctx.fill();
      this.ctx.strokeStyle = this.hexToRgba("#ffffff", 0.38);
      this.ctx.lineWidth = 1.8;
      this.ctx.stroke();
      this.ctx.fillStyle = "rgba(255,255,255,0.96)";
      this.ctx.font = '800 14px "Avenir Next", "PingFang SC", sans-serif';
      this.ctx.textAlign = "center";
      this.ctx.fillText(callout.label, 0, 5);
      this.ctx.restore();
    });
  }

  pushFloatText(text, x, y, color) {
    this.floatTexts.push({
      text,
      x,
      y,
      color,
      createdAt: performance.now(),
      life: 780,
    });
  }

  drawFloatTexts(timestamp) {
    this.floatTexts.forEach((item) => {
      const progress = clamp((timestamp - item.createdAt) / item.life, 0, 1);
      this.ctx.save();
      this.ctx.globalAlpha = 1 - progress;
      this.ctx.fillStyle = item.color;
      this.ctx.font = '700 18px "Avenir Next", "PingFang SC", sans-serif';
      this.ctx.fillText(item.text, item.x, item.y - progress * 22);
      this.ctx.restore();
    });
  }

  drawComboBursts(timestamp) {
    this.comboBursts.forEach((burst, index) => {
      const progress = clamp((timestamp - burst.createdAt) / burst.life, 0, 1);
      const eased = easeOutCubic(progress);
      const alpha = 1 - progress;
      const accent = TILE_DEFS[burst.tileType]?.accent || this.core.level.theme.accent;
      const centerX = BOARD_X + BOARD_PIXEL_SIZE / 2;
      const centerY = 118 + index * 2;
      const width = 188 + burst.combo * 10;
      const height = 58;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(centerX, centerY - eased * 18);
      this.ctx.scale(0.88 + eased * 0.12, 0.88 + eased * 0.12);

      for (let ray = 0; ray < 6; ray += 1) {
        this.ctx.save();
        this.ctx.rotate((Math.PI * 2 * ray) / 6 + progress * 0.4);
        this.ctx.fillStyle = this.hexToRgba(accent, 0.08 + alpha * 0.08);
        this.ctx.fillRect(-4, -58, 8, 26);
        this.ctx.restore();
      }

      this.roundRect(this.ctx, -width / 2, -height / 2, width, height, 999);
      this.ctx.fillStyle = this.createGradient(-width / 2, 0, width / 2, 0, "#f6c25c", accent);
      this.ctx.fill();
      this.ctx.strokeStyle = this.hexToRgba("#ffffff", 0.45);
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = "rgba(255,255,255,0.96)";
      this.ctx.font = '800 16px "Avenir Next", "PingFang SC", sans-serif';
      this.ctx.textAlign = "center";
      this.ctx.fillText(burst.combo >= 4 ? "桌面爆发" : "连锁推进", 0, -5);
      this.ctx.font = '900 22px "Avenir Next", "PingFang SC", sans-serif';
      this.ctx.fillText(`x${burst.combo}`, 0, 18);
      this.ctx.restore();
    });
  }

  createGradient(x0, y0, x1, y1, colorA, colorB) {
    const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(1, colorB);
    return gradient;
  }

  mixColor(hexA, hexB, ratio) {
    const colorA = this.hexToRgb(hexA);
    const colorB = this.hexToRgb(hexB);
    return `rgb(${Math.round(lerp(colorA.r, colorB.r, ratio))}, ${Math.round(lerp(colorA.g, colorB.g, ratio))}, ${Math.round(lerp(colorA.b, colorB.b, ratio))})`;
  }

  hexToRgba(hex, alpha) {
    const color = this.hexToRgb(hex);
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  hexToRgb(hex) {
    const value = hex.replace("#", "");
    const parsed = Number.parseInt(value, 16);
    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    };
  }

  roundRect(ctx, x, y, width, height, radius) {
    const capped = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + capped, y);
    ctx.arcTo(x + width, y, x + width, y + height, capped);
    ctx.arcTo(x + width, y + height, x, y + height, capped);
    ctx.arcTo(x, y + height, x, y, capped);
    ctx.arcTo(x, y, x + width, y, capped);
    ctx.closePath();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DesktopCleanupApp();
});
