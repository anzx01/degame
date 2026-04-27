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

  console.log("check-ui: auth and leaderboard tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
