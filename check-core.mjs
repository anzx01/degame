import assert from "node:assert/strict";
import { CleanupCore, areAdjacent } from "./game-core.js";
import { LEVELS } from "./levels.js";

function playLevel(level) {
  const core = new CleanupCore(level);
  assert.equal(core.findMatches().length, 0, `开局不应有自动消除: ${level.id}`);
  assert.ok(core.findPossibleMove(), `开局至少应该有一步可走: ${level.id}`);

  for (let turn = 0; turn < 40; turn += 1) {
    const move = core.findPossibleMove();
    assert.ok(move, `局中至少应该始终存在一步可走: ${level.id} turn=${turn}`);
    assert.ok(areAdjacent(move[0], move[1]), `提示出来的必须是相邻交换: ${level.id}`);
    const result = core.performSwap(move[0], move[1]);
    assert.equal(result.valid, true, `系统提示的步法必须有效: ${level.id}`);
    assert.ok(core.findMatches().length === 0, `结算结束后棋盘不应残留未结算连线: ${level.id}`);

    if (!core.findPossibleMove()) {
      const shuffle = core.shuffle();
      assert.ok(shuffle.afterBoard, `无解后必须能完成洗牌: ${level.id}`);
    }

    if (core.completed) {
      assert.ok(core.computeStars() >= 1, `完成关卡时至少应有 1 星: ${level.id}`);
      return;
    }
  }
}

LEVELS.forEach(playLevel);
console.log(`check-core: ${LEVELS.length} levels passed`);
