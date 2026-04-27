import { BOARD_SIZE } from "./levels.js";

export function createCell() {
  return { tileType: null, special: null, blocker: null, meta: null };
}

export function cloneCell(cell) {
  return {
    tileType: cell.tileType,
    special: cell.special,
    blocker: cell.blocker ? { ...cell.blocker } : null,
    meta: cell.meta ? { ...cell.meta } : null,
  };
}

export function copyBoard(board) {
  return board.map((row) => row.map(cloneCell));
}

export function cellKey(row, col) {
  return `${row},${col}`;
}

export function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function isPopupBlocker(cell) {
  return Boolean(cell.blocker && cell.blocker.type === "popup");
}

function copyPayload(cell) {
  return {
    tileType: cell.tileType,
    special: cell.special,
    meta: cell.meta ? { ...cell.meta } : null,
  };
}

export class CleanupCore {
  constructor(level, options = {}) {
    this.level = level;
    this.random = options.random || Math.random;
    this.reset(level);
  }

  reset(level = this.level) {
    this.level = level;
    this.board = this.generateBoard();
    this.score = 0;
    this.movesUsed = 0;
    this.bestCombo = 0;
    this.cleanliness = 0;
    this.completed = false;
    this.goalsProgress = this.createGoalProgress(level);
    this.desktopActions = {
      archive: 0,
      trash: 0,
      close: 0,
      pin: 0,
      search: 0,
    };
  }

  createGoalProgress(level) {
    const progress = {};
    level.goals.forEach((goal, index) => {
      progress[this.goalKey(goal, index)] = 0;
    });
    return progress;
  }

  goalKey(goal, index) {
    return `${index}-${goal.type}-${goal.tileType || goal.blockerType || goal.project || goal.state || goal.action || goal.target}`;
  }

  getGoalCurrent(goal, index) {
    if (goal.type === "reach_cleanliness") {
      return this.cleanliness;
    }
    return this.goalsProgress[this.goalKey(goal, index)];
  }

  captureGoalSnapshot() {
    const snapshot = {};
    this.level.goals.forEach((goal, index) => {
      snapshot[this.goalKey(goal, index)] = this.getGoalCurrent(goal, index);
    });
    return snapshot;
  }

  getStateSnapshot() {
    return {
      score: this.score,
      movesUsed: this.movesUsed,
      bestCombo: this.bestCombo,
      cleanliness: this.cleanliness,
      goals: this.captureGoalSnapshot(),
      completed: this.completed,
    };
  }

  randomIndex(length) {
    return Math.floor(this.random() * length);
  }

  randomTileType() {
    return this.level.tileTypes[this.randomIndex(this.level.tileTypes.length)];
  }

  randomFrom(values, fallback) {
    return values?.length ? values[this.randomIndex(values.length)] : fallback;
  }

  randomTileMeta(tileType) {
    const profile = this.level.desktopProfile || {};
    const project = this.randomFrom(profile.projects, "项目");
    const source = tileType === "temp"
      ? "下载区"
      : this.randomFrom(profile.sources, "桌面");
    const state = tileType === "temp"
      ? this.randomFrom(["temp", "old", "duplicate"], "temp")
      : this.randomFrom(profile.stateWeights, "normal");
    const zone = tileType === "temp" || state === "duplicate"
      ? "回收站"
      : this.randomFrom(profile.zones, "项目文件夹");

    return {
      project,
      source,
      state,
      zone,
      createdAt: this.randomFrom(["今天", "昨天", "上周"], "今天"),
    };
  }

  setTile(cell, tileType, special = null, meta = null) {
    cell.tileType = tileType;
    cell.special = special;
    cell.meta = meta ? { ...meta } : this.randomTileMeta(tileType);
  }

  clearTile(cell) {
    cell.tileType = null;
    cell.special = null;
    cell.meta = null;
  }

  createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => createCell())
    );
  }

  applyBlockers(board) {
    this.level.blockers.forEach((group) => {
      group.positions.forEach(([row, col]) => {
        if (group.type === "popup") {
          board[row][col].blocker = { type: "popup", hp: 2 };
          board[row][col].tileType = null;
          board[row][col].special = null;
        } else if (group.type === "sticky_note") {
          board[row][col].blocker = { type: "sticky_note", hp: 1 };
        } else {
          board[row][col].blocker = { type: "dust", hp: 1 };
        }
      });
    });
  }

  generateBoard() {
    let board = null;

    for (let attempt = 0; attempt < 240; attempt += 1) {
      board = this.createEmptyBoard();
      this.applyBlockers(board);
      this.fillBoardRandomly(board);
      if (!this.findMatches(board).length && this.findPossibleMove(board)) {
        return board;
      }
    }

    return board;
  }

  fillBoardRandomly(board) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = board[row][col];
        if (isPopupBlocker(cell)) {
          continue;
        }

        const options = this.level.tileTypes.filter((tileType) => !this.causesMatch(board, row, col, tileType));
        this.setTile(cell, options.length ? options[this.randomIndex(options.length)] : this.randomTileType());
      }
    }
  }

  causesMatch(board, row, col, tileType) {
    if (
      col >= 2 &&
      board[row][col - 1].tileType === tileType &&
      board[row][col - 2].tileType === tileType
    ) {
      return true;
    }

    if (
      row >= 2 &&
      board[row - 1][col].tileType === tileType &&
      board[row - 2][col].tileType === tileType
    ) {
      return true;
    }

    return false;
  }

  isInteractable(row, col, board = this.board) {
    const cell = board[row][col];
    return Boolean(cell && cell.tileType);
  }

  swapPayloads(board, a, b) {
    const payload = copyPayload(board[a.row][a.col]);
    board[a.row][a.col].tileType = board[b.row][b.col].tileType;
    board[a.row][a.col].special = board[b.row][b.col].special;
    board[a.row][a.col].meta = board[b.row][b.col].meta ? { ...board[b.row][b.col].meta } : null;
    board[b.row][b.col].tileType = payload.tileType;
    board[b.row][b.col].special = payload.special;
    board[b.row][b.col].meta = payload.meta ? { ...payload.meta } : null;
  }

  performSwap(a, b) {
    const startBoard = copyBoard(this.board);
    if (!areAdjacent(a, b) || !this.isInteractable(a.row, a.col) || !this.isInteractable(b.row, b.col)) {
      return { valid: false, reason: "invalid_target", startBoard };
    }

    this.swapPayloads(this.board, a, b);
    const swapBoard = copyBoard(this.board);
    const initialMatches = this.findMatches(this.board);

    if (!initialMatches.length) {
      this.swapPayloads(this.board, a, b);
      return {
        valid: false,
        reason: "no_match",
        startBoard,
      };
    }

    this.movesUsed += 1;
    const cascades = [];
    let combo = 0;
    let lastSwap = { a: { ...a }, b: { ...b } };

    while (true) {
      const matches = this.findMatches(this.board);
      if (!matches.length) {
        break;
      }

      combo += 1;
      this.bestCombo = Math.max(this.bestCombo, combo);
      const cascadeStartBoard = copyBoard(this.board);
      const resolution = this.buildResolution(matches, lastSwap);
      const cascade = this.applyResolution(resolution, combo, cascadeStartBoard);
      const dropData = this.collapseAndRefill();
      cascade.drops = dropData.drops;
      cascade.endBoard = copyBoard(this.board);
      cascades.push(cascade);
      lastSwap = null;
    }

    const completed = this.checkCompletion();

    return {
      valid: true,
      startBoard,
      swapBoard,
      cascades,
      completed,
      stars: completed ? this.computeStars() : 0,
      snapshot: this.getStateSnapshot(),
    };
  }

  applyResolution(resolution, combo, startBoard) {
    const clearSet = new Set(resolution.clearCells.map((cell) => cellKey(cell.row, cell.col)));
    const blockerEvents = [];
    const blockersRemoved = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = this.board[row][col];
        if (!cell.blocker) {
          continue;
        }

        const key = cellKey(row, col);
        const hitDirect = clearSet.has(key);
        const hitNearby = this.hasAdjacentClear(row, col, clearSet);

        if (cell.blocker.type === "dust") {
          if (hitDirect || hitNearby) {
            blockerEvents.push({
              type: "dust",
              row,
              col,
              hpBefore: 1,
              hpAfter: 0,
              removed: true,
            });
            blockersRemoved.push({ type: "dust", row, col });
            cell.blocker = null;
          }
        } else if (cell.blocker.type === "sticky_note") {
          if (hitDirect) {
            blockerEvents.push({
              type: "sticky_note",
              row,
              col,
              hpBefore: 1,
              hpAfter: 0,
              removed: true,
            });
            blockersRemoved.push({ type: "sticky_note", row, col });
            cell.blocker = null;
          }
        } else if (cell.blocker.type === "popup") {
          if (hitDirect || hitNearby) {
            const hpBefore = cell.blocker.hp;
            cell.blocker.hp = Math.max(0, hpBefore - 1);
            const removed = cell.blocker.hp === 0;
            blockerEvents.push({
              type: "popup",
              row,
              col,
              hpBefore,
              hpAfter: cell.blocker.hp,
              removed,
            });
            if (removed) {
              blockersRemoved.push({ type: "popup", row, col });
              cell.blocker = null;
            }
          }
        }
      }
    }

    const clearedTiles = [];
    resolution.clearCells.forEach((cellPos) => {
      const cell = this.board[cellPos.row][cellPos.col];
      if (!cell.tileType) {
        return;
      }

      clearedTiles.push({
        row: cellPos.row,
        col: cellPos.col,
        tileType: cell.tileType,
        special: cell.special,
        meta: cell.meta ? { ...cell.meta } : null,
      });
      this.clearTile(cell);
    });

    resolution.spawns.forEach((spawn) => {
      const cell = this.board[spawn.row][spawn.col];
      this.setTile(cell, spawn.tileType, spawn.special, spawn.meta);
    });

    const scoreGain =
      clearedTiles.length * 110 +
      blockersRemoved.length * 170 +
      resolution.spawns.length * 90 +
      combo * 70;
    const cleanlinessGain = Math.min(
      100 - this.cleanliness,
      clearedTiles.length * 3 + blockersRemoved.length * 9 + resolution.spawns.length * 4 + Math.max(0, combo - 1) * 6
    );

    this.score += scoreGain;
    this.cleanliness = Math.max(0, Math.min(100, this.cleanliness + cleanlinessGain));
    this.updateGoalProgress(clearedTiles, blockersRemoved);

    return {
      combo,
      clearCells: resolution.clearCells.map((cell) => ({ ...cell })),
      clearedTiles,
      blockerEvents,
      blockersRemoved,
      specialSpawns: resolution.spawns.map((spawn) => ({ ...spawn })),
      effectBursts: resolution.effectBursts.map((effect) => ({ ...effect })),
      startBoard,
      afterClearBoard: copyBoard(this.board),
      scoreGain,
      scoreAfter: this.score,
      cleanlinessGain,
      cleanlinessAfter: this.cleanliness,
      goalsAfter: this.captureGoalSnapshot(),
      bestComboAfter: this.bestCombo,
      movesUsedAfter: this.movesUsed,
    };
  }

  updateGoalProgress(clearedTiles, blockersRemoved, actionType = null) {
    this.level.goals.forEach((goal, index) => {
      const key = this.goalKey(goal, index);
      if (goal.type === "collect_tile") {
        const count = clearedTiles.filter((tile) => tile.tileType === goal.tileType).length;
        this.goalsProgress[key] += count;
      } else if (goal.type === "collect_project") {
        const count = clearedTiles.filter((tile) => tile.meta?.project === goal.project).length;
        this.goalsProgress[key] += count;
      } else if (goal.type === "collect_state") {
        const count = clearedTiles.filter((tile) => tile.meta?.state === goal.state).length;
        this.goalsProgress[key] += count;
      } else if (goal.type === "clear_blocker") {
        const count = blockersRemoved.filter((item) => item.type === goal.blockerType).length;
        this.goalsProgress[key] += count;
      } else if (goal.type === "use_desktop_action" && actionType === goal.action) {
        this.goalsProgress[key] += 1;
      } else if (goal.type === "reach_cleanliness") {
        this.goalsProgress[key] = this.cleanliness;
      }
    });
  }

  hasAdjacentClear(row, col, clearSet) {
    const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return offsets.some(([dr, dc]) => clearSet.has(cellKey(row + dr, col + dc)));
  }

  collapseAndRefill() {
    const drops = [];

    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const movableRows = [];
      const survivors = [];

      for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
        const cell = this.board[row][col];
        if (isPopupBlocker(cell)) {
          continue;
        }
        movableRows.push(row);
        if (cell.tileType) {
          survivors.push({
            tileType: cell.tileType,
            special: cell.special,
            meta: cell.meta ? { ...cell.meta } : null,
            fromRow: row,
          });
        }
      }

      let survivorIndex = 0;
      let spawnCount = 0;

      for (let index = 0; index < movableRows.length; index += 1) {
        const row = movableRows[index];
        const cell = this.board[row][col];
        const survivor = survivors[survivorIndex];

        if (survivor) {
          this.setTile(cell, survivor.tileType, survivor.special, survivor.meta);
          if (survivor.fromRow !== row) {
            drops.push({
              from: { row: survivor.fromRow, col },
              to: { row, col },
              tileType: survivor.tileType,
              special: survivor.special,
              meta: survivor.meta ? { ...survivor.meta } : null,
              isNew: false,
            });
          }
          survivorIndex += 1;
        } else {
          spawnCount += 1;
          const tileType = this.randomTileType();
          this.setTile(cell, tileType);
          drops.push({
            from: { row: -spawnCount, col },
            to: { row, col },
            tileType,
            special: null,
            meta: cell.meta ? { ...cell.meta } : null,
            isNew: true,
          });
        }
      }
    }

    return { drops };
  }

  findMatches(board = this.board) {
    const groups = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      let col = 0;
      while (col < BOARD_SIZE) {
        const tileType = board[row][col].tileType;
        if (!tileType) {
          col += 1;
          continue;
        }

        let end = col + 1;
        while (end < BOARD_SIZE && board[row][end].tileType === tileType) {
          end += 1;
        }

        if (end - col >= 3) {
          groups.push({
            axis: "row",
            tileType,
            cells: Array.from({ length: end - col }, (_, index) => ({ row, col: col + index })),
          });
        }

        col = end;
      }
    }

    for (let col = 0; col < BOARD_SIZE; col += 1) {
      let row = 0;
      while (row < BOARD_SIZE) {
        const tileType = board[row][col].tileType;
        if (!tileType) {
          row += 1;
          continue;
        }

        let end = row + 1;
        while (end < BOARD_SIZE && board[end][col].tileType === tileType) {
          end += 1;
        }

        if (end - row >= 3) {
          groups.push({
            axis: "col",
            tileType,
            cells: Array.from({ length: end - row }, (_, index) => ({ row: row + index, col })),
          });
        }

        row = end;
      }
    }

    if (!groups.length) {
      return [];
    }

    const groupCellMap = new Map();
    groups.forEach((group, groupIndex) => {
      group.cells.forEach((cell) => {
        const key = cellKey(cell.row, cell.col);
        const refs = groupCellMap.get(key) || [];
        refs.push(groupIndex);
        groupCellMap.set(key, refs);
      });
    });

    const visited = new Set();
    const components = [];

    groups.forEach((group, groupIndex) => {
      if (visited.has(groupIndex)) {
        return;
      }

      const queue = [groupIndex];
      const mergedCells = new Map();
      visited.add(groupIndex);

      while (queue.length) {
        const currentIndex = queue.shift();
        const currentGroup = groups[currentIndex];

        currentGroup.cells.forEach((cell) => {
          const key = cellKey(cell.row, cell.col);
          mergedCells.set(key, { row: cell.row, col: cell.col });
          const linkedGroups = groupCellMap.get(key) || [];
          linkedGroups.forEach((linkedIndex) => {
            if (!visited.has(linkedIndex) && groups[linkedIndex].tileType === currentGroup.tileType) {
              visited.add(linkedIndex);
              queue.push(linkedIndex);
            }
          });
        });
      }

      const cells = Array.from(mergedCells.values());
      const rowCounts = {};
      const colCounts = {};
      cells.forEach((cell) => {
        rowCounts[cell.row] = (rowCounts[cell.row] || 0) + 1;
        colCounts[cell.col] = (colCounts[cell.col] || 0) + 1;
      });

      const maxRowCount = Math.max(...Object.values(rowCounts));
      const maxColCount = Math.max(...Object.values(colCounts));
      let specialType = null;

      if (maxRowCount >= 5 || maxColCount >= 5) {
        specialType = "color";
      } else if (cells.length >= 5 && maxRowCount >= 3 && maxColCount >= 3) {
        specialType = "bomb";
      } else if (maxRowCount === 4) {
        specialType = "row";
      } else if (maxColCount === 4) {
        specialType = "col";
      }

      components.push({
        tileType: group.tileType,
        cells,
        specialType,
      });
    });

    return components;
  }

  buildResolution(matches, lastSwap) {
    const clearSet = new Map();
    const spawns = [];
    const effectBursts = [];

    matches.forEach((match) => {
      match.cells.forEach((cell) => {
        clearSet.set(cellKey(cell.row, cell.col), { row: cell.row, col: cell.col });
      });
    });

    matches.forEach((match) => {
      if (!match.specialType) {
        return;
      }

      const spawnCell = this.chooseSpawnCell(match, lastSwap);
      const spawnSource = this.board[spawnCell.row][spawnCell.col];
      spawns.push({
        row: spawnCell.row,
        col: spawnCell.col,
        special: match.specialType,
        tileType: match.tileType,
        meta: spawnSource.meta ? { ...spawnSource.meta } : null,
      });
      clearSet.delete(cellKey(spawnCell.row, spawnCell.col));
    });

    const queue = Array.from(clearSet.values());
    const triggered = new Set();

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      const key = cellKey(current.row, current.col);
      const cell = this.board[current.row][current.col];
      if (!cell.special || triggered.has(key)) {
        continue;
      }

      triggered.add(key);
      const extra = this.getSpecialTargets(current, cell.special, queue);
      extra.cells.forEach((cellPos) => {
        const extraKey = cellKey(cellPos.row, cellPos.col);
        if (!clearSet.has(extraKey)) {
          clearSet.set(extraKey, { row: cellPos.row, col: cellPos.col });
          queue.push({ row: cellPos.row, col: cellPos.col });
        }
      });
      effectBursts.push({
        type: extra.effect,
        row: current.row,
        col: current.col,
        tileType: cell.tileType,
      });
    }

    return {
      clearCells: Array.from(clearSet.values()),
      spawns,
      effectBursts,
    };
  }

  chooseSpawnCell(match, lastSwap) {
    if (lastSwap) {
      if (match.cells.some((cell) => cell.row === lastSwap.a.row && cell.col === lastSwap.a.col)) {
        return lastSwap.a;
      }
      if (match.cells.some((cell) => cell.row === lastSwap.b.row && cell.col === lastSwap.b.col)) {
        return lastSwap.b;
      }
    }

    return match.cells[Math.floor(match.cells.length / 2)];
  }

  getSpecialTargets(cellPos, specialType, currentQueue) {
    const cells = [];

    if (specialType === "row") {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        cells.push({ row: cellPos.row, col });
      }
      return { cells, effect: "row" };
    }

    if (specialType === "col") {
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        cells.push({ row, col: cellPos.col });
      }
      return { cells, effect: "col" };
    }

    if (specialType === "bomb") {
      for (let row = cellPos.row - 1; row <= cellPos.row + 1; row += 1) {
        for (let col = cellPos.col - 1; col <= cellPos.col + 1; col += 1) {
          if (isInsideBoard(row, col)) {
            cells.push({ row, col });
          }
        }
      }
      return { cells, effect: "bomb" };
    }

    const targetType = this.resolveColorTarget(cellPos, currentQueue);
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (this.board[row][col].tileType === targetType) {
          cells.push({ row, col });
        }
      }
    }
    return { cells, effect: "color" };
  }

  resolveColorTarget(cellPos, currentQueue) {
    const otherTypes = currentQueue
      .filter((cell) => !(cell.row === cellPos.row && cell.col === cellPos.col))
      .map((cell) => this.board[cell.row][cell.col].tileType)
      .filter(Boolean);

    return otherTypes[0] || this.randomTileType();
  }

  findPossibleMove(board = this.board) {
    const directions = [[1, 0], [0, 1]];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (!board[row][col].tileType) {
          continue;
        }

        for (const [dr, dc] of directions) {
          const nextRow = row + dr;
          const nextCol = col + dc;
          if (!isInsideBoard(nextRow, nextCol) || !board[nextRow][nextCol].tileType) {
            continue;
          }

          this.swapPayloads(board, { row, col }, { row: nextRow, col: nextCol });
          const matched = this.findMatches(board).length > 0;
          this.swapPayloads(board, { row, col }, { row: nextRow, col: nextCol });
          if (matched) {
            return [{ row, col }, { row: nextRow, col: nextCol }];
          }
        }
      }
    }

    return null;
  }

  performDesktopAction(action, target = null) {
    const beforeBoard = copyBoard(this.board);
    const targetCell = this.resolveDesktopActionTarget(action, target);
    if (!targetCell) {
      return { valid: false, reason: "no_target", beforeBoard };
    }

    const { row, col } = targetCell;
    const cell = this.board[row][col];
    const clearedTiles = [];
    const blockersRemoved = [];
    let scoreGain = 0;
    let cleanlinessGain = 0;
    let actionLabel = "";

    if (action === "archive") {
      if (!cell.tileType || cell.tileType === "temp") {
        return { valid: false, reason: "archive_requires_file", beforeBoard };
      }
      clearedTiles.push({
        row,
        col,
        tileType: cell.tileType,
        special: cell.special,
        meta: cell.meta ? { ...cell.meta } : null,
      });
      actionLabel = `归档到 ${cell.meta?.zone || "项目文件夹"}`;
      scoreGain = 140;
      cleanlinessGain = 5;
      this.clearTile(cell);
    } else if (action === "trash") {
      const canTrash = cell.tileType && (cell.tileType === "temp" || cell.meta?.state === "duplicate" || cell.meta?.state === "old");
      if (!canTrash) {
        return { valid: false, reason: "trash_requires_junk", beforeBoard };
      }
      clearedTiles.push({
        row,
        col,
        tileType: cell.tileType,
        special: cell.special,
        meta: cell.meta ? { ...cell.meta } : null,
      });
      actionLabel = "移入回收站";
      scoreGain = 130;
      cleanlinessGain = 6;
      this.clearTile(cell);
    } else if (action === "close") {
      if (!cell.blocker || cell.blocker.type !== "popup") {
        return { valid: false, reason: "close_requires_popup", beforeBoard };
      }
      blockersRemoved.push({ type: "popup", row, col });
      cell.blocker = null;
      actionLabel = "关闭弹窗";
      scoreGain = 170;
      cleanlinessGain = 8;
    } else if (action === "pin") {
      if (!cell.blocker || cell.blocker.type !== "sticky_note") {
        return { valid: false, reason: "pin_requires_note", beforeBoard };
      }
      blockersRemoved.push({ type: "sticky_note", row, col });
      cell.blocker = null;
      actionLabel = "便签归入待办";
      scoreGain = 150;
      cleanlinessGain = 6;
    } else {
      return { valid: false, reason: "unknown_action", beforeBoard };
    }

    this.desktopActions[action] = (this.desktopActions[action] || 0) + 1;
    this.score += scoreGain;
    this.cleanliness = Math.max(0, Math.min(100, this.cleanliness + Math.min(cleanlinessGain, 100 - this.cleanliness)));
    this.updateGoalProgress(clearedTiles, blockersRemoved, action);

    const dropData = clearedTiles.length ? this.collapseAndRefill() : { drops: [] };
    const completed = this.checkCompletion();

    return {
      valid: true,
      action,
      actionLabel,
      beforeBoard,
      clearedTiles,
      blockersRemoved,
      drops: dropData.drops,
      endBoard: copyBoard(this.board),
      scoreGain,
      scoreAfter: this.score,
      cleanlinessGain,
      cleanlinessAfter: this.cleanliness,
      goalsAfter: this.captureGoalSnapshot(),
      bestComboAfter: this.bestCombo,
      movesUsedAfter: this.movesUsed,
      completed,
      stars: completed ? this.computeStars() : 0,
    };
  }

  resolveDesktopActionTarget(action, target) {
    if (target && isInsideBoard(target.row, target.col)) {
      return { row: target.row, col: target.col };
    }

    if (action === "close") {
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          if (this.board[row][col].blocker?.type === "popup") {
            return { row, col };
          }
        }
      }
    }

    return null;
  }

  shuffle() {
    const beforeBoard = copyBoard(this.board);
    const movable = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = this.board[row][col];
        if (isPopupBlocker(cell)) {
          continue;
        }

        movable.push({
          row,
          col,
          tileType: cell.tileType,
          special: cell.special,
          meta: cell.meta ? { ...cell.meta } : null,
        });
      }
    }

    for (let attempt = 0; attempt < 180; attempt += 1) {
      const shuffled = [...movable];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = this.randomIndex(index + 1);
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }

      shuffled.forEach((payload, index) => {
        const target = movable[index];
        const cell = this.board[target.row][target.col];
        this.setTile(cell, payload.tileType, payload.special, payload.meta);
      });

      if (!this.findMatches(this.board).length && this.findPossibleMove(this.board)) {
        return {
          beforeBoard,
          afterBoard: copyBoard(this.board),
        };
      }
    }

    return {
      beforeBoard,
      afterBoard: copyBoard(this.board),
    };
  }

  checkCompletion() {
    const done = this.level.goals.every((goal, index) => this.getGoalCurrent(goal, index) >= goal.target);
    this.completed = done;
    return done;
  }

  computeStars() {
    if (this.movesUsed <= this.level.recommendedMoves) {
      return 3;
    }
    if (this.movesUsed <= this.level.recommendedMoves + 5) {
      return 2;
    }
    return 1;
  }
}
