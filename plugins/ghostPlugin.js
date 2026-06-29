import { CSS } from "../constant.js";

/**
 * ghostPlugin：拖拽过程中跟随指针的 ghost 元素。
 *
 * 该插件托管 ghost 的完整生命周期：
 *   - onBeforeSessionStart：基于 draggedItem 创建并挂载 ghost，写入 session.ghost
 *   - onSessionStart：给 ghost 加上入场动画
 *   - onBeforeSessionFrame：每帧最先触发，将 ghost 同步到当前指针位置
 *   - onSessionEnd：DOM 已提交，把 ghost 飞向 dragged 的最终槽位（drop 动画）
 *   - onSessionCleanup：卸载 ghost，清理 session.ghost
 *
 * 对外契约：session.ghost = { element, getCachedRect(), setCachedRect() }
 *   - element：跟随指针的 DOM 节点
 *   - getCachedRect()：返回 ghost 当前的 bounding rect
 *   - setCachedRect()：设置 ghost 的 cached rect
 *
 * 注意：onSessionEnd 的 drop 动画依赖 reflow 在更早注册——reflow 会同步清空
 * items 的 transform，确保 dragged.getBoundingClientRect() 是干净的目标位置。
 *
 * options（优先级：默认 < 插件 < 容器；容器配置写在 container.options.ghost）：
 *   - className：ghost wrapper 的 class，默认 "drag-ghost"
 *   - renderContent(ctx)：自定义 ghost 内部内容，返回 DOM 节点；
 *                        外层 wrapper（定位/尺寸/类名）始终由插件接管。
 *                        默认实现是克隆 draggedItem.element。
 *   - onEnter(ghostEl, ctx)：自定义入场动画；默认是 1deg 倾斜的渐入
 *   - onDrop(ghostEl, ctx)：自定义 drop 动画；返回 Promise 时插件会 await
 *                          传空函数 () => {} 即可关闭 drop 动画
 *
 * 所有动画都使用 Web Animations API。需要自定义时长/缓动等参数，直接覆盖
 */

const defaultOptions = {
  className: CSS.dragGhost,
};

// 默认内容：克隆 draggedItem，撑满 wrapper
function defaultRenderContent(ctx) {
  const clone = ctx.draggedItem.element.cloneNode(true);
  clone.style.visibility = "visible";
  clone.style.width = "100%";
  clone.style.height = "100%";
  return clone;
}

// 默认入场动画：1deg 微倾斜
function defaultEnterAnimation(el, ctx) {
  el.animate(
    [
      { transform: "rotate(0deg) scale(1)" },
      { transform: "rotate(1deg) scale(1)" },
    ],
    { duration: 200, easing: "ease-in-out", fill: "forwards" },
  );
}

// 默认 drop 动画：从当前位置平移到 dragged 最终槽位，保留入场动画的 transform
function defaultDropAnimation(ghostEl, ctx) {
  const targetRect = ctx.draggedItem.element.getBoundingClientRect();

  return ghostEl.animate(
    [
      { left: ghostEl.style.left, top: ghostEl.style.top },
      { left: `${targetRect.left}px`, top: `${targetRect.top}px` },
    ],
    { duration: 200, easing: "ease-in-out", fill: "forwards" },
  ).finished;
}

export function ghostPlugin(pluginOptions = {}) {
  // 位置偏移量，用于将 ghost 的左上角对齐到指针位置
  let pointerOffset = null;
  let resolvedOptions = null;

  // 解析当次会话的有效配置：默认 < 插件 < 源容器
  function resolveOptions(ctx) {
    const containerOptions = ctx.sourceContainer?.options?.ghost || {};
    return { ...defaultOptions, ...pluginOptions, ...containerOptions };
  }

  // wrapper 由插件接管：定位、尺寸、className 都是固定结构
  function buildGhost(ctx, opts) {
    const sourceEl = ctx.draggedItem.element;
    const rect = sourceEl.getBoundingClientRect();

    const content = (opts.renderContent || defaultRenderContent)(ctx);

    const wrapper = document.createElement("div");
    wrapper.classList.add(opts.className);
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    wrapper.style.left = `${rect.left}px`;
    wrapper.style.top = `${rect.top}px`;
    wrapper.appendChild(content);

    return { wrapper, rect };
  }

  // 缓存 rect
  function makeRect(x, y, width, height) {
    return {
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      width,
      height,
    };
  }

  return {
    name: "ghost",

    onBeforeSessionStart(ctx) {
      const session = ctx.session;
      resolvedOptions = resolveOptions(session);

      const { wrapper, rect } = buildGhost(session, resolvedOptions);
      document.body.appendChild(wrapper);

      // 偏移量，用于计算 ghost 的左上角位置，使其对齐到指针位置
      pointerOffset = {
        x: session.pointerEvent.clientX - rect.left,
        y: session.pointerEvent.clientY - rect.top,
      };

      // 约定的 session.ghost 对象，供后续钩子使用
      let cachedRect = makeRect(rect.left, rect.top, rect.width, rect.height);
      session.ghost = {
        element: wrapper,
        getCachedRect() {
          return cachedRect;
        },
        setCachedRect(rect) {
          cachedRect = rect;
        },
      };
    },

    onSessionStart(ctx) {
      const el = ctx.ghost?.element;
      if (!el) return;

      (resolvedOptions.onEnter || defaultEnterAnimation)(el, ctx);
    },

    onBeforeSessionFrame(ctx) {
      const ghost = ctx.session.ghost;
      if (!ghost || !pointerOffset) return;

      const x = ctx.pointer.x - pointerOffset.x;
      const y = ctx.pointer.y - pointerOffset.y;

      ghost.element.style.left = `${x}px`;
      ghost.element.style.top = `${y}px`;

      // 更新rect
      const rect = ghost.getCachedRect();
      ghost.setCachedRect(makeRect(x, y, rect.width, rect.height));
    },

    onSessionEnd(ctx) {
      const ghostEl = ctx.session.ghost?.element;
      if (!ghostEl) return;
      return (resolvedOptions.onDrop || defaultDropAnimation)(ghostEl, ctx);
    },

    onSessionCleanup(ctx) {
      ctx.session.ghost?.element?.remove();
      ctx.session.ghost = null;
      pointerOffset = null;
      resolvedOptions = null;
    },
  };
}
