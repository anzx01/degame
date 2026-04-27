import assert from "node:assert/strict";
import {
  computeDesktopStats,
  createInitialDesktopItems,
  groupByProject,
  moveDownloadsToTrash,
  sortDesktopByType,
} from "./real-desktop.js";

const initial = createInitialDesktopItems();
const initialStats = computeDesktopStats(initial);
assert.ok(initialStats.loose > 8, "初始桌面应该有大量散落文件");
assert.ok(initialStats.junk >= 3, "初始桌面应该包含可清理残留");

const sorted = sortDesktopByType(initial, 760);
const firstByPosition = sorted
  .filter((item) => item.parentId === "desktop" && !item.system)
  .sort((a, b) => a.y - b.y || a.x - b.x)[0];
assert.equal(firstByPosition.type, "archive", "按类型排列后 archive 应排在最前方网格");

const trashed = moveDownloadsToTrash(initial);
const trashStats = computeDesktopStats(trashed);
assert.ok(trashStats.trash >= 4, "清理下载残留应把安装包、临时文件、副本等移入回收站");
assert.ok(trashStats.cleanScore > initialStats.cleanScore, "清理残留应提升整洁度");

const grouped = groupByProject(initial);
const groupedStats = computeDesktopStats(grouped);
assert.ok(groupedStats.loose < initialStats.loose, "按项目归档应减少桌面散落文件");
assert.ok(grouped.some((item) => item.type === "folder" && item.project === "照片"), "按项目归档应创建缺失的项目文件夹");
assert.ok(grouped.some((item) => item.parentId !== "desktop" && item.project === "设计"), "设计项目文件应进入项目文件夹");

console.log("check-real-desktop: desktop organization tests passed");
