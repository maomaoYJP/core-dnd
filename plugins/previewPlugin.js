export function previewPlugin({
  className = "drag-preview",
  duration = 200,
  easing = "ease-in-out",
} = {}) {
  let previewEl = null;
  let lastKey = null;

  const createPreviewEl = (ctx) => {
    if (previewEl) return;

    previewEl = document.createElement("div");
    previewEl.classList.add(className);

    const draggedRect = ctx.draggedItem.rect;
    const containerRect = ctx.container.container.rect;

    const offsetTop = draggedRect.top - containerRect.top;
    const offsetLeft = draggedRect.left - containerRect.left;
    // 设置预览元素的初始位置和大小
    previewEl.style.width = `${draggedRect.width}px`;
    previewEl.style.height = `${draggedRect.height}px`;
    previewEl.style.top = `${offsetTop}px`;
    previewEl.style.left = `${offsetLeft}px`;

    previewEl.style.position = "absolute";
    previewEl.style.pointerEvents = "none";
    previewEl.style.transition = `all ${duration}ms ${easing}`;

    ctx.container.containerEl.appendChild(previewEl);
  };

  const updatePreviewEl = (ctx) => {
    if (!previewEl) return;

    const insertIndex = ctx.insertIndex;
    const initialIndex = ctx.initialIndex;
    const draggedItem = ctx.draggedItem;
    const items = ctx.items;
    const container = ctx.container.container;

    // 这是空位的大小，只要找到需要插入的top或者bottom位置，减去这个距离，就能把预览元素放到正确的位置了。
    const draggedItemSize = ctx.axis.sizeOf(draggedItem.rect);
    const gap = parseFloat(getComputedStyle(container.element).gap || 0);

    let distance = 0;

    // 从上往下拖
    if (initialIndex <= insertIndex) {
      // 找到insertIndex之后的一个元素，以它的top为基准
      if (insertIndex < items.length - 1) {
        const relatedItem = items[insertIndex + 1];
        const relatedRect = relatedItem.rect;
        distance =
          ctx.axis.startOf(relatedRect) -
          ctx.axis.startOf(container.rect) -
          draggedItemSize -
          gap;
      } else {
        // 如果拖到末尾了，就以最后一个元素为基准
        const lastItem = items[items.length - 1];
        const lastRect = lastItem.rect;
        distance =
          ctx.axis.endOf(lastRect) -
          ctx.axis.startOf(container.rect) -
          draggedItemSize;
      }
    } else {
      // 从下往上拖
      // 找到insertIndex的元素，以它的top为基准
      const relatedItem = items[insertIndex];
      const relatedRect = relatedItem.rect;

      distance =
        ctx.axis.startOf(relatedRect) - ctx.axis.startOf(container.rect);
    }

    ctx.axis.setMainStart(previewEl, distance);
  };

  return {
    name: "preview",

    onSessionStart(ctx) {
      lastKey = null;
      createPreviewEl(ctx);
    },

    onSessionMove(ctx) {
      const key = `${ctx.initialIndex}:${ctx.insertIndex}`;
      if (key === lastKey) return;
      lastKey = key;
      updatePreviewEl(ctx);
    },

    onSessionLeave(ctx) {
      if (previewEl) previewEl.style.display = "none";
      lastKey = null;
    },

    onSessionEnd(ctx) {
      previewEl?.remove();
      previewEl = null;
      lastKey = null;
    },
  };
}
