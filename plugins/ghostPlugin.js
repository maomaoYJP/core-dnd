import { Ghost } from "../core/ghost.js";

/**
 * ghostPlugin：拖拽过程中跟随指针的 ghost 元素。
 *
 * 该插件托管 Ghost 的完整生命周期：
 *   - onBeforeSessionStart：基于 draggedItem 创建并挂载 ghost，写入 session.ghost
 *   - onSessionStart：给 ghost 加上倾斜/缩放等视觉样式
 *   - onSessionFrame：每帧最先触发，将 ghost 同步到当前指针位置
 *   - onSessionCleanup：卸载 ghost，清理 session.ghost
 *
 *
 * ghost 是核心视觉，默认由 DragManager 自动注册；用户也可以替换为自定义实现。
 *
 * options：
 *   - tilt：拖拽时 ghost 的倾斜角度（deg），默认 1
 *   - scale：拖拽时 ghost 的缩放比例，默认 1
 *   - duration：过渡时长（ms），默认 200
 *   - easing：过渡曲线，默认 "ease-in-out"
 */
export function ghostPlugin(options = {}) {
  const {
    tilt = 1,
    scale = 1,
    duration = 200,
    easing = "ease-in-out",
  } = options;

  return {
    name: "ghost",

    onBeforeSessionStart(ctx) {
      const session = ctx.session;
      const ghost = new Ghost(
        session.draggedItem.element,
        session.pointerEvent,
      );
      ghost.mount();
      session.ghost = ghost;
    },

    onSessionStart(ctx) {
      const el = ctx.ghost?.element;
      if (!el) return;

      el.style.transition = `transform ${duration}ms ${easing}`;
      el.style.transformOrigin = "center center";

      // 先放到初始态，下一帧再切换到目标态，保证浏览器能识别为过渡
      el.style.transform = "rotate(0deg) scale(1)";
      requestAnimationFrame(() => {
        el.style.transform = `rotate(${tilt}deg) scale(${scale})`;
      });
    },

    onBeforeSessionFrame(ctx) {
      ctx.ghost?.syncToPointer(ctx.pointer);
    },

    onSessionCleanup(ctx) {
      ctx.session.ghost?.unmount();
      ctx.session.ghost = null;
    },
  };
}
