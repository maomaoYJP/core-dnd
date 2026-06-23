/**
 * GhostStyle：拖拽过程中给 ghost 加视觉样式
 */
export function ghostStylePlugin(options = {}) {
  const { tilt = 1, scale = 1 } = options;

  return {
    name: "ghostStyle",

    onSessionStart(ctx) {
      const el = ctx.ghost?.element;
      if (!el) return;

      el.style.transform = `rotate(${tilt}deg) scale(${scale})`;
    },
  };
}
