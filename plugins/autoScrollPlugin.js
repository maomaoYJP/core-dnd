/**
 * autoScrollPlugin：拖动到容器边缘时，自动滚动容器（或窗口）。
 *
 * 思路：
 *   1. 读取当前 activeContainer 和指针位置
 *   2. 计算指针到主轴两端的距离，进入 threshold 区域则线性加速滚动
 *   3. 容器内部滚动后，items 在 viewport 中沿主轴反向偏移；同步修正缓存
 *      的 rect，避免 updateDrag 拿着过时坐标算错 insertIndex。
 *
 * options：
 *   - threshold：距离边缘多少像素开始触发，默认 50
 *   - maxSpeed：贴边时每帧滚动像素，默认 18
 *   - scrollWindow：容器到达边界后是否回退滚动窗口，默认 true
 */
export function autoScrollPlugin({
  threshold = 50,
  maxSpeed = 18,
  scrollWindow = true,
} = {}) {
  // 计算滚动速度，正值=向后/向下，负值=向前/向上
  const computeDelta = (pos, start, end) => {
    const fromStart = pos - start;
    const fromEnd = end - pos;
    if (fromStart >= 0 && fromStart < threshold) {
      return -maxSpeed * (1 - fromStart / threshold);
    }
    if (fromEnd >= 0 && fromEnd < threshold) {
      return maxSpeed * (1 - fromEnd / threshold);
    }
    return 0;
  };

  // 滚动容器，返回真正滚动的距离（0 表示已到边界）
  const scrollContainer = (container, axis, delta) => {
    if (delta === 0) return 0;
    const el = container.containerEl;
    const prop = axis.keys.scrollProp;
    const before = el[prop];
    el[prop] = before + delta;
    return el[prop] - before;
  };

  // 容器滚动后，items 在 viewport 中沿主轴反向偏移 `applied`，同步修正缓存
  const shiftCachedItems = (container, axis, applied) => {
    if (applied === 0) return;
    const startKey = axis.keys.start;
    const endKey = axis.keys.end;
    for (const item of container.items) {
      item.rect[startKey] -= applied;
      item.rect[endKey] -= applied;
    }
  };

  const scrollWindowBy = (axis, delta) => {
    if (delta === 0) return;
    if (axis.isX) window.scrollBy(delta, 0);
    else window.scrollBy(0, delta);
  };

  return {
    name: "autoScroll",

    onSessionFrame(ctx) {
      const container = ctx.activeContainer ?? ctx.sourceContainer;
      if (!container) return;
      const axis = ctx.axis;
      const pointer = ctx.pointer;
      const pos = axis.isX ? pointer.x : pointer.y;

      // 1. 先尝试滚动当前容器（按容器自身可视范围判断）
      const cRect = container.container.rect;
      const containerDelta = computeDelta(
        pos,
        axis.startOf(cRect),
        axis.endOf(cRect),
      );
      const applied = scrollContainer(container, axis, containerDelta);

      if (applied !== 0) {
        shiftCachedItems(container, axis, applied);
        return;
      }

      // 2. 容器已到边界（或不在阈值内），再尝试滚动窗口
      if (!scrollWindow) return;
      const winSize = axis.isX ? window.innerWidth : window.innerHeight;
      const winDelta = computeDelta(pos, 0, winSize);
      scrollWindowBy(axis, winDelta);
    },
  };
}
