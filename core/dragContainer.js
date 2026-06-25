import { dragManager } from "./dragManager.js";
import { Axis } from "./axis.js";
import { Hooks } from "./hooks.js";
import { CSS } from "../constant.js";
import { HooksEnum } from "./hooks.js";

/**
 * DragContainer：对应容器内部核心操作。
 *
 * 职责（最小核心）：
 *   1. 保存配置（包含 axis、plugins、用户回调）
 *   2. 维护 rect 缓存（container + items）
 *   3. 提交 DOM 变更（takeNode / dropNode）
 *   4. 响应 session 生命周期，并广播给插件
 *   5. 触发用户回调
 *
 * 容器本身不持有任何"本次会话"的状态——所有会话态由 DragSession 持有并显式传入。
 */
export class DragContainer {
  constructor(containerElement, options = {}) {
    this.options = options;
    this.containerEl = containerElement;
    this.axis = new Axis(options.axis || "vertical");

    // 钩子总线：注册所有插件
    this.hooks = new Hooks();
    (options.plugins || []).forEach((p) => this.hooks.register(p));

    // rect 缓存
    this.container = { element: containerElement, rect: null };
    this.items = []; // [{ element, rect }]

    this._initStructure();
    this.refreshRects();

    dragManager.registerContainer(this);
  }

  // =================== 读 ====================
  // 隐藏被拖元素后，剩余可见元素。仅 updateDrag 内部用作几何计算的输入；
  // 对外（插件 ctx、用户回调）一律基于 items 坐标。
  _visibleItems(draggedItem) {
    return draggedItem
      ? this.items.filter((it) => it.element !== draggedItem.element)
      : this.items;
  }

  // ==================== 初始化 ====================
  _initStructure() {
    this.containerEl.classList.add(CSS.dragContainer);
    this.containerEl.classList.add(
      this.axis.isX ? CSS.horizontal : CSS.vertical,
    );

    // 把每个 child 包一层 wrapper，作为统一的可拖动单元
    const frg = document.createDocumentFragment();
    const children = Array.from(this.containerEl.children);
    for (const child of children) {
      const wrapper = document.createElement("div");
      wrapper.classList.add(CSS.dragDraggableWrapper);
      wrapper.appendChild(child);
      frg.appendChild(wrapper);
    }
    this.containerEl.innerHTML = "";
    this.containerEl.appendChild(frg);
  }

  // ==================== rect 维护 ====================
  refreshRects() {
    this.container = {
      element: this.containerEl,
      rect: this._readRect(this.containerEl.getBoundingClientRect()),
    };
    this.items = Array.from(
      this.containerEl.querySelectorAll(`.${CSS.dragDraggableWrapper}`),
    ).map((element) => ({
      element,
      rect: this._readRect(element.getBoundingClientRect()),
    }));
  }

  _readRect(r) {
    const { left, top, right, bottom, width, height } = r;
    return { left, top, right, bottom, width, height };
  }

  // ==================== 查询（manager 用） ====================
  containsPoint(x, y) {
    const r = this.container.rect;
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  }

  findItemIndex(target) {
    return this.items.findIndex((it) => it.element.contains(target));
  }

  // ==================== 用户回调 ====================
  triggerEvent(name, eventData) {
    return this.options[name]?.(eventData);
  }

  // ==================== session 生命周期 ====================
  /**
   * 拖动进入本容器，或本容器是源容器，由 session 在 start / 切换容器时调用。
   * 注意：这里只刷新 rect 并通知插件；具体会话状态由 session 持有。
   */
  acceptDrag(session) {
    // 进入新容器时，session.insertIndex 在本容器坐标系下应当从"未计算"开始
    session.insertIndex = null;
    this.refreshRects();

    // 源容器：隐藏被拖元素
    if (session.sourceContainer === this) {
      session.draggedItem.element.style.visibility = "hidden";
    }

    this.hooks.fire(HooksEnum.onSessionStart, this._ctx(session));
  }

  /**
   * 每帧调用：根据 ghost 当前 rect 算落点，写回 session.insertIndex 并返回。
   */
  updateDrag(session) {
    const ghostRect = session.ghost.rect;
    const visibleItems = this._visibleItems(session.draggedItem);
    const rawIndex = this.axis.findInsertIndex(ghostRect, visibleItems);

    // 描述落点位置：related = 参考元素，willInsertAfter = 是否插在它之后
    // 约定：仅当落到末尾时 willInsertAfter=true，related 为最后一项；
    // 其余情况统一表述为"insert before related"
    let related;
    let willInsertAfter;
    if (visibleItems.length === 0) {
      related = null;
      willInsertAfter = false;
    } else if (rawIndex >= visibleItems.length) {
      related = visibleItems[visibleItems.length - 1].element;
      willInsertAfter = true;
    } else {
      related = visibleItems[rawIndex].element;
      willInsertAfter = false;
    }

    const accepted = this.triggerEvent("onMove", {
      item: session.draggedItem.element,
      from: session.sourceContainer.containerEl,
      to: this.containerEl,
      related,
      willInsertAfter,
    });

    // null = onMove 拒绝（无有效目标位置）；其余 = items 坐标的目标位置
    session.insertIndex = accepted === false ? null : rawIndex;
    this.hooks.fire(HooksEnum.onSessionMove, this._ctx(session));
    return session.insertIndex;
  }

  /**
   * 离开本容器（切换到别的容器之前调用）。
   */
  releaseDrag(session) {
    this.hooks.fire(HooksEnum.onSessionLeave, this._ctx(session));
    session.insertIndex = null;
  }

  /**
   * 整次会话彻底结束
   */
  async endDrag(session) {
    // 异步收尾：插件 onSessionEndAsync 收集 Promise， await 后再继续收尾
    await this.hooks.fireAsync(HooksEnum.onSessionEndAsync, this._ctx(session));
    // 同步的end回调
    this.hooks.fire(HooksEnum.onSessionEnd, this._ctx(session));

    // 源容器：恢复 dragged 可见
    if (session.sourceContainer === this && session.draggedItem) {
      session.draggedItem.element.style.visibility = "visible";
    }

    this.refreshRects();
  }

  // ==================== DOM 提交 ====================
  takeNode(session) {
    const el = session.draggedItem.element;
    this.containerEl.removeChild(el);
    return el;
  }

  dropNode(session, node) {
    const visibleItems = this._visibleItems(session.draggedItem);
    if (session.insertIndex >= visibleItems.length) {
      this.containerEl.appendChild(node);
    } else {
      this.containerEl.insertBefore(
        node,
        visibleItems[session.insertIndex].element,
      );
    }
  }

  // ==================== 给插件的上下文 ====================
  // ctx 的形状保持向后兼容；所有会话态都从 session 上读
  _ctx(session) {
    const isSource = session.sourceContainer === this;
    return {
      container: this,
      axis: this.axis,
      items: this.items,
      draggedItem: session.draggedItem,
      initialIndex: isSource ? session.initialIndex : null,
      insertIndex: session.insertIndex,
      sourceContainer: session.sourceContainer,
      ghost: session.ghost,
      options: this.options,
    };
  }
}
