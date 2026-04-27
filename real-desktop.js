const STORAGE_KEY = "degame-real-desktop-v1";
const ICON_W = 86;
const ICON_H = 92;
const GRID_X = 26;
const GRID_Y = 24;
const GRID_GAP_X = 102;
const GRID_GAP_Y = 104;

const TYPE_META = {
  document: { label: "文档", badge: "DOC", color: "#4b74d9" },
  sheet: { label: "表格", badge: "XLS", color: "#2f9f6d" },
  image: { label: "图片", badge: "PNG", color: "#2b9d8f" },
  archive: { label: "压缩包", badge: "ZIP", color: "#7a54bf" },
  installer: { label: "安装包", badge: "EXE", color: "#c46a3a" },
  shortcut: { label: "快捷方式", badge: "APP", color: "#3e83d1" },
  temp: { label: "临时文件", badge: "TMP", color: "#9a6b2f" },
  folder: { label: "文件夹", badge: "DIR", color: "#cb8e2d" },
  trash: { label: "回收站", badge: "BIN", color: "#59636b" },
};

const PROJECTS = ["工作", "报销", "设计", "学习", "游戏", "照片"];

function cloneItems(items) {
  return items.map((item) => ({ ...item }));
}

function makeItem(id, name, type, project, x, y, extra = {}) {
  return {
    id,
    name,
    type,
    project,
    source: extra.source || "桌面",
    date: extra.date || "今天",
    size: extra.size || "1.2 MB",
    parentId: extra.parentId || "desktop",
    x,
    y,
    system: Boolean(extra.system),
    createdAt: extra.createdAt || Date.now(),
  };
}

export function createInitialDesktopItems() {
  return [
    makeItem("folder-work", "工作项目", "folder", "工作", 28, 28),
    makeItem("folder-design", "设计素材", "folder", "设计", 28, 132),
    makeItem("doc-contract", "合同终版.docx", "document", "工作", 160, 34, { source: "微信", date: "昨天", size: "284 KB" }),
    makeItem("doc-meeting", "晨会记录.docx", "document", "工作", 275, 28, { source: "桌面", size: "96 KB" }),
    makeItem("sheet-expense", "4月报销.xlsx", "sheet", "报销", 393, 44, { source: "邮箱", size: "312 KB" }),
    makeItem("shot-1", "截图 2026-04-27 0842.png", "image", "设计", 514, 24, { source: "截图", size: "1.8 MB" }),
    makeItem("shot-2", "截图 2026-04-27 0842 副本.png", "image", "设计", 632, 48, { source: "截图", size: "1.8 MB" }),
    makeItem("zip-source", "landing素材.zip", "archive", "设计", 172, 160, { source: "下载", date: "今天", size: "46 MB" }),
    makeItem("installer", "setup_1.4.8.exe", "installer", "游戏", 304, 156, { source: "下载", date: "上周", size: "128 MB" }),
    makeItem("tmp-log", "crash-20260427.tmp", "temp", "游戏", 430, 152, { source: "缓存", date: "今天", size: "2 KB" }),
    makeItem("shortcut-game", "启动器快捷方式", "shortcut", "游戏", 552, 168, { source: "安装器", size: "4 KB" }),
    makeItem("study-pdf", "复习资料.pdf", "document", "学习", 650, 178, { source: "下载", size: "6 MB" }),
    makeItem("photo-raw", "IMG_4201.jpg", "image", "照片", 42, 284, { source: "相机", date: "昨天", size: "5.4 MB" }),
    makeItem("photo-copy", "IMG_4201 副本.jpg", "image", "照片", 172, 300, { source: "相机", date: "昨天", size: "5.4 MB" }),
    makeItem("old-zip", "旧版本备份.zip", "archive", "工作", 314, 292, { source: "桌面", date: "上月", size: "88 MB" }),
    makeItem("trash", "回收站", "trash", "系统", 44, 502, { system: true }),
  ];
}

export function computeDesktopStats(items) {
  const active = items.filter((item) => item.parentId !== "trash" && item.type !== "trash");
  const loose = active.filter((item) => item.parentId === "desktop" && item.type !== "folder");
  const folders = active.filter((item) => item.type === "folder");
  const trash = items.filter((item) => item.parentId === "trash");
  const junk = active.filter((item) => item.type === "temp" || item.type === "installer" || /副本|旧版本/i.test(item.name));
  const cleanScore = Math.max(0, Math.min(100, Math.round(100 - loose.length * 6 - junk.length * 7 + folders.length * 2)));
  return { active: active.length, loose: loose.length, folders: folders.length, trash: trash.length, junk: junk.length, cleanScore };
}

export function sortDesktopByType(items, surfaceWidth = 760) {
  const sorted = cloneItems(items);
  const visible = sorted
    .filter((item) => item.parentId === "desktop" && !item.system)
    .sort((a, b) => `${a.type}-${a.name}`.localeCompare(`${b.type}-${b.name}`, "zh-CN"));
  const cols = Math.max(1, Math.floor((surfaceWidth - GRID_X) / GRID_GAP_X));
  visible.forEach((item, index) => {
    item.x = GRID_X + (index % cols) * GRID_GAP_X;
    item.y = GRID_Y + Math.floor(index / cols) * GRID_GAP_Y;
  });
  return sorted;
}

export function moveDownloadsToTrash(items) {
  const next = cloneItems(items);
  next.forEach((item) => {
    if (item.system || item.type === "folder" || item.type === "trash") {
      return;
    }
    if (item.type === "temp" || item.type === "installer" || /副本|旧版本|crash|setup/i.test(item.name)) {
      item.parentId = "trash";
    }
  });
  return next;
}

export function groupByProject(items) {
  const next = cloneItems(items);
  PROJECTS.forEach((project, index) => {
    let folder = next.find((item) => item.type === "folder" && item.project === project && item.parentId === "desktop");
    if (!folder) {
      folder = makeItem(`folder-${project}`, `${project}文件`, "folder", project, GRID_X + index * GRID_GAP_X, 28);
      next.push(folder);
    }
    next.forEach((item) => {
      if (!item.system && item.type !== "folder" && item.type !== "trash" && item.parentId === "desktop" && item.project === project) {
        item.parentId = folder.id;
      }
    });
  });
  return sortDesktopByType(next);
}

class RealDesktopOrganizer {
  constructor(root) {
    this.root = root;
    this.surface = document.getElementById("desktopSurface");
    this.feedbackLayer = document.getElementById("desktopFeedbackLayer");
    this.selectionBox = document.getElementById("selectionBox");
    this.folderWindow = document.getElementById("folderWindow");
    this.folderWindowTitle = document.getElementById("folderWindowTitle");
    this.folderWindowBody = document.getElementById("folderWindowBody");
    this.selectionSummary = document.getElementById("selectionSummary");
    this.desktopCleanScore = document.getElementById("desktopCleanScore");
    this.desktopCleanFill = document.getElementById("desktopCleanFill");
    this.desktopStats = document.getElementById("desktopStats");
    this.desktopScore = document.getElementById("desktopScore");
    this.desktopCombo = document.getElementById("desktopCombo");
    this.activityList = document.getElementById("desktopActivityList");
    this.desktopPathText = document.getElementById("desktopPathText");
    this.desktopClockText = document.getElementById("desktopClockText");
    this.selectedIds = new Set();
    this.drag = null;
    this.selectionDrag = null;
    this.openFolderId = null;
    this.activities = [];
    this.score = 0;
    this.combo = 0;
    this.lastComboAt = 0;
    this.items = this.loadItems();
    this.bindEvents();
    this.render();
    this.updateClock();
    window.setInterval(() => this.updateClock(), 30000);
  }

  loadItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(parsed) ? parsed : createInitialDesktopItems();
    } catch {
      return createInitialDesktopItems();
    }
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
  }

  bindEvents() {
    document.getElementById("newFolderButton").addEventListener("click", () => this.createFolder());
    document.getElementById("sortTypeButton").addEventListener("click", () => this.applySort());
    document.getElementById("groupProjectButton").addEventListener("click", () => this.applyProjectGrouping());
    document.getElementById("cleanDownloadsButton").addEventListener("click", () => this.cleanDownloads());
    document.getElementById("restoreTrashButton").addEventListener("click", () => this.restoreTrash());
    document.getElementById("resetDesktopButton").addEventListener("click", () => this.resetDesktop());
    document.getElementById("openSelectedButton").addEventListener("click", () => this.openSelected());
    document.getElementById("renameSelectedButton").addEventListener("click", () => this.renameSelected());
    document.getElementById("moveToFolderButton").addEventListener("click", () => this.moveSelectedToFolder());
    document.getElementById("moveToTrashButton").addEventListener("click", () => this.moveSelectedToTrash());
    document.getElementById("closeFolderWindow").addEventListener("click", () => this.closeFolder());

    this.surface.addEventListener("pointerdown", (event) => this.handleSurfacePointerDown(event));
    window.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    window.addEventListener("pointerup", (event) => this.handlePointerUp(event));
    this.surface.addEventListener("dblclick", (event) => {
      const icon = event.target.closest(".desktop-icon");
      if (icon) {
        this.openItem(icon.dataset.id);
      }
    });
  }

  updateClock() {
    this.desktopClockText.textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  visibleDesktopItems() {
    return this.items.filter((item) => item.parentId === "desktop");
  }

  selectedItems() {
    return this.items.filter((item) => this.selectedIds.has(item.id));
  }

  handleSurfacePointerDown(event) {
    const icon = event.target.closest(".desktop-icon");
    if (icon) {
      const id = icon.dataset.id;
      const item = this.items.find((entry) => entry.id === id);
      if (!event.ctrlKey && !event.metaKey && !this.selectedIds.has(id)) {
        this.selectedIds.clear();
      }
      if (event.ctrlKey || event.metaKey) {
        if (this.selectedIds.has(id)) {
          this.selectedIds.delete(id);
        } else {
          this.selectedIds.add(id);
        }
      } else {
        this.selectedIds.add(id);
      }
      if (!item.system) {
        const rect = this.surface.getBoundingClientRect();
        const selected = this.selectedItems().filter((entry) => !entry.system && entry.parentId === "desktop");
        this.drag = {
          startX: event.clientX,
          startY: event.clientY,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          items: selected.map((entry) => ({ id: entry.id, x: entry.x, y: entry.y })),
        };
        event.preventDefault();
      }
      this.render();
      return;
    }

    const rect = this.surface.getBoundingClientRect();
    this.selectedIds.clear();
    this.selectionDrag = {
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      currentX: event.clientX - rect.left,
      currentY: event.clientY - rect.top,
    };
    this.renderSelectionBox();
    this.render();
  }

  handlePointerMove(event) {
    if (this.drag) {
      const dx = event.clientX - this.drag.startX;
      const dy = event.clientY - this.drag.startY;
      this.drag.items.forEach((entry) => {
        const item = this.items.find((candidate) => candidate.id === entry.id);
        if (item) {
          item.x = Math.max(8, Math.min(this.surface.clientWidth - ICON_W - 8, entry.x + dx));
          item.y = Math.max(8, Math.min(this.surface.clientHeight - ICON_H - 8, entry.y + dy));
        }
      });
      this.renderIconsOnly();
      return;
    }

    if (this.selectionDrag) {
      const rect = this.surface.getBoundingClientRect();
      this.selectionDrag.currentX = event.clientX - rect.left;
      this.selectionDrag.currentY = event.clientY - rect.top;
      this.updateSelectionFromBox();
      this.renderSelectionBox();
      this.renderIconsOnly();
    }
  }

  handlePointerUp(event) {
    if (this.drag) {
      this.dropSelectedAt(event.clientX, event.clientY);
      this.drag = null;
      this.persist();
      this.render();
    }
    if (this.selectionDrag) {
      this.selectionDrag = null;
      this.selectionBox.classList.add("hidden");
      this.render();
    }
  }

  renderSelectionBox() {
    const box = this.getSelectionRect();
    this.selectionBox.classList.remove("hidden");
    this.selectionBox.style.left = `${box.left}px`;
    this.selectionBox.style.top = `${box.top + 44}px`;
    this.selectionBox.style.width = `${box.width}px`;
    this.selectionBox.style.height = `${box.height}px`;
  }

  getSelectionRect() {
    const drag = this.selectionDrag;
    const left = Math.min(drag.startX, drag.currentX);
    const top = Math.min(drag.startY, drag.currentY);
    return {
      left,
      top,
      width: Math.abs(drag.currentX - drag.startX),
      height: Math.abs(drag.currentY - drag.startY),
      right: Math.max(drag.startX, drag.currentX),
      bottom: Math.max(drag.startY, drag.currentY),
    };
  }

  updateSelectionFromBox() {
    const box = this.getSelectionRect();
    this.selectedIds.clear();
    this.visibleDesktopItems().forEach((item) => {
      if (item.system) {
        return;
      }
      const hit = item.x < box.right && item.x + ICON_W > box.left && item.y < box.bottom && item.y + ICON_H > box.top;
      if (hit) {
        this.selectedIds.add(item.id);
      }
    });
  }

  dropSelectedAt(clientX, clientY) {
    const rect = this.surface.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const targetItem = this.visibleDesktopItems().find((item) => {
      if (this.selectedIds.has(item.id) || (item.type !== "folder" && item.type !== "trash")) {
        return false;
      }
      return x >= item.x && x <= item.x + ICON_W && y >= item.y && y <= item.y + ICON_H;
    });
    if (!targetItem || this.selectedIds.has(targetItem.id)) {
      return;
    }

    if (targetItem.type === "folder") {
      this.moveSelected(targetItem.id, `移入 ${targetItem.name}`);
    } else if (targetItem.type === "trash") {
      this.moveSelected("trash", "移入回收站");
    }
  }

  moveSelected(parentId, label) {
    const moved = this.selectedItems().filter((item) => !item.system && item.type !== "folder");
    moved.forEach((item) => {
      item.parentId = parentId;
    });
    if (moved.length) {
      this.addActivity(`${label}：${moved.length} 个文件`);
      this.selectedIds.clear();
      this.persist();
    }
  }

  createFolder() {
    const count = this.items.filter((item) => item.type === "folder").length + 1;
    this.items.push(makeItem(`folder-custom-${Date.now()}`, `新建文件夹 ${count}`, "folder", "工作", 54 + count * 24, 52 + count * 24));
    this.addActivity("新建文件夹");
    this.persist();
    this.render();
  }

  applySort() {
    this.items = sortDesktopByType(this.items, this.surface.clientWidth || 760);
    this.addActivity("按类型重新排列桌面图标");
    this.persist();
    this.render();
  }

  applyProjectGrouping() {
    this.items = groupByProject(this.items);
    this.selectedIds.clear();
    this.addActivity("按项目自动归档到文件夹");
    this.persist();
    this.render();
  }

  cleanDownloads() {
    this.items = moveDownloadsToTrash(this.items);
    this.selectedIds.clear();
    this.addActivity("清理安装包、临时文件和重复副本");
    this.persist();
    this.render();
  }

  restoreTrash() {
    const restored = this.items.filter((item) => item.parentId === "trash");
    restored.forEach((item, index) => {
      item.parentId = "desktop";
      item.x = 36 + (index % 5) * GRID_GAP_X;
      item.y = 360 + Math.floor(index / 5) * GRID_GAP_Y;
    });
    this.addActivity(`从回收站恢复 ${restored.length} 个文件`);
    this.persist();
    this.render();
  }

  resetDesktop() {
    this.items = createInitialDesktopItems();
    this.selectedIds.clear();
    this.openFolderId = null;
    localStorage.removeItem(STORAGE_KEY);
    this.addActivity("桌面已重置为混乱状态");
    this.render();
  }

  openSelected() {
    const [item] = this.selectedItems();
    if (item) {
      this.openItem(item.id);
    }
  }

  openItem(id) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    if (item.type === "folder") {
      this.openFolderId = item.id;
      this.renderFolderWindow();
      return;
    }
    if (item.type === "trash") {
      this.openFolderId = "trash";
      this.renderFolderWindow("回收站");
      return;
    }
    this.addActivity(`查看文件：${item.name}`);
  }

  closeFolder() {
    this.openFolderId = null;
    this.folderWindow.classList.add("hidden");
  }

  renderFolderWindow(titleOverride = null) {
    const folder = this.items.find((item) => item.id === this.openFolderId);
    const title = titleOverride || folder?.name || "文件夹";
    const children = this.items.filter((item) => item.parentId === this.openFolderId);
    this.folderWindowTitle.textContent = `${title} · ${children.length} 项`;
    this.folderWindowBody.innerHTML = "";
    if (!children.length) {
      const empty = document.createElement("div");
      empty.className = "folder-empty";
      empty.textContent = "这里是空的";
      this.folderWindowBody.appendChild(empty);
    }
    children.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "folder-row";
      row.innerHTML = `<span class="folder-row-badge">${TYPE_META[item.type].badge}</span><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.project)} · ${escapeHtml(item.size)}</small>`;
      row.addEventListener("click", () => {
        this.selectedIds.clear();
        this.selectedIds.add(item.id);
        this.render();
      });
      this.folderWindowBody.appendChild(row);
    });
    this.folderWindow.classList.remove("hidden");
  }

  renameSelected() {
    const [item] = this.selectedItems();
    if (!item || item.system) {
      return;
    }
    const nextName = window.prompt("重命名", item.name);
    if (!nextName?.trim()) {
      return;
    }
    item.name = nextName.trim();
    this.addActivity(`重命名为：${item.name}`);
    this.persist();
    this.render();
  }

  moveSelectedToFolder() {
    const folders = this.items.filter((item) => item.type === "folder" && item.parentId === "desktop");
    const folder = folders[0] || null;
    if (!folder) {
      this.createFolder();
      return;
    }
    this.moveSelected(folder.id, `移入 ${folder.name}`);
    this.render();
  }

  moveSelectedToTrash() {
    this.moveSelected("trash", "移入回收站");
    this.render();
  }

  addActivity(text) {
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    this.activities.unshift({ time, text });
    this.activities = this.activities.slice(0, 8);
  }

  render() {
    this.renderIcons();
    this.renderInspector();
    if (this.openFolderId) {
      this.renderFolderWindow(this.openFolderId === "trash" ? "回收站" : null);
    }
    this.persist();
  }

  renderIconsOnly() {
    this.surface.querySelectorAll(".desktop-icon").forEach((node) => {
      const item = this.items.find((entry) => entry.id === node.dataset.id);
      if (item) {
        node.style.left = `${item.x}px`;
        node.style.top = `${item.y}px`;
        node.classList.toggle("is-selected", this.selectedIds.has(item.id));
      }
    });
    this.renderInspector();
  }

  renderIcons() {
    this.surface.innerHTML = "";
    this.visibleDesktopItems().forEach((item) => {
      const meta = TYPE_META[item.type];
      const icon = document.createElement("button");
      icon.type = "button";
      icon.className = `desktop-icon desktop-icon-${item.type}`;
      icon.dataset.id = item.id;
      icon.style.left = `${item.x}px`;
      icon.style.top = `${item.y}px`;
      icon.style.setProperty("--icon-color", meta.color);
      icon.classList.toggle("is-selected", this.selectedIds.has(item.id));
      icon.innerHTML = `
        <span class="desktop-icon-art"><span>${meta.badge}</span></span>
        <span class="desktop-icon-name">${escapeHtml(item.name)}</span>
        ${item.system ? "" : `<span class="desktop-icon-meta">${escapeHtml(item.project)}</span>`}
      `;
      this.surface.appendChild(icon);
    });
  }

  renderInspector() {
    const selected = this.selectedItems();
    if (!selected.length) {
      this.selectionSummary.textContent = "未选中任何文件";
    } else if (selected.length === 1) {
      const item = selected[0];
      this.selectionSummary.innerHTML = `
        <strong>${escapeHtml(item.name)}</strong>
        <span>${TYPE_META[item.type].label} · ${escapeHtml(item.project)} · ${escapeHtml(item.source)}</span>
        <span>${escapeHtml(item.date)} · ${escapeHtml(item.size)}</span>
      `;
    } else {
      this.selectionSummary.innerHTML = `<strong>已选中 ${selected.length} 项</strong><span>可拖入文件夹或回收站</span>`;
    }

    const stats = computeDesktopStats(this.items);
    this.desktopCleanScore.textContent = `${stats.cleanScore}%`;
    this.desktopCleanFill.style.width = `${stats.cleanScore}%`;
    this.desktopStats.innerHTML = `
      <div><strong>${stats.loose}</strong><span>桌面散落</span></div>
      <div><strong>${stats.folders}</strong><span>文件夹</span></div>
      <div><strong>${stats.trash}</strong><span>回收站</span></div>
      <div><strong>${stats.junk}</strong><span>可清理</span></div>
    `;
    this.desktopPathText.textContent = this.openFolderId ? "桌面 / 文件夹" : "桌面";

    this.activityList.innerHTML = "";
    this.activities.forEach((activity) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${activity.time}</span>${escapeHtml(activity.text)}`;
      this.activityList.appendChild(item);
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("realDesktopApp");
    if (root) {
      new RealDesktopOrganizer(root);
    }
  });
}
