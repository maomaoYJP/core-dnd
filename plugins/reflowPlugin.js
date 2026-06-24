export function reflowPlugin({ duration = 200, easing = "ease-in-out" } = {}) {
  let lastKey = null;

  const apply = (ctx) => {
    const { items, initialIndex, insertIndex, axis, container, draggedItem } =
      ctx;

    // 计算需要移动的step，如果 initialIndex < insertIndex，说明dragged元素向后移动
    // 所有在initialIndex和insertIndex之间的元素都需要向前移动一位。
    // 移动的距离是dragged元素的宽度或高度，取决于拖动的方向。
    const gap = parseFloat(
      getComputedStyle(container.container.element).gap || 0,
    );
    const step = axis.sizeOf(draggedItem.rect) + gap;

    // 如果是在源容器中拖动
    if (ctx.sourceContainer === ctx.container) {
      items.forEach((item, index) => {
        if (index === initialIndex) {
          item.element.style.transform = "";
          return;
        }

        if (initialIndex < insertIndex) {
          const distance =
            index > initialIndex && index < insertIndex ? -step : 0;
          item.element.style.transform = axis.translate(distance);
        } else {
          const distance =
            index >= insertIndex && index < initialIndex ? step : 0;
          item.element.style.transform = axis.translate(distance);
        }
      });
    }

    // 如果是跨容器拖动
    if (ctx.sourceContainer !== ctx.container) {
      items.forEach((item, i) => {
        const distance = i >= ctx.insertIndex ? step : 0;
        item.element.style.transform = axis.translate(distance);
      });
    }
  };

  const setTransitions = (items, value) => {
    items.forEach((it) => (it.element.style.transition = value));
  };

  return {
    name: "reflow",
    onSessionStart(ctx) {
      setTransitions(ctx.items, `transform ${duration}ms ${easing}`);
      lastKey = null;
    },
    onSessionMove(ctx) {
      const key = `${ctx.initialIndex}:${ctx.insertIndex}`;
      if (key === lastKey) return;
      lastKey = key;
      apply(ctx);
    },
    onSessionLeave(ctx) {
      lastKey = null;
      ctx.items.forEach((it) => (it.element.style.transform = ""));
    },
    onSessionEnd(ctx) {
      ctx.items.forEach((it) => {
        it.element.style.transition = "";
        it.element.style.transform = "";
      });
      lastKey = null;
    },
  };
}
