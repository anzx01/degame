import assert from "node:assert/strict";
import { DesktopCleanupApp, isBetterLeaderboardRecord, isValidEmail, normalizeEmail } from "./app.js";
import { LEVELS } from "./levels.js";

class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
    this.sync();
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
    this.sync();
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) {
      this.values.add(name);
    } else {
      this.values.delete(name);
    }
    this.sync();
    return shouldAdd;
  }

  sync() {
    this.owner.className = Array.from(this.values).join(" ");
  }
}

class ElementStub {
  constructor(tagName = "div", document = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.eventListeners = new Map();
    this.dataset = {};
    this.style = {
      values: {},
      setProperty: (key, value) => {
        this.style.values[key] = value;
      },
    };
    this.classList = new ClassList(this);
    this.className = "";
    this.attributes = {};
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.innerHTMLValue = "";
  }

  set id(value) {
    this._id = value;
    this.ownerDocument?.registerElement(value, this);
  }

  get id() {
    return this._id;
  }

  set innerHTML(value) {
    this.innerHTMLValue = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  addEventListener(type, callback) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(callback);
    this.eventListeners.set(type, listeners);
  }

  click() {
    this.dispatchEvent({ type: "click", key: "", preventDefault() {} });
  }

  dispatchEvent(event) {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach((listener) => listener(event));
  }

  querySelector(selector) {
    if (!selector.startsWith("#")) {
      return null;
    }
    const id = selector.slice(1);
    return this.ownerDocument?.getElementById(id) || null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

class CanvasStub extends ElementStub {
  constructor(document) {
    super("canvas", document);
    this.width = 720;
    this.height = 760;
  }

  getContext() {
    return createCanvasContext();
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }

  setPointerCapture() {}
  releasePointerCapture() {}
}

class DocumentStub {
  constructor() {
    this.elements = new Map();
    this.body = new ElementStub("body", this);
  }

  registerElement(id, element) {
    this.elements.set(id, element);
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      const element = id === "gameCanvas" ? new CanvasStub(this) : new ElementStub("div", this);
      element.id = id;
    }
    return this.elements.get(id);
  }

  createElement(tagName) {
    return new ElementStub(tagName, this);
  }
}

class LocalStorageStub {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

function createCanvasContext() {
  const noop = () => {};
  return {
    canvas: {},
    arc: noop,
    arcTo: noop,
    beginPath: noop,
    clearRect: noop,
    closePath: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    ellipse: noop,
    fill: noop,
    fillRect: noop,
    fillText: noop,
    lineTo: noop,
    measureText: (text) => ({ width: String(text).length * 8 }),
    moveTo: noop,
    quadraticCurveTo: noop,
    rect: noop,
    restore: noop,
    rotate: noop,
    save: noop,
    scale: noop,
    stroke: noop,
    strokeRect: noop,
    translate: noop,
  };
}

function installBrowserStubs() {
  const document = new DocumentStub();
  const localStorage = new LocalStorageStub();
  const windowListeners = new Map();

  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.performance = { now: () => 1000 };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.Audio = class AudioStub {
    constructor(src) {
      this.src = src;
      this.volume = 1;
    }

    play() {
      return Promise.resolve();
    }
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  globalThis.window = {
    TextEncoder,
    addEventListener(type, callback) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(callback);
      windowListeners.set(type, listeners);
    },
    confirm: () => true,
    crypto: undefined,
  };

  return { document, localStorage };
}

function findCell(core, predicate) {
  for (let row = 0; row < core.board.length; row += 1) {
    for (let col = 0; col < core.board[row].length; col += 1) {
      if (predicate(core.board[row][col], row, col)) {
        return { row, col };
      }
    }
  }
  return null;
}

async function run() {
  const { localStorage } = installBrowserStubs();

  assert.equal(normalizeEmail("  PLAYER@Example.COM "), "player@example.com");
  assert.equal(isValidEmail("player@example.com"), true);
  assert.equal(isValidEmail("player.example.com"), false);
  assert.equal(isBetterLeaderboardRecord({ stars: 3, score: 100, moves: 12, completedAt: "2026-01-01T00:00:00.000Z" }, null), true);
  assert.equal(isBetterLeaderboardRecord(
    { stars: 2, score: 900, moves: 8, completedAt: "2026-01-01T00:00:00.000Z" },
    { stars: 3, score: 100, moves: 12, completedAt: "2026-01-01T00:00:00.000Z" },
  ), false);

  const app = new DesktopCleanupApp();
  assert.equal(app.leaderboardList.children.length, 1);
  assert.equal(app.leaderboardList.children[0].classList.contains("is-live"), true);
  assert.equal(app.leaderboardList.children[0].children[0].textContent, "本");
  assert.equal(app.leaderboardEmpty.classList.contains("hidden"), false);

  app.authEmail.value = "first@example.com";
  app.authPassword.value = "secret1";
  await app.handleRegister();
  assert.equal(app.currentUser.email, "first@example.com");
  assert.equal(app.authSignedOut.classList.contains("hidden"), true);
  assert.equal(app.authSignedIn.classList.contains("hidden"), false);

  app.saveData.bestStars[LEVELS[0].id] = 2;
  app.persistProfile();
  app.handleLogout();
  assert.equal(app.currentUser, null);
  assert.equal(app.saveData.bestStars[LEVELS[0].id] || 0, 0);

  app.authEmail.value = "first@example.com";
  app.authPassword.value = "secret1";
  await app.handleLogin();
  assert.equal(app.currentUser.email, "first@example.com");
  assert.equal(app.saveData.bestStars[LEVELS[0].id], 2);

  const arrivals = app.collectClearedTiles([
    { tileType: "doc", meta: { project: "工作", state: "normal" } },
    { tileType: "temp", meta: { project: "下载", state: "temp" } },
    { tileType: "screenshot", meta: { project: "照片", state: "duplicate" } },
  ], 2);
  assert.equal(arrivals.length, 3);
  assert.equal(app.desktopCollections.folders["工作"], 1);
  assert.equal(app.desktopCollections.trash, 2);

  const archiveTarget = findCell(app.core, (cell) => cell.tileType && cell.tileType !== "temp");
  const archiveResult = app.core.performDesktopAction("archive", archiveTarget);
  assert.equal(archiveResult.valid, true);
  assert.equal(app.core.desktopActions.archive, 1);
  assert.ok(archiveResult.clearedTiles[0].meta?.project);

  const trashTarget = findCell(app.core, (cell) => cell.tileType);
  app.core.setTile(app.core.board[trashTarget.row][trashTarget.col], "temp", null, {
    project: "下载",
    source: "下载区",
    state: "temp",
    zone: "回收站",
    createdAt: "今天",
  });
  const trashResult = app.core.performDesktopAction("trash", trashTarget);
  assert.equal(trashResult.valid, true);
  assert.equal(app.core.desktopActions.trash, 1);

  app.startLevel(3);
  const popupTarget = findCell(app.core, (cell) => cell.blocker?.type === "popup");
  const closeResult = app.core.performDesktopAction("close", popupTarget);
  assert.equal(closeResult.valid, true);
  assert.equal(app.core.desktopActions.close, 1);
  app.startLevel(0);

  app.core.score = 1200;
  app.core.movesUsed = 15;
  app.core.bestCombo = 4;
  app.recordLeaderboard(3);
  let records = app.getLeaderboardRecords(LEVELS[0].id);
  assert.equal(records.length, 1);
  assert.equal(records[0].email, "first@example.com");
  assert.equal(records[0].score, 1200);
  assert.equal(app.leaderboardList.children.length, 1);

  app.core.score = 900;
  app.core.movesUsed = 10;
  app.recordLeaderboard(2);
  records = app.getLeaderboardRecords(LEVELS[0].id);
  assert.equal(records.length, 1);
  assert.equal(records[0].score, 1200);

  app.authEmail.value = "second@example.com";
  app.authPassword.value = "secret2";
  await app.handleRegister();
  app.core.score = 1500;
  app.core.movesUsed = 18;
  app.core.bestCombo = 3;
  app.recordLeaderboard(3);

  records = app.getLeaderboardRecords(LEVELS[0].id);
  assert.equal(records.length, 2);
  assert.equal(records[0].email, "second@example.com");
  assert.equal(records[1].email, "first@example.com");
  assert.equal(app.leaderboardCount.textContent, "2 人");
  assert.equal(app.leaderboardList.children.length, 2);

  const storedLeaderboard = JSON.parse(localStorage.getItem("degame-mvp-leaderboard-v1"));
  assert.equal(storedLeaderboard.length, 2);

  const mockLeaderboardRecords = [
    {
      email: "alpha@example.com",
      name: "Alpha",
      levelId: LEVELS[0].id,
      levelName: LEVELS[0].name,
      chapter: LEVELS[0].chapter,
      stars: 2,
      score: 9000,
      moves: 8,
      bestCombo: 2,
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      email: "bravo@example.com",
      name: "Bravo",
      levelId: LEVELS[0].id,
      levelName: LEVELS[0].name,
      chapter: LEVELS[0].chapter,
      stars: 3,
      score: 2200,
      moves: 18,
      bestCombo: 5,
      completedAt: "2026-01-04T00:00:00.000Z",
    },
    {
      email: "delta@example.com",
      name: "Delta",
      levelId: LEVELS[0].id,
      levelName: LEVELS[0].name,
      chapter: LEVELS[0].chapter,
      stars: 3,
      score: 2100,
      moves: 10,
      bestCombo: 4,
      completedAt: "2026-01-02T00:00:00.000Z",
    },
    {
      email: "charlie@example.com",
      name: "Charlie",
      levelId: LEVELS[0].id,
      levelName: LEVELS[0].name,
      chapter: LEVELS[0].chapter,
      stars: 3,
      score: 2100,
      moves: 10,
      bestCombo: 3,
      completedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      email: "second@example.com",
      name: "Second",
      levelId: LEVELS[0].id,
      levelName: LEVELS[0].name,
      chapter: LEVELS[0].chapter,
      stars: 3,
      score: 2100,
      moves: 12,
      bestCombo: 6,
      completedAt: "2026-01-02T12:00:00.000Z",
    },
    {
      email: "other-level@example.com",
      name: "Other",
      levelId: LEVELS[1].id,
      levelName: LEVELS[1].name,
      chapter: LEVELS[1].chapter,
      stars: 3,
      score: 9999,
      moves: 3,
      bestCombo: 8,
      completedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  localStorage.setItem("degame-mvp-leaderboard-v1", JSON.stringify(mockLeaderboardRecords));
  app.renderLeaderboard();
  records = app.getLeaderboardRecords(LEVELS[0].id);
  assert.deepEqual(records.map((record) => record.email), [
    "bravo@example.com",
    "delta@example.com",
    "charlie@example.com",
    "second@example.com",
    "alpha@example.com",
  ]);
  assert.equal(app.leaderboardCount.textContent, "5 人");
  assert.equal(app.leaderboardEmpty.classList.contains("hidden"), true);
  assert.equal(app.leaderboardList.children.length, 5);
  assert.equal(app.leaderboardList.children[0].children[0].textContent, "1");
  assert.equal(app.leaderboardList.children[0].children[1].children[0].textContent, "Bravo");
  assert.equal(app.leaderboardList.children[3].children[0].textContent, "4");
  assert.equal(app.leaderboardList.children[3].classList.contains("is-me"), true);

  app.handleLogout();
  app.authEmail.value = "new-login@example.com";
  app.authPassword.value = "secret3";
  await app.handleLogin();
  assert.equal(app.currentUser.email, "new-login@example.com");

  app.authPassword.value = "secret4";
  await app.handleRegister();
  assert.equal(app.currentUser.email, "new-login@example.com");
  app.handleLogout();
  app.authEmail.value = "new-login@example.com";
  app.authPassword.value = "secret4";
  await app.handleLogin();
  assert.equal(app.currentUser.email, "new-login@example.com");

  console.log("check-ui: auth, mock leaderboard, and desktop tools tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
