const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const clampVisiblePosition = (rawX, rawY, rect, display) => {
  const minX = Math.ceil(display.x - rect.x);
  const minY = Math.ceil(display.y - rect.y);
  const maxX = Math.max(minX, Math.floor(display.x + display.width - rect.x - rect.width));
  const maxY = Math.max(minY, Math.floor(display.y + display.height - rect.y - rect.height));
  return { x: clamp(Math.round(rawX), minX, maxX), y: clamp(Math.round(rawY), minY, maxY) };
};

const calculateDragPosition = (session, pointer, display) => {
  const rawX = session.windowX + pointer.x - session.pointerX;
  const rawY = session.windowY + pointer.y - session.pointerY;
  const rect = session.visibleRect || { x: 0, y: 0, width: session.windowWidth, height: session.windowHeight };
  return clampVisiblePosition(rawX, rawY, rect, display);
};

module.exports = { calculateDragPosition, clampVisiblePosition };
