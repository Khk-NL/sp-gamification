const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDragPosition } = require('../src/drag-position.cjs');

test('拖动始终由起点计算，不累积每一帧误差', () => {
  const session = { windowX: 100, windowY: 80, windowWidth: 250, windowHeight: 300, pointerX: 140, pointerY: 120 };
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.deepEqual(calculateDragPosition(session, { x: 150, y: 130 }, workArea), { x: 110, y: 90 });
  assert.deepEqual(calculateDragPosition(session, { x: 160, y: 140 }, workArea), { x: 120, y: 100 });
});

test('连续拖动 50 次后原始工作区边界不缩小，并支持负坐标副屏', () => {
  const workArea = { x: -1920, y: -40, width: 1920, height: 1080 };
  const windowWidth = 250;
  const windowHeight = 300;
  let position = { x: -1200, y: 100 };
  for (let index = 0; index < 50; index += 1) {
    const session = { windowX: position.x, windowY: position.y, windowWidth, windowHeight, pointerX: position.x + 40, pointerY: position.y + 40 };
    const leftTop = calculateDragPosition(session, { x: -9999, y: -9999 }, workArea);
    const rightBottom = calculateDragPosition(session, { x: 9999, y: 9999 }, workArea);
    assert.deepEqual(leftTop, { x: -1920, y: -40 });
    assert.deepEqual(rightBottom, { x: -250, y: 740 });
    position = index % 2 ? leftTop : rightBottom;
  }
});

test('透明窗口可越过屏幕边界，使可见角色恰好到达四边', () => {
  const session = { windowX: 500, windowY: 200, windowWidth: 250, windowHeight: 300, pointerX: 625, pointerY: 350, visibleRect: { x: 50, y: 100, width: 150, height: 170 } };
  const display = { x: -1920, y: -40, width: 1920, height: 1080 };
  for (let index = 0; index < 50; index += 1) {
    const leftTop = calculateDragPosition(session, { x: -9999, y: -9999 }, display);
    const rightBottom = calculateDragPosition(session, { x: 9999, y: 9999 }, display);
    assert.deepEqual(leftTop, { x: -1970, y: -140 });
    assert.deepEqual(rightBottom, { x: -200, y: 770 });
    session.windowX = index % 2 ? leftTop.x : rightBottom.x;
    session.windowY = index % 2 ? leftTop.y : rightBottom.y;
    session.pointerX = session.windowX + 125;
    session.pointerY = session.windowY + 150;
  }
});
