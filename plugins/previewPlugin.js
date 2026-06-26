/**
 * 单例 previewEl 跟随 activeContainer：
 *   - 进入容器：创建（或将来 reparent）到当前容器；源容器初始放在被拖元素原位
 *   - 离开容器：无论从源还是非源，都 reparent 回源容器、对齐被拖元素原位
 *     —— 拖到任何容器外时，preview 都"回家"
 */
export function previewPlugin({
  className = "drag-preview",
  duration = 200,
  easing = "ease-in-out",
} = {}) {
  let previewEl = null;
  let lastKey = null;

  const createPreviewEl = (ctx) => {
    previewEl = document.createElement("div");
    previewEl.classList.add(className);

    const draggedItem = ctx.draggedItem;
    const containerRect = ctx.container.container.rect;

    // 初始化位置
    previewEl.style.position = "absolute";
    previewEl.style.pointerEvents = "none";
    previewEl.style.transition = "none";

    previewEl.style.width = `${draggedItem.rect.width}px`;
    previewEl.style.height = `${draggedItem.rect.height}px`;

    if (ctx.container.isSource(ctx.sourceContainer)) {
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
    const axis = ctx.axis;

    const items = ctx.activeContainer.items;
    const container = ctx.activeContainer.container;
    const gap = parseFloat(getComputedStyle(container.element).gap || 0);

    let distance = 0;

    // 非源容器
    if (!ctx.activeContainer.isSource(ctx.sourceContainer)) {
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

    onSessionFrame(ctx) {
      const key = `${ctx.initialIndex}:${ctx.insertIndex}`;
      if (key === lastKey) return;
      lastKey = key;
      updatePreviewEl(ctx);
    },

    // 进入容器时，创建previewEl
    onContainerEnter(ctx) {
      lastKey = null;
      if (previewEl) {
        previewEl.remove();
        previewEl = null;
      }
      createPreviewEl(ctx);
    },

    // 离开任意容器：preview 一律"回家" —— 搬回源容器、对齐被拖元素原位置。
    onContainerLeave(ctx) {
      lastKey = null;
      if (!previewEl) return;

      if (ctx.committed) {
        // 如果是 commit 离开，说明拖动结束了，直接移除 previewEl
        previewEl.remove();
        previewEl = null;
        return;
      }

      const sourceContainer = ctx.sourceContainer;
      const sourceContainerEl = sourceContainer.containerEl;
      const sourceRect = sourceContainer.container.rect;
      const draggedItem = ctx.draggedItem;
      const homeTop = draggedItem.rect.top - sourceRect.top;
      const homeLeft = draggedItem.rect.left - sourceRect.left;

      // 若 previewEl 当前不在源容器里，离开的时候搬回源容器
      if (previewEl.parentNode !== sourceContainerEl) {
        sourceContainerEl.appendChild(previewEl);
      }

      previewEl.style.top = `${homeTop}px`;
      previewEl.style.left = `${homeLeft}px`;
    },

    onSessionEnd(ctx) {
      previewEl?.remove();
      previewEl = null;
      lastKey = null;
    },
  };
}
