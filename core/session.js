import { fireAndAwait, HookNames } from "./hooks.js";

/**
 * DragSession：一次拖拽的完整生命周期。
 *
 * 核心职责：
 *   1. 持有本次会话的状态（draggedItem / initialIndex / insertIndex / activeContainer / ghost）
 *   2. 每帧计算当前活动容器和落点 insertIndex（含 related / willInsertAfter 描述）
 *   3. 跨容器切换时通知容器（releaseDrag / acceptDrag）
 *   4. 结束时提交 DOM 变更（takeNode / dropNode）
 *   5. 在生命周期各时间点触发所有 hook，并提供 ctx（包含本次会话的状态）
 *
 *
 * 触发时间线：
 *   onBeforeSessionCreate →
 *   onBeforeSessionStart → container.acceptDrag →
 *   onContainerEnter → onSessionStart →
 *   rAF:【 onBeforeSessionFrame  → onContainerLeave/Enter →
 *   updateDrag → onSessionMove】 →
 *   onBeforeSessionEnd → commit DOM →
 *   onSessionEnd → onContainerLeave → containers endDrag →
 *   onSessionCleanup
 */
export class DragSession {
  constructor({ manager, sourceContainer, initialIndex, pointerEvent }) {
    this.manager = manager;
    this.sourceContainer = sourceContainer;
    this.initialIndex = initialIndex;
    this.pointerEvent = pointerEvent;

    // 可变状态
    this.activeContainer = sourceContainer;
    this.insertIndex = initialIndex;

    this.committed = false;

    // userCallbacksPlugin使用的变量
    this.related = null;
    this.willInsertAfter = false;

    // ghostPlugin进行初始化，结构{ element, rect }
    this.ghost = null;

    // 最新指针位置
    this.pointer = { x: pointerEvent.clientX, y: pointerEvent.clientY };

    // rAF 句柄
    this.rafId = null;
  }

  get draggedItem() {
    return this.sourceContainer.items[this.initialIndex];
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
  }

  // ==================== 指针更新 ====================
  updatePointer(event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }

  // ==================== 渲染循环 ====================
  _frame = () => {
    this.manager.hooks.fireSync(HookNames.onBeforeSessionFrame, this._ctx());
    this.manager.rectCache.ensureFresh(this.manager.containers);

    const prev = this.activeContainer;
    const next = this._resolveActiveContainer();
    let containerEnterRejected = false;

    if (next !== prev) {
      const draftCtx = this._ctx({
        container: next,
        _cancelled: false,
        preventDefault() {
          this._cancelled = true;
        },
      });

      // 进入容器前的hook，有可能进入的是空容器
      this.manager.hooks.fireSync(HookNames.onBeforeContainerEnter, draftCtx);

      if (draftCtx._cancelled) {
        containerEnterRejected = true;
        this.insertIndex = null;
        this.related = null;
        this.willInsertAfter = false;
      } else {
        this.activeContainer = next;

        if (prev) {
          prev.releaseDrag(this);
          this.manager.hooks.fireSync(
            HookNames.onContainerLeave,
            this._ctx({ container: prev }),
          );
        }
        if (next) {
          next.acceptDrag(this);
          this.manager.hooks.fireSync(
            HookNames.onContainerEnter,
            this._ctx({ container: next }),
          );
        }
      }
    }

    // 被拒时跳过 updateDrag
    if (next && !containerEnterRejected) {
      const { rawIndex, related, willInsertAfter } = next.updateDrag(this);
      this.insertIndex = rawIndex;
      this.related = related;
      this.willInsertAfter = willInsertAfter;
    }

    this.manager.hooks.fireSync(HookNames.onSessionFrame, this._ctx());

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

    // onBeforeSessionEnd：DOM 提交前的最后一刻
    await fireAndAwait(
      this.manager.hooks,
      HookNames.onBeforeSessionEnd,
      this._ctx(),
    );

    this.committed = this._shouldCommitDomChange(
      to,
      this.insertIndex,
      this.initialIndex,
      from,
      to,
    );

    // 提交 DOM
    if (this.committed) {
      const node = from.takeNode(this);
      to.dropNode(this, node);
    }

    // onSessionEnd：DOM 已提交，但容器尚未释放
    await fireAndAwait(this.manager.hooks, HookNames.onSessionEnd, this._ctx());

    // 拖拽结束，如果当前仍有 activeContainer，触发一次离开
    if (this.activeContainer) {
      this.activeContainer.releaseDrag(this);
      await fireAndAwait(
        this.manager.hooks,
        HookNames.onContainerLeave,
        this._ctx({ container: this.activeContainer }),
      );
    }

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
      manager: this.manager,
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
