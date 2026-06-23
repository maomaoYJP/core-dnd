/**
 * GhostStyle：拖拽过程中给 ghost 加视觉样式
 */
export function ghostStylePlugin(options = {}) {
  const {
    tilt = 1,
    scale = 1,
    duration = 200,
    easing = "ease-in-out",
  } = options;

  return {
    name: "ghostStyle",

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
  };
}
