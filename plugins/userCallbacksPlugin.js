/**
 * userCallbacksPlugin：把容器 options 里的用户回调（onStart / onMove / onAdd / onRemove / onEnd）
 * 转发为插件钩子。默认随 DragManager 自动注册，用户一般不需要手动 use()。
 *
 * 触发时间线（与内部 hooks 的对应关系）：
 *   onSessionStart  → 源容器 onStart
 *   onSessionFrame  → 活动容器 onMove（返回 false 时把 session.insertIndex 置 null，等价于拒绝落点）
 *   onSessionEnd    → 源容器 onRemove + 目标容器 onAdd（仅当 committed 且跨容器）
 *                    源容器 onEnd
 *
 * 注意：本插件必须在 preview / reflow 等读 ctx.insertIndex 的插件之前注册，
 * 这样它对 onMove 的拒绝（insertIndex = null）才能被后续插件看到。
 * DragManager 在构造时即注册，保证这一顺序。
 */
export function userCallbacksPlugin() {
  return {
    name: "userCallbacks",

    onSessionStart(ctx) {
      const session = ctx.session;
      const from = session.sourceContainer;
      from.triggerEvent("onStart", {
        item: session.draggedItem.element,
        from: from.containerEl,
        oldIndex: session.initialIndex,
      });
    },

    onSessionFrame(ctx) {
      const session = ctx.session;
      const next = session.activeContainer;
      if (!next) return;

      const accepted = next.triggerEvent("onMove", {
        item: session.draggedItem.element,
        from: session.sourceContainer.containerEl,
        to: next.containerEl,
        related: session.related,
        willInsertAfter: session.willInsertAfter,
      });
      // 用户显式返回 false 视为拒绝；其余（含 undefined）保留 session 已设的落点
      if (accepted === false) session.insertIndex = null;
    },

    onSessionEnd(ctx) {
      const session = ctx.session;
      const from = session.sourceContainer;
      const to = session.activeContainer;

      // 此时 releaseDrag 尚未运行，session.insertIndex 仍是本次提交的落点。
      // committed=false 时（用户拒绝 / 落点非法 / 未实际变更）回到原位。
      const newIndex = session.committed
        ? session.insertIndex
        : session.initialIndex;

      const evt = {
        item: session.draggedItem.element,
        from: from.containerEl,
        to: to ? to.containerEl : null,
        oldIndex: session.initialIndex,
        newIndex,
      };

      if (session.committed && from !== to) {
        from.triggerEvent("onRemove", evt);
        to.triggerEvent("onAdd", evt);
      }
      from.triggerEvent("onEnd", evt);
    },
  };
}
