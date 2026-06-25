/**
 * 每个容器的 plugin 实例各自管理自己的 previewEl。
 * 源容器：previewEl 整个会话期间持续存在，离开时回到被拖元素原位置。
 * 非源容器：进入时创建，离开时移除。
 */
export function previewPlugin({
  className = "drag-preview",
  duration = 200,
  easing = "ease-in-out",
} = {}) {
  let previewEl = null;
  let lastKey = null;

  const isSource = (ctx) => ctx.sourceContainer === ctx.container;

  const createPreviewEl = (ctx) => {
    previewEl = document.createElement("div");
    previewEl.classList.add(className);

    const draggedItem = ctx.draggedItem;
    const containerRect = ctx.container.container.rect;

    // 初始化位置
    // 源容器：initIndex 位置
    // 非源容器：一开始进入的时候insertIndex为null，先创建隐藏，等update时再移动
    previewEl.style.position = "absolute";
    previewEl.style.pointerEvents = "none";
    previewEl.style.transition = "none";

    previewEl.style.width = `${draggedItem.rect.width}px`;
    previewEl.style.height = `${draggedItem.rect.height}px`;

    if (isSource(ctx)) {
      const initTop = draggedItem.rect.top - containerRect.top;
      const initLeft = draggedItem.rect.left - containerRect.left;
      previewEl.style.top = `${initTop}px`;
      previewEl.style.left = `${initLeft}px`;
    }

    ctx.container.containerEl.appendChild(previewEl);

    // 下一帧再启用 transition
    requestAnimationFrame(() => {
      if (previewEl) {
        previewEl.style.transition = `all ${duration}ms ${easing}`;
      }
    });
  };

  const updatePreviewEl = (ctx) => {
    if (!previewEl) return;
    if (ctx.insertIndex == null) return;

    const insertIndex = ctx.insertIndex;
    const initialIndex = ctx.initialIndex;
    const items = ctx.items;
    const container = ctx.container.container;
    const axis = ctx.axis;
    const gap = parseFloat(getComputedStyle(container.element).gap || 0);

    let distance = 0;

    // 非源容器
    if (initialIndex == null) {
      if (items.length === 0) {
        distance = 0;
      } else if (insertIndex >= items.length) {
        const last = items[items.length - 1];
        distance = axis.endOf(last.rect) - axis.startOf(container.rect) + gap;
      } else {
        const related = items[insertIndex];
        distance = axis.startOf(related.rect) - axis.startOf(container.rect);
      }
    } else {
      // 源容器：items 包含被拖元素（隐藏），需要在两侧分别处理
      const draggedItemSize = axis.sizeOf(ctx.draggedItem.rect);

      if (initialIndex <= insertIndex) {
        // 从上往下拖
        if (insertIndex < items.length - 1) {
          // 以 insertIndex 之后的一个元素为基准
          const relatedItem = items[insertIndex + 1];
          distance =
            axis.startOf(relatedItem.rect) -
            axis.startOf(container.rect) -
            draggedItemSize -
            gap;
        } else {
          // 拖到末尾：以最后一个元素为基准
          const lastItem = items[items.length - 1];
          distance =
            axis.endOf(lastItem.rect) -
            axis.startOf(container.rect) -
            draggedItemSize;
        }
      } else {
        // 从下往上拖：以 insertIndex 元素为基准
        const relatedItem = items[insertIndex];
        distance =
          axis.startOf(relatedItem.rect) - axis.startOf(container.rect);
      }
    }

    axis.setMainStart(previewEl, distance);
  };

  return {
    name: "preview",

    onSessionStart(ctx) {
      lastKey = null;

      if (!previewEl) {
        createPreviewEl(ctx);
      }
    },

    onSessionMove(ctx) {
      const key = `${ctx.initialIndex}:${ctx.insertIndex}`;
      if (key === lastKey) return;
      lastKey = key;
      updatePreviewEl(ctx);
    },

    onSessionLeave(ctx) {
      lastKey = null;

      if (isSource(ctx)) {
        // 源容器：离开时回到被拖元素原位置
        const draggedItem = ctx.draggedItem;
        const containerRect = ctx.container.container.rect;
        const initTop = draggedItem.rect.top - containerRect.top;
        const initLeft = draggedItem.rect.left - containerRect.left;
        previewEl.style.top = `${initTop}px`;
        previewEl.style.left = `${initLeft}px`;
      } else {
        // 非源容器：离开时移除
        previewEl?.remove();
        previewEl = null;
      }
    },

    onSessionEnd(ctx) {
      previewEl?.remove();
      previewEl = null;
      lastKey = null;
    },
  };
}
