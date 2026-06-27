/**
 * reflowPlugin：拖动过程中，其他元素的移动动画插件。
 * 1. 拖动过程中，其他元素的移动动画。
 * 2. 拖动结束后，ghost元素移动到目标位置的动画。
 */
export function reflowPlugin({ duration = 200, easing = "ease-in-out" } = {}) {
  let lastKey = null;
  let placeholder = null;

  const createPlaceholder = (ctx) => {
    placeholder = document.createElement("div");
    placeholder.className = "drag-draggable-wrapper";
    placeholder.style.width = `${ctx.draggedItem.rect.width}px`;
    placeholder.style.height = `${ctx.draggedItem.rect.height}px`;
    ctx.activeContainer.container.element.appendChild(placeholder);
  };

  const removePlaceholder = () => {
    if (placeholder) {
      placeholder.remove();
      placeholder = null;
    }
  };

  const apply = (ctx) => {
    const { initialIndex, insertIndex, axis, draggedItem } = ctx;
    const sourceContainer = ctx.sourceContainer;
    const activeContainer = ctx.activeContainer;
    const container = activeContainer ?? sourceContainer;
    const items = container.items;

    // 计算需要移动的step，如果 initialIndex < insertIndex，说明dragged元素向后移动
    // 所有在initialIndex和insertIndex之间的元素都需要向前移动一位。
    // 移动的距离是dragged元素的宽度或高度，取决于拖动的方向。
    const gap = parseFloat(
      getComputedStyle(container.container.element).gap || 0,
    );
    const step = axis.sizeOf(draggedItem.rect) + gap;

    // 如果是在源容器中拖动
    if (sourceContainer === activeContainer) {
      items.forEach((item, index) => {
        if (index === initialIndex) {
          item.element.style.transform = "";
          return;
        }

        if (initialIndex < insertIndex) {
          const distance =
            index > initialIndex && index <= insertIndex ? -step : 0;
          item.element.style.transform = axis.translate(distance);
        } else {
          const distance =
            index >= insertIndex && index < initialIndex ? step : 0;
          item.element.style.transform = axis.translate(distance);
        }
      });
    }

    // 如果是跨容器拖动
    if (sourceContainer !== activeContainer) {
      // 给容器加一个人空白的占位元素，大小和拖拽元素一样，放在目标容器的最后一个元素下方
      if (!placeholder) {
        createPlaceholder(ctx);
      }

      items.forEach((item, i) => {
        const distance = i >= ctx.insertIndex ? step : 0;
        item.element.style.transform = axis.translate(distance);
      });
    }
  };

  function animateDrop(ctx) {
    const ghostEl = ctx.ghost.element;
    const dragged = ctx.draggedItem.element;

    // 得到目标位置：DOM 已经提交了，dragged 已经在新槽位，直接读它
    const targetRect = dragged.getBoundingClientRect();

    ghostEl.style.transition = `all ${duration}ms ${easing}`;
    ghostEl.style.left = `${targetRect.left}px`;
    ghostEl.style.top = `${targetRect.top}px`;

    // 3. 等过渡结束
    return new Promise((resolve) => {
      let hasResolved = false;
      const doResolve = () => {
        if (hasResolved) return;
        hasResolved = true;
        resolve();
      };

      ghostEl.addEventListener("transitionend", doResolve, { once: true });

      const timer = setTimeout(() => {
        doResolve();
      }, duration + 50);
    });
  }

  const setTransitions = (items, value) => {
    items.forEach((it) => (it.element.style.transition = value));
  };

  return {
    name: "reflow",

    onSessionFrame(ctx) {
      const key = `${ctx.initialIndex}:${ctx.insertIndex}`;
      if (key === lastKey || ctx.insertIndex === null) return;
      lastKey = key;
      apply(ctx);
    },

    onContainerEnter(ctx) {
      setTransitions(ctx.container.items, `transform ${duration}ms ${easing}`);
      lastKey = null;
    },
    onContainerLeave(ctx) {
      lastKey = null;
      if (ctx.committed) {
        ctx.container.items.forEach((it) => {
          it.element.style.transition = "";
          it.element.style.transform = "";
        });
      } else {
        ctx.container.items.forEach((it) => {
          it.element.style.transform = "";
        });
      }
    },

    onSessionEnd(ctx) {
      lastKey = null;

      const promise = animateDrop(ctx);
      return promise;
    },
  };
}
