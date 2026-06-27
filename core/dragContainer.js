import { Axis } from "./axis.js";
import { CSS } from "../constant.js";

/**
 * DragContainer：对应容器内部核心操作。
 *
 * 职责（最小核心）：
 *   1. 保存配置（包含 axis、用户回调 options）
 *   2. 维护 rect 缓存（container + items）
 *   3. 几何 / 命中查询（containsPoint、findItemIndex、findInsertIndex）
 *   4. DOM 提交（takeNode / dropNode）
 *   5. 暴露 triggerEvent 给 session 转发用户回调（onStart / onMove / onEnd / onAdd / onRemove）
 */
export class DragContainer {
  constructor(containerElement, options = {}) {
    this.options = options;
    this.containerEl = containerElement;
    this.axis = new Axis(options.axis || "vertical");

    // rect 缓存
    this.container = { element: containerElement, rect: null };
    this.items = []; // [{ element, rect }]

    this._initStructure();
    this.refreshRects();
  }

  // =================== 读 ====================
  // 隐藏被拖元素后，剩余可见元素。仅 updateDrag 内部用作几何计算的输入；
  // 对外（插件 ctx、用户回调）一律基于 items 坐标。
  _visibleItems(draggedItem) {
    return draggedItem
      ? this.items.filter((it) => it.element !== draggedItem.element)
      : this.items;
  }

  isSource(container) {
    return container === this;
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

  // 还原 DOM
  destroy() {
    this.containerEl.classList.remove(
      CSS.dragContainer,
      CSS.horizontal,
      CSS.vertical,
    );
    const wrappers = Array.from(
      this.containerEl.querySelectorAll(`.${CSS.dragDraggableWrapper}`),
    );
    for (const wrapper of wrappers) {
      const child = wrapper.firstElementChild;
      if (child) this.containerEl.insertBefore(child, wrapper);
      wrapper.remove();
    }
    this.items = [];
  }

  // ==================== rect 维护 ====================
  // 原地更新 rect 缓存，避免频繁创建新对象。
  refreshRects() {
    this.container.rect = this._readRect(
      this.containerEl.getBoundingClientRect(),
    );

    const elements = Array.from(
      this.containerEl.querySelectorAll(`.${CSS.dragDraggableWrapper}`),
    );
    const byElement = new Map(this.items.map((it) => [it.element, it]));

    this.items = elements.map((element) => {
      const rect = this._readRect(element.getBoundingClientRect());
      const existing = byElement.get(element);
      if (existing) {
        existing.rect = rect;
        return existing;
      }
      return { element, rect };
    });
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
    if (this.isSource(session.sourceContainer)) {
      session.draggedItem.element.style.visibility = "hidden";
    }
  }

  /**
   * 每帧调用：根据 ghost 当前 rect 算落点
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

    return { rawIndex, related, willInsertAfter };
  }

  /**
   * 离开本容器（切换到别的容器之前调用）。
   */
  releaseDrag(session) {
    session.insertIndex = null;
  }

  /**
   * 结束拖拽：源容器恢复 dragged 可见，刷新 rect。
   * 由 session 在所有 hook 都跑完之后调用，纯 DOM 操作不发 hook。
   */
  endDrag(session) {
    // 源容器：恢复 dragged 可见
    if (this.isSource(session.sourceContainer) && session.draggedItem) {
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
}
