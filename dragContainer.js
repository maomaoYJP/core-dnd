import { dragManager } from "./dragManager.js";
import { CSS } from "./constant.js";
import { Axis } from "./axis.js";

export class DragContainer {
  constructor(containerElement, options = {}) {
    //{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}
    this.container = { element: containerElement, rawRect: null, rect: null };
    // [{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}, ...]
    this.draggableItems = [];

    this.ax = new Axis(options.axis || "vertical"); // 默认竖向

    this.initialIndex = null; // 拖动开始时被点击的元素的 index，由 session 传入
    this.initialScrollMain = 0; // 拖动开始时 container 的主轴 scroll
    this.insertIndex = null; // 拖动过程中，幽灵元素落在哪个插入位之前
    this.draggedItem = null; // 被拖动的元素项，由 session 传入

    this.previewItem = {};

    this.initStructure();
    this.refreshRects();

    dragManager.registerContainer(this);
  }

  // ===== 初始化 =====
  initStructure() {
    // 把 children 包一层 .drag-draggable-wrapper（原 initStructure 逻辑）
    // 最外层容器
    this.container.element.classList.add(CSS.dragContainer);
    // 加上方向 class，CSS 通过 .horizontal / .vertical 命中对应规则
    this.container.element.classList.add(
      this.ax.isX ? CSS.horizontal : CSS.vertical,
    );
    // 内部包裹层
    const frg = document.createDocumentFragment();
    // container.children是动态的, 不能直接使用forEach遍历，否则会有问题
    const wrapperItems = Array.from(this.container.element.children);

    for (let i = 0; i < wrapperItems.length; i++) {
      const item = wrapperItems[i];
      const wrapper = document.createElement("div");
      wrapper.classList.add(CSS.dragDraggableWrapper);
      wrapper.appendChild(item);
      frg.appendChild(wrapper);
    }
    this.container.element.innerHTML = "";
    this.container.element.appendChild(frg);
  }

  // ===== rect 状态维护 =====
  // 在 mousedown 触发时 / 拖动结束后 / Session 进入时调用
  refreshRects() {
    const rawRectContainer = this.container.element.getBoundingClientRect();
    this.container = {
      element: this.container.element,
      rawRect: rawRectContainer,
      rect: this.readRect(rawRectContainer),
    };

    // 找到所有的 draggableItems，存储它们的 element、rawRect、rect
    this.draggableItems = Array.from(
      this.container.element.querySelectorAll(`.${CSS.dragDraggableWrapper}`),
    ).map((element) => {
      const rawRect = element.getBoundingClientRect();
      return {
        element: element,
        rawRect: rawRect,
        rect: this.readRect(rawRect),
      };
    });
  }

  // ==================== session 相关 ====================
  acceptDrag({ initialIndex, draggedItem }) {
    // 初始化相关状态
    this.initialIndex = initialIndex;
    this.insertIndex = null;
    this.initialScrollMain = this.ax.getScroll(this.container.element);
    this.draggedItem = draggedItem;
    this.refreshRects();
    // 隐藏被拖动的元素，只有原容器才会隐藏被拖动的元素
    if (this.initialIndex !== null) {
      const draggableItem = this.draggedItem.element;
      draggableItem.style.visibility = "hidden";
    }

    this.draggableItems.forEach((item, index) => {
      // 被拖动的元素会立即隐藏并由 ghost 代替，不需要过渡（否则 visibility
      // 会跟随 transition 延迟到动画结束才隐藏）
      if (index === this.initialIndex) return;
      if (!item.element.classList.contains(CSS.animated)) {
        item.element.classList.add(CSS.animated);
      }
    });

    // 创建preview元素，添加到container中
    const previewElement = this.createPreviewElement(this.draggedItem.element);
    this.addPreviewToContainer(previewElement);
  }

  updateDrag(ghostRect) {
    const insertIndex = this.getInsertIndex(ghostRect);
    if (insertIndex === this.insertIndex) {
      return insertIndex;
    }
    this.insertIndex = insertIndex;

    // 重排元素位置
    this.reflow(this.initialIndex, insertIndex);
    // 更新预览元素位置
    this.updatePreviewPosition(this.initialIndex, insertIndex);

    return insertIndex;
  }

  releaseDrag() {
    this.draggableItems.forEach((item) => {
      this.ax.clearTranslate(item.element);
      item.element.classList.remove(CSS.animated);
    });

    this.removePreview();
    this.insertIndex = null;
  }

  endDrag() {
    if (this.initialIndex !== null) {
      // 恢复被拖动的元素的可见性
      const draggableItem = this.draggedItem.element;
      draggableItem.style.visibility = "visible";
    }
    this.releaseDrag();
    // 重置rect
    this.refreshRects();
  }

  takeNode() {
    // 从 container 中取出被拖动的元素节点
    const draggableElement = this.draggedItem.element;
    this.container.element.removeChild(draggableElement);
    return draggableElement;
  }

  dropNode(node) {
    // 将节点插入到 container 中的正确位置
    if (this.insertIndex >= this.draggableItems.length) {
      this.container.element.appendChild(node);
    } else {
      const targetItem = this.draggableItems[this.insertIndex];
      this.container.element.insertBefore(node, targetItem.element);
    }
  }

  // ==================== 排序相关 ====================
  // 二分查找：ghost 中心落在哪个插入位之前
  getInsertIndex(ghostRect) {
    const currentScroll = this.ax.getScroll(this.container.element);
    return this.ax.findInsertIndex(
      ghostRect,
      this.draggableItems,
      currentScroll,
      this.initialScrollMain,
    );
  }

  // ===== 拖动期间的动作（Session 调） =====
  // 让位动画：把 (initialIndex, insertIndex) 区间的元素沿主轴平移
  reflow(initialIndex, insertIndex) {
    const gap = parseFloat(
      window.getComputedStyle(this.container.element).gap || "0",
    );
    const step = this.ax.step(this.draggedItem.rect, gap);

    // 如果是源容器
    if (this.initialIndex !== null) {
      this.draggableItems.forEach((item, index) => {
        // 1. 被拖拽元素本身，不参与 translate 位移（它隐藏在原位，由 ghost 代替移动）
        if (index === initialIndex) {
          this.ax.clearTranslate(item.element);
          return;
        }

        // 2. 向下/向后拖
        if (insertIndex > initialIndex) {
          // insert-before 语义：ghost 落在 item[insertIndex] 之前
          // 需要让位的是 (initialIndex, insertIndex) 区间的元素
          const distance =
            index > initialIndex && index < insertIndex ? -step : 0;
          this.ax.setTranslate(item.element, distance);
        }
        // 3. 向上/向前拖（从大索引拖到小索引）
        else {
          // insert-before 语义：ghost 落在 item[insertIndex] 之前
          // 需要让位的是 [insertIndex, initialIndex) 区间的元素
          const distance =
            index >= insertIndex && index < initialIndex ? step : 0;
          this.ax.setTranslate(item.element, distance);
        }
      });
    } else if (this.insertIndex !== null && this.insertIndex !== -1) {
      // 目标容器：在 insertIndex 处凭空开一个洞，>= insertIndex 的整体后移
      this.draggableItems.forEach((item, i) => {
        this.ax.setTranslate(item.element, i >= insertIndex ? step : 0);
      });
    } else {
      // 如果移出了容器外，所有元素回到原位
      if (insertIndex === -1 || insertIndex === initialIndex) {
        this.draggableItems.forEach((item) => {
          this.ax.clearTranslate(item.element);
        });
      }
    }
  }

  // 自动滚动：根据 ghost 到边界的距离算出方向和速度，不实际滚动
  getScrollIntent(ghostRect) {
    return this.ax.getScrollIntent(ghostRect, this.container.rect);
  }

  // 实际滚动容器
  scrollBy(delta) {
    this.ax.addScroll(this.container.element, delta);
  }

  // 让幽灵元素本身飞到目标 slot，再交还给 session 收尾（reorderDOM/清理）
  // 目标 slot 就是 preview 当前所在位置；用 fixed 定位的 left/top 直接过渡
  // 飞行结束（或没有 preview 可飞）后调用 onComplete
  animateGhostToTarget(ghost, onComplete) {
    const ghostEl = ghost.element;
    const target = this.previewItem.element;

    // 没有 preview（如拖出容器外），无需飞行，直接收尾
    if (!target) {
      onComplete();
      return;
    }

    // preview 与幽灵元素同宽同位，其视口坐标即为目标落点
    const targetRect = target.getBoundingClientRect();

    const finish = () => {
      ghostEl.removeEventListener("transitionend", finish);
      onComplete();
    };

    // 添加过渡类，改变 left/top 触发飞行动画
    ghostEl.classList.add(CSS.animated);
    ghostEl.style.left = `${targetRect.left}px`;
    ghostEl.style.top = `${targetRect.top}px`;

    ghostEl.addEventListener("transitionend", finish);
  }

  // ==================== preview相关 ====================
  createPreviewElement(element) {
    const previewWrapper = document.createElement("div");
    previewWrapper.classList.add(CSS.dragDropPreviewConstant);
    previewWrapper.classList.add(CSS.animated);

    const rect = element.getBoundingClientRect();

    previewWrapper.style.width = `${rect.width}px`;
    previewWrapper.style.height = `${rect.height}px`;

    const previewInner = document.createElement("div");
    previewInner.classList.add(CSS.dragDropPreviewFlexContainer);
    const previewContent = document.createElement("div");
    previewContent.classList.add(
      CSS.dragDropPreviewInner,
      CSS.dragDropPreviewDefault,
    );
    previewInner.appendChild(previewContent);
    previewWrapper.appendChild(previewInner);

    this.previewItem = {
      element: previewWrapper,
      rawRect: rect,
      rect: {
        left: rect.left,
        top: rect.top,
      },
    };

    return previewWrapper;
  }

  addPreviewToContainer(previewElement) {
    this.container.element.appendChild(previewElement);
  }

  removePreview() {
    if (this.previewItem.element) {
      this.previewItem.element.remove();
    }
    this.previewItem = {};
  }

  updatePreviewPosition(initialIndex, insertIndex) {
    if (!this.previewItem.element) return;

    // 拖回原位 / 移出容器：回到被拖元素的原始槽位
    if (insertIndex === -1 || insertIndex === initialIndex) {
      const offset = this.ax.visualMainStart({
        itemRect: this.previewItem.rect,
        containerRawRect: this.container.rawRect,
        transformStr: "",
        initialScroll: this.initialScrollMain,
      });
      this.ax.setMainStart(this.previewItem.element, offset);
      return;
    }

    // 其余情况（中间 / 尾部、源 / 目标）全部走单一几何源
    const gap = parseFloat(
      window.getComputedStyle(this.container.element).gap || "0",
    );
    const v = this.ax.slotMainStart({
      items: this.draggableItems,
      containerRawRect: this.container.rawRect,
      initialScroll: this.initialScrollMain,
      initialIndex: this.initialIndex,
      insertIndex,
      gap,
      draggedRect: this.draggedItem.rect,
    });
    this.ax.setMainStart(this.previewItem.element, v);
  }

  // ==================== 工具相关 ====================
  readRect(rect) {
    const { left, top, right, bottom, width, height } = rect;
    return { left, top, right, bottom, width, height };
  }

  containsPoint(x, y) {
    // 判断点 (x, y) 是否在容器内，返回布尔值
    return (
      x >= this.container.rect.left &&
      x < this.container.rect.right &&
      y >= this.container.rect.top &&
      y < this.container.rect.bottom
    );
  }

  findItemIndex(element) {
    // 返回 element 在 draggableItems 中的 index，找不到返回 -1
    return this.draggableItems.findIndex((item) =>
      item.element.contains(element),
    );
  }
}
