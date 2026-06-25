import { dragManager } from "./dragManager.js";
import { Ghost } from "./ghost.js";

/**
 * DragSession：一次拖拽的完整生命周期。
 * 实现拖拽核心逻辑，其它功能（分组限制、动画、preview等）通过容器钩子由插件实现
 *
 * 核心职责：
 *   1. 创建 ghost
 *   2. 持有本次会话的状态（draggedItem / initialIndex / insertIndex / activeContainer / ghost）
 *   3. 每帧计算当前活动容器和落点 insertIndex
 *   4. 跨容器切换时通知容器（releaseDrag / acceptDrag）
 *   5. 结束时提交 DOM 变更（takeNode / dropNode），触发回调
 *
 * 会话态都放在 session 实例上，由容器方法显式读写。
 */
export class DragSession {
  constructor({ sourceContainer, initialIndex, pointerEvent }) {
    this.sourceContainer = sourceContainer;
    this.initialIndex = initialIndex;
    this.pointerEvent = pointerEvent;
    this.draggedItem = sourceContainer.items[initialIndex];

    // 可变状态
    this.activeContainer = sourceContainer;
    this.insertIndex = initialIndex;
    this.ghost = null; // Ghost 实例

    // 最新指针位置
    this.pointer = { x: pointerEvent.clientX, y: pointerEvent.clientY };

    // rAF 句柄
    this.rafId = null;
  }

  // ==================== 启动 ====================
  start() {
    // 创建并添加 ghost，全局唯一的
    const itemEl = this.draggedItem.element;
    this.ghost = new Ghost(itemEl, this.pointerEvent);
    this.ghost.mount();

    // 通知源容器开始拖拽，容器做拖拽前的准备
    this.sourceContainer.acceptDrag(this);

    // 启动渲染循环
    this.rafId = requestAnimationFrame(this._frame);

    // 触发 onStart 回调
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
    // 1. 更新ghost位置
    this.ghost.syncToPointer(this.pointer);

    // 2. 识别当前拖动到的容器，如果不一样则切换容器
    const prev = this.activeContainer;
    const next = this._resolveActiveContainer();

    if (next !== prev) {
      if (prev) prev.releaseDrag(this);
      if (next) next.acceptDrag(this);
      this.activeContainer = next;
    }

    // 3. 更新落点
    if (next) {
      this.insertIndex = next.updateDrag(this);
    }

    this.rafId = requestAnimationFrame(this._frame);
  };

  // ==================== 结束 ====================
  async end() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const target = this.activeContainer;
    const from = this.sourceContainer;
    const to = target;
    const oldIndex = this.initialIndex;
    const item = this.draggedItem.element;

    const committed = this._shouldCommitDomChange(
      target,
      this.insertIndex,
      oldIndex,
      from,
      to,
    );

    // 对外的 newIndex：与 oldIndex 同坐标系（items 坐标）
    // - 已提交：直接用 insertIndex，它就是"提交后 dragged 在 items 中的位置"
    // - 未提交（被拒、容器外、没动）：报 oldIndex，表示"等于原位"
    const newIndex = committed ? this.insertIndex : oldIndex;

    const evt = {
      item,
      from: from.containerEl,
      to: to ? to.containerEl : null,
      oldIndex,
      newIndex,
    };

    // 提交 DOM 变更
    if (committed) {
      const node = from.takeNode(this);
      to.dropNode(this, node);

      if (from !== to) {
        from.triggerEvent("onRemove", evt);
        to.triggerEvent("onAdd", evt);
      }
    }

    from.triggerEvent("onEnd", evt);

    // 根据当前在哪个容器，哪个容器先endDrag
    const order = [];

    if (this.activeContainer) order.push(this.activeContainer);
    if (from && !order.includes(from)) order.push(from);

    for (const c of order) {
      await c.endDrag(this);
    }

    this.ghost.unmount();
    this.ghost = null;
  }

  _shouldCommitDomChange(target, newIndex, oldIndex, from, to) {
    // 只有当目标容器存在、落点合法（非 null），并且发生了实际变更时才提交 DOM 变更
    return (
      !!target && newIndex != null && (oldIndex !== newIndex || from !== to)
    );
  }

  // ==================== 容器解析 ====================
  _resolveActiveContainer() {
    const hovered =
      dragManager.containers.find((c) =>
        c.containsPoint(this.pointer.x, this.pointer.y),
      ) ?? null;

    return hovered;
  }
}
