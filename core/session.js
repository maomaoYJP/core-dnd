import { fireAndAwait, HookNames } from "./hooks.js";

/**
 * DragSession：一次拖拽的完整生命周期。
 *
 * 核心职责：
 *   1. 持有本次会话的状态（draggedItem / initialIndex / insertIndex / activeContainer / ghost）
 *   2. 每帧计算当前活动容器和落点 insertIndex
 *   3. 跨容器切换时通知容器（releaseDrag / acceptDrag）
 *   4. 在生命周期各时间点触发用户回调（onStart / onMove / onAdd / onRemove / onEnd）
 *   5. 结束时提交 DOM 变更（takeNode / dropNode）
 *   6. 在生命周期各时间点触发所有 hook，并提供 ctx（包含本次会话的状态）
 *
 * 触发时间线：
 *   onBeforeSessionStart → container.acceptDrag →
 *   onContainerEnter → onSessionStart →
 *   rAF:【 onBeforeSessionFrame  → onContainerLeave/Enter →
 *   updateDrag → onSessionMove】 →
 *   onBeforeSessionEnd → commit DOM →
 *   onContainerLeave → onSessionEnd → containers endDrag →
 *   onSessionCleanup
 */
export class DragSession {
  constructor({ manager, sourceContainer, initialIndex, pointerEvent }) {
    this.manager = manager;
    this.sourceContainer = sourceContainer;
    this.initialIndex = initialIndex;
    this.pointerEvent = pointerEvent;
    this.draggedItem = sourceContainer.items[initialIndex];

    // 可变状态
    this.activeContainer = sourceContainer;
    this.insertIndex = initialIndex;
    this.ghost = null; // 由 ghostPlugin 在 onBeforeSessionStart 中创建并赋值
    this.committed = false;

    // 最新指针位置
    this.pointer = { x: pointerEvent.clientX, y: pointerEvent.clientY };

    // rAF 句柄
    this.rafId = null;
  }

  // ==================== 启动 ====================
  async start() {
    await fireAndAwait(
      this.manager.hooks,
      HookNames.onBeforeSessionStart,
      this._ctx(),
    );

    // 源容器准备
    this.sourceContainer.acceptDrag(this);

    await fireAndAwait(
      this.manager.hooks,
      HookNames.onContainerEnter,
      this._ctx({ container: this.sourceContainer }),
    );

    await fireAndAwait(
      this.manager.hooks,
      HookNames.onSessionStart,
      this._ctx(),
    );

    // 启动渲染循环
    this.rafId = requestAnimationFrame(this._frame);

    // 触发用户 onStart 回调
    this.sourceContainer.triggerEvent("onStart", {
      item: this.draggedItem.element,
      from: this.sourceContainer.containerEl,
      oldIndex: this.initialIndex,
    });
  }

  // ==================== 指针更新 ====================
  updatePointer(event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }

  // ==================== 渲染循环 ====================
  _frame = () => {
    // onSessionFrame：每帧最先触发
    this.manager.hooks.fire(HookNames.onBeforeSessionFrame, this._ctx());

    // 2. 识别当前拖动到的容器，如果切换则发 leave/enter
    const prev = this.activeContainer;
    const next = this._resolveActiveContainer();

    if (next !== prev) {
      // 先更新 activeContainer，让 ctx.activeContainer 反映"转移后"的状态
      this.activeContainer = next;

      if (prev) {
        prev.releaseDrag(this);
        this.manager.hooks.fire(
          HookNames.onContainerLeave,
          this._ctx({ container: prev }),
        );
      }
      if (next) {
        next.acceptDrag(this);
        this.manager.hooks.fire(
          HookNames.onContainerEnter,
          this._ctx({ container: next }),
        );
      }
    }

    // 3. 更新落点 + 触发用户 onMove 回调
    if (next) {
      const { rawIndex, related, willInsertAfter } = next.updateDrag(this);
      const accepted = next.triggerEvent("onMove", {
        item: this.draggedItem.element,
        from: this.sourceContainer.containerEl,
        to: next.containerEl,
        related,
        willInsertAfter,
      });
      // null = onMove 拒绝（无有效目标位置）；其余 = items 坐标的目标位置
      this.insertIndex = accepted === false ? null : rawIndex;
    }

    this.manager.hooks.fire(HookNames.onSessionFrame, this._ctx());

    this.rafId = requestAnimationFrame(this._frame);
  };

  // ==================== 结束 ====================
  async end() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const from = this.sourceContainer;
    const to = this.activeContainer;
    const oldIndex = this.initialIndex;
    const item = this.draggedItem.element;

    this.committed = this._shouldCommitDomChange(
      to,
      this.insertIndex,
      oldIndex,
      from,
      to,
    );

    // onBeforeSessionEnd：DOM 提交前的最后一刻
    await fireAndAwait(
      this.manager.hooks,
      HookNames.onBeforeSessionEnd,
      this._ctx(),
    );

    // 提交 DOM + 用户回调
    const newIndex = this.committed ? this.insertIndex : oldIndex;
    const evt = {
      item,
      from: from.containerEl,
      to: to ? to.containerEl : null,
      oldIndex,
      newIndex,
    };

    if (this.committed) {
      const node = from.takeNode(this);
      to.dropNode(this, node);

      if (from !== to) {
        from.triggerEvent("onRemove", evt);
        to.triggerEvent("onAdd", evt);
      }
    }
    from.triggerEvent("onEnd", evt);

    // 拖拽结束，如果当前仍有 activeContainer，触发一次离开
    if (this.activeContainer) {
      this.activeContainer.releaseDrag(this);
      await fireAndAwait(
        this.manager.hooks,
        HookNames.onContainerLeave,
        this._ctx({ container: this.activeContainer }),
      );
    }

    // onSessionEnd：DOM 已提交、容器已清理
    await fireAndAwait(this.manager.hooks, HookNames.onSessionEnd, this._ctx());

    // 容器收尾，end所有容器，当前activeContainer优先
    const order = [];
    if (this.activeContainer) {
      order.push(this.activeContainer);
    }
    if (from && !order.includes(from)) {
      order.push(from);
    }
    for (const c of order) c.endDrag(this);

    // onSessionCleanup
    await fireAndAwait(
      this.manager.hooks,
      HookNames.onSessionCleanup,
      this._ctx(),
    );
  }

  _shouldCommitDomChange(target, newIndex, oldIndex, from, to) {
    // 只有当目标容器存在、落点合法（非 null），并且发生了实际变更时才提交 DOM 变更
    return (
      !!target && newIndex != null && (oldIndex !== newIndex || from !== to)
    );
  }

  // ==================== 容器解析 ====================
  _resolveActiveContainer() {
    return (
      this.manager.containers.find((c) =>
        c.containsPoint(this.pointer.x, this.pointer.y),
      ) ?? null
    );
  }

  /**
   * 构造插件钩子用的 ctx。
   */
  _ctx(extra) {
    return {
      session: this,
      sourceContainer: this.sourceContainer,
      activeContainer: this.activeContainer,
      axis: this.sourceContainer.axis,
      draggedItem: this.draggedItem,
      initialIndex: this.initialIndex,
      insertIndex: this.insertIndex,
      ghost: this.ghost,
      pointer: this.pointer,
      committed: this.committed,
      ...extra,
    };
  }
}
