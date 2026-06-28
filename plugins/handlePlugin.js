/**
 * handlePlugin：拖手（drag handle）。
 *
 * 配置优先级：container.options.handle ?? pluginOption.handle
 *
 *   manager.use(handlePlugin({ handle: ".drag-handle" })); // 插件级默认
 *   manager.mount(el, { handle: ".my-handle" });           // 容器级覆盖
 *
 * handle 也可以是一个函数 (target, ctx) => boolean，用于实现更复杂的判断
 */
export function handlePlugin(options = {}) {
  const defaultHandle = options.handle ?? null;

  return {
    name: "handle",

    onBeforeSessionCreate(ctx) {
      const handle = ctx.sourceContainer.options.handle ?? defaultHandle;
      if (!handle) return;

      const itemEl = ctx.draggedItem.element;
      const target = ctx.pointerEvent.target;

      if (typeof handle === "function") {
        if (!handle(target, ctx)) ctx.preventDefault();
        return;
      }

      // target 最近的匹配元素必须仍在当前 item 内部
      const matched = target.closest?.(handle);
      if (!matched || !itemEl.contains(matched)) {
        ctx.preventDefault();
      }
    },
  };
}
