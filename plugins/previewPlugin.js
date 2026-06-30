import { CSS } from "../constant.js";

const defaultOptions = {
  className: CSS.dragPreview,
  duration: 200,
  easing: "ease-in-out",
};

export function computePreviewDistance({
  axis,
  items,
  containerRect,
  draggedRect,
  gap,
  scrollOffset,
  insertIndex,
  initialIndex,
  isSource,
}) {
  const draggedSize = axis.sizeOf(draggedRect);
  const step = draggedSize + gap;
  const containerStart = axis.startOf(containerRect);

  const rectOf = (item) => item.getCachedRect?.() ?? item;
  const startOf = (rect) => axis.startOf(rect) - containerStart + scrollOffset;
  const endOf = (rect) => axis.endOf(rect) - containerStart + scrollOffset;

  if (isSource) {
    if (insertIndex === initialIndex) {
      return startOf(draggedRect);
    }

    if (insertIndex > initialIndex) {
      const anchor = items[Math.min(insertIndex, items.length - 1)];
      return anchor ? endOf(rectOf(anchor)) + gap : 0;
    }

    const anchor = items[insertIndex];
    return anchor ? startOf(rectOf(anchor)) - step : 0;
  }

  if (items.length === 0) {
    return 0;
  }

  if (insertIndex >= items.length) {
    const last = items[items.length - 1];
    return endOf(rectOf(last)) + gap;
  }

  const anchor = items[insertIndex];
  return startOf(rectOf(anchor)) - step;
}

export function previewPlugin(options = {}) {
  let previewEl = null;
  let lastKey = null;

  const createPreviewEl = (ctx) => {
    const previewOptions = {
      ...defaultOptions,
      ...options,
      ...(ctx.container.options?.preview || {}),
    };

    previewEl = document.createElement("div");
    previewEl.classList.add(previewOptions.className);

    const axis = ctx.axis;
    const draggedRect = ctx.draggedItem.getCachedRect();
    const container = ctx.container.container;
    const scrollOffset = axis.getScroll(container.element);
    const start =
      axis.startOf(draggedRect) -
      axis.startOf(container.getCachedRect()) +
      scrollOffset;

    previewEl.style.position = "absolute";
    previewEl.style.pointerEvents = "none";
    previewEl.style.transition = "none";
    previewEl.style.width = `${draggedRect.width}px`;
    previewEl.style.height = `${draggedRect.height}px`;

    if (ctx.container.isSource(ctx.sourceContainer)) {
      previewEl.style[axis.keys.start] = `${start}px`;
    }

    ctx.container.containerEl.appendChild(previewEl);

    requestAnimationFrame(() => {
      if (previewEl) {
        previewEl.style.transition = `all ${previewOptions.duration}ms ${previewOptions.easing}`;
      }
    });
  };

  const updatePreviewEl = (ctx) => {
    if (!previewEl) return;
    if (ctx.insertIndex == null) return;

    const axis = ctx.axis;
    const container = ctx.activeContainer.container;
    const gap = parseFloat(getComputedStyle(container.element).gap || 0);

    const distance = computePreviewDistance({
      axis,
      items: ctx.activeContainer.items,
      containerRect: container.getCachedRect(),
      draggedRect: ctx.draggedItem.getCachedRect(),
      gap,
      scrollOffset: axis.getScroll(container.element),
      insertIndex: ctx.insertIndex,
      initialIndex: ctx.initialIndex,
      isSource: ctx.activeContainer.isSource(ctx.sourceContainer),
    });

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

    onContainerEnter(ctx) {
      lastKey = null;
      if (previewEl) {
        previewEl.remove();
        previewEl = null;
      }
      createPreviewEl(ctx);
    },

    onContainerLeave(ctx) {
      lastKey = null;
      if (!previewEl) return;

      if (ctx.committed) {
        previewEl.remove();
        previewEl = null;
        return;
      }

      const sourceContainer = ctx.sourceContainer;
      const sourceContainerEl = sourceContainer.containerEl;
      const sourceRect = sourceContainer.container.getCachedRect();
      const axis = ctx.axis;
      const scrollOffset = axis.getScroll(sourceContainer.containerEl);
      const homeStart =
        axis.startOf(ctx.draggedItem.getCachedRect()) -
        axis.startOf(sourceRect) +
        scrollOffset;

      if (previewEl.parentNode !== sourceContainerEl) {
        sourceContainerEl.appendChild(previewEl);
      }

      previewEl.style[axis.keys.start] = `${homeStart}px`;
    },

    onSessionEnd() {
      previewEl?.remove();
      previewEl = null;
      lastKey = null;
    },
  };
}
