const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const calculateDragPosition = (session, pointer, workArea) => {
  const rawX = session.windowX + pointer.x - session.pointerX;
  const rawY = session.windowY + pointer.y - session.pointerY;
  const minX = workArea.x;
  const minY = workArea.y;
  const maxX = Math.max(minX, workArea.x + workArea.width - session.windowWidth);
  const maxY = Math.max(minY, workArea.y + workArea.height - session.windowHeight);
  return { x: clamp(rawX, minX, maxX), y: clamp(rawY, minY, maxY) };
};

module.exports = { calculateDragPosition };
