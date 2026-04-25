export const BOARD_SIZE = 8;

export const TILE_DEFS = {
  doc: {
    id: "doc",
    label: "文档",
    short: "DOC",
    color: "#f4f8ff",
    accent: "#4375d9",
  },
  screenshot: {
    id: "screenshot",
    label: "截图",
    short: "PNG",
    color: "#e7fbff",
    accent: "#2b9d8f",
  },
  folder: {
    id: "folder",
    label: "文件夹",
    short: "DIR",
    color: "#fff2d6",
    accent: "#cb8e2d",
  },
  zip: {
    id: "zip",
    label: "压缩包",
    short: "ZIP",
    color: "#efe6ff",
    accent: "#7a54bf",
  },
  shortcut: {
    id: "shortcut",
    label: "快捷方式",
    short: "APP",
    color: "#dcecff",
    accent: "#3e83d1",
  },
  temp: {
    id: "temp",
    label: "临时文件",
    short: "TMP",
    color: "#e6fff3",
    accent: "#4ea76e",
  },
};

export const DEFAULT_SETTINGS = {
  soundEnabled: true,
  autoHint: true,
  highContrast: false,
  vibration: false,
};

const BASE_TILE_TYPES = ["doc", "screenshot", "folder", "zip", "shortcut", "temp"];

export const CHAPTERS = [
  {
    id: "office",
    name: "办公桌面",
    subtitle: "把堆满的收件与截图压回秩序",
    theme: {
      cleanA: "#eff7f2",
      cleanB: "#d9efe9",
      messyA: "#f4e8d1",
      messyB: "#ead6b6",
      accent: "#127475",
      clutter: "paper",
    },
  },
  {
    id: "study",
    name: "学生书桌",
    subtitle: "把便签、复习资料和临时文件重新归位",
    theme: {
      cleanA: "#f4f3ff",
      cleanB: "#dedbff",
      messyA: "#f0e3c6",
      messyB: "#dcc5a3",
      accent: "#845ec2",
      clutter: "notes",
    },
  },
  {
    id: "creator",
    name: "创作者工作台",
    subtitle: "归档素材、清理版本、关闭导出弹窗",
    theme: {
      cleanA: "#f2f7ff",
      cleanB: "#dce8ff",
      messyA: "#ecdcbf",
      messyB: "#dcc4a2",
      accent: "#4a6bd6",
      clutter: "windows",
    },
  },
  {
    id: "night",
    name: "深夜电竞桌面",
    subtitle: "把更新、下载和残局统统清空",
    theme: {
      cleanA: "#edf4ff",
      cleanB: "#d3e4f4",
      messyA: "#e4d4bd",
      messyB: "#ceb38e",
      accent: "#1e5e9a",
      clutter: "cables",
    },
  },
];

const CHAPTER_MAP = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));

function createLevel(config) {
  const chapter = CHAPTER_MAP[config.chapterId];
  return {
    id: config.id,
    chapterId: config.chapterId,
    chapter: chapter.name,
    name: config.name,
    recommendedMoves: config.recommendedMoves,
    tileTypes: BASE_TILE_TYPES,
    goals: config.goals,
    blockers: config.blockers,
    theme: {
      ...chapter.theme,
      ...(config.themeOverrides || {}),
    },
  };
}

export const LEVELS = [
  createLevel({
    id: "office-1",
    chapterId: "office",
    name: "收件箱爆满",
    recommendedMoves: 18,
    goals: [
      { type: "collect_tile", tileType: "screenshot", target: 12 },
      { type: "clear_blocker", blockerType: "dust", target: 8 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "dust", positions: [[1, 1], [1, 2], [1, 5], [2, 3], [3, 1], [4, 6], [5, 2], [6, 5]] },
    ],
  }),
  createLevel({
    id: "office-2",
    chapterId: "office",
    name: "截图成堆",
    recommendedMoves: 19,
    goals: [
      { type: "collect_tile", tileType: "doc", target: 14 },
      { type: "clear_blocker", blockerType: "dust", target: 6 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "dust", positions: [[0, 2], [0, 5], [2, 1], [3, 4], [4, 6], [6, 2]] },
      { type: "sticky_note", positions: [[1, 6], [5, 5], [6, 4]] },
    ],
  }),
  createLevel({
    id: "office-3",
    chapterId: "office",
    name: "档案回仓",
    recommendedMoves: 20,
    goals: [
      { type: "collect_tile", tileType: "folder", target: 10 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 6 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "sticky_note", positions: [[0, 1], [1, 4], [2, 6], [4, 0], [5, 3], [6, 5]] },
      { type: "dust", positions: [[2, 2], [3, 5], [5, 6], [7, 1]] },
    ],
  }),
  createLevel({
    id: "office-4",
    chapterId: "office",
    name: "晨会前五分钟",
    recommendedMoves: 22,
    goals: [
      { type: "collect_tile", tileType: "screenshot", target: 12 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 4 },
      { type: "clear_blocker", blockerType: "dust", target: 4 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "sticky_note", positions: [[1, 1], [2, 4], [4, 2], [6, 6]] },
      { type: "dust", positions: [[0, 5], [3, 0], [5, 5], [7, 2]] },
      { type: "popup", positions: [[3, 6], [6, 3]] },
    ],
  }),

  createLevel({
    id: "study-1",
    chapterId: "study",
    name: "便签泛滥",
    recommendedMoves: 21,
    goals: [
      { type: "collect_tile", tileType: "folder", target: 13 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 7 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "sticky_note", positions: [[0, 3], [1, 4], [2, 2], [3, 5], [4, 1], [5, 6], [6, 3]] },
      { type: "dust", positions: [[2, 6], [3, 0], [5, 0], [6, 6]] },
    ],
  }),
  createLevel({
    id: "study-2",
    chapterId: "study",
    name: "资料周转",
    recommendedMoves: 22,
    goals: [
      { type: "collect_tile", tileType: "doc", target: 14 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 8 },
      { type: "clear_blocker", blockerType: "dust", target: 5 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "sticky_note", positions: [[0, 1], [1, 5], [2, 3], [3, 6], [4, 2], [5, 4], [6, 1], [7, 5]] },
      { type: "dust", positions: [[0, 6], [2, 0], [4, 7], [6, 6], [7, 2]] },
    ],
  }),
  createLevel({
    id: "study-3",
    chapterId: "study",
    name: "深夜赶作业",
    recommendedMoves: 23,
    goals: [
      { type: "collect_tile", tileType: "screenshot", target: 11 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 6 },
      { type: "clear_blocker", blockerType: "popup", target: 2 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "sticky_note", positions: [[0, 4], [1, 1], [2, 6], [4, 0], [5, 3], [6, 5]] },
      { type: "popup", positions: [[3, 2], [4, 6]] },
      { type: "dust", positions: [[2, 3], [6, 2], [7, 7]] },
    ],
  }),
  createLevel({
    id: "study-4",
    chapterId: "study",
    name: "考前总复习",
    recommendedMoves: 24,
    goals: [
      { type: "collect_tile", tileType: "folder", target: 12 },
      { type: "collect_tile", tileType: "zip", target: 8 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 6 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "sticky_note", positions: [[0, 2], [1, 6], [2, 1], [3, 4], [5, 2], [6, 6]] },
      { type: "popup", positions: [[4, 0], [4, 7]] },
      { type: "dust", positions: [[1, 3], [3, 6], [6, 0], [7, 4]] },
    ],
  }),

  createLevel({
    id: "creator-1",
    chapterId: "creator",
    name: "素材归档",
    recommendedMoves: 23,
    goals: [
      { type: "collect_tile", tileType: "zip", target: 10 },
      { type: "clear_blocker", blockerType: "popup", target: 4 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[1, 2], [2, 5], [5, 1], [6, 4]] },
      { type: "sticky_note", positions: [[0, 6], [3, 3], [4, 6], [6, 0]] },
    ],
  }),
  createLevel({
    id: "creator-2",
    chapterId: "creator",
    name: "版本失控",
    recommendedMoves: 24,
    goals: [
      { type: "collect_tile", tileType: "screenshot", target: 12 },
      { type: "clear_blocker", blockerType: "popup", target: 4 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 4 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[0, 4], [2, 2], [4, 5], [6, 3]] },
      { type: "sticky_note", positions: [[1, 6], [3, 0], [5, 2], [7, 5]] },
      { type: "dust", positions: [[2, 6], [5, 6], [6, 0]] },
    ],
  }),
  createLevel({
    id: "creator-3",
    chapterId: "creator",
    name: "导出前夜",
    recommendedMoves: 25,
    goals: [
      { type: "collect_tile", tileType: "zip", target: 10 },
      { type: "collect_tile", tileType: "folder", target: 10 },
      { type: "clear_blocker", blockerType: "popup", target: 4 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[1, 1], [2, 6], [5, 2], [6, 5]] },
      { type: "sticky_note", positions: [[0, 3], [2, 3], [4, 0], [5, 7], [7, 1]] },
      { type: "dust", positions: [[3, 5], [4, 4], [6, 7]] },
    ],
  }),
  createLevel({
    id: "creator-4",
    chapterId: "creator",
    name: "发布倒计时",
    recommendedMoves: 26,
    goals: [
      { type: "collect_tile", tileType: "shortcut", target: 12 },
      { type: "clear_blocker", blockerType: "popup", target: 5 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 5 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[0, 1], [1, 5], [3, 3], [5, 0], [6, 6]] },
      { type: "sticky_note", positions: [[0, 6], [2, 1], [4, 5], [6, 2], [7, 4]] },
      { type: "dust", positions: [[2, 7], [5, 5], [7, 0]] },
    ],
  }),

  createLevel({
    id: "night-1",
    chapterId: "night",
    name: "夜间清扫",
    recommendedMoves: 25,
    goals: [
      { type: "collect_tile", tileType: "temp", target: 14 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 5 },
      { type: "clear_blocker", blockerType: "popup", target: 3 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[0, 4], [2, 1], [6, 6]] },
      { type: "sticky_note", positions: [[1, 3], [2, 4], [4, 2], [5, 5], [7, 1]] },
      { type: "dust", positions: [[0, 0], [0, 1], [3, 7], [4, 0], [6, 2], [7, 7]] },
    ],
  }),
  createLevel({
    id: "night-2",
    chapterId: "night",
    name: "更新弹窗",
    recommendedMoves: 26,
    goals: [
      { type: "collect_tile", tileType: "temp", target: 15 },
      { type: "clear_blocker", blockerType: "dust", target: 6 },
      { type: "clear_blocker", blockerType: "popup", target: 3 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[1, 2], [3, 5], [6, 1]] },
      { type: "dust", positions: [[0, 6], [1, 6], [2, 0], [4, 4], [6, 5], [7, 3]] },
      { type: "sticky_note", positions: [[2, 3], [4, 1], [5, 6]] },
    ],
  }),
  createLevel({
    id: "night-3",
    chapterId: "night",
    name: "下载残局",
    recommendedMoves: 27,
    goals: [
      { type: "collect_tile", tileType: "screenshot", target: 12 },
      { type: "collect_tile", tileType: "shortcut", target: 12 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 5 },
      { type: "clear_blocker", blockerType: "popup", target: 4 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[0, 3], [2, 6], [5, 1], [7, 4]] },
      { type: "sticky_note", positions: [[1, 1], [3, 2], [4, 6], [6, 3], [7, 7]] },
      { type: "dust", positions: [[0, 0], [2, 0], [5, 7], [6, 6]] },
    ],
  }),
  createLevel({
    id: "night-4",
    chapterId: "night",
    name: "赛后归零",
    recommendedMoves: 28,
    goals: [
      { type: "collect_tile", tileType: "temp", target: 16 },
      { type: "clear_blocker", blockerType: "sticky_note", target: 6 },
      { type: "clear_blocker", blockerType: "popup", target: 4 },
      { type: "clear_blocker", blockerType: "dust", target: 6 },
      { type: "reach_cleanliness", target: 100 },
    ],
    blockers: [
      { type: "popup", positions: [[1, 4], [3, 1], [4, 6], [6, 3]] },
      { type: "sticky_note", positions: [[0, 2], [2, 5], [4, 2], [5, 7], [6, 0], [7, 5]] },
      { type: "dust", positions: [[0, 7], [1, 0], [2, 2], [5, 0], [6, 6], [7, 1]] },
    ],
  }),
];

export function describeGoal(goal) {
  if (goal.type === "collect_tile") {
    return `清理 ${TILE_DEFS[goal.tileType].label}`;
  }

  if (goal.type === "clear_blocker") {
    if (goal.blockerType === "dust") {
      return "擦掉灰尘";
    }
    if (goal.blockerType === "sticky_note") {
      return "撕掉便签";
    }
    return "关闭弹窗";
  }

  return "恢复整洁度";
}
