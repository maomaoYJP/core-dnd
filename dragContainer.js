import { dragManager } from "./dragManager.js";
import { CSS } from "./constant.js";
import { Axis } from "./axis.js";

export class DragContainer {
  constructor(containerElement, options = {}) {
    //{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}
    this.container = { element: containerElement, rawRect: null, rect: null };
    // [{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}, ...]
    this.draggableItems = [];

    this.options = options;
    this.ax = new Axis(options.axis || "vertical"); // 默认竖向
    this.group = this.normalizeGroup(options.group);
    this.handle = options.handle || null; // 把手选择器；不传则整个 item 都是把手
    this.filter = options.filter || null; // 黑名单选择器；命中则禁止拖动

    this.initialIndex = null; // 拖动开始时被点击的元素的 index，由 session 传入
    this.initialScrollMain = 0; // 拖动开始时 container 的主轴 scroll
    this.insertIndex = null; // 拖动过程中，幽灵元素落在哪个插入位之前
    this.draggedItem = null; // 被拖动的元素项，由 session 传入
    this.sessionSource = null; // 拖动来源容器，由 session 传入
    this.lastRawIndex = -2; // 上一个插入位置index，用于 onMove 去抖

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
  // ==================== group 相关 ====================
  normalizeGroup(group) {
    // 默认参数
    // pull和put允许值： true | false | function({from,to}) | string[]
    const defaultGroup = {
      name: "default",
      pull: true,
      put: true,
    };
    return { ...defaultGroup, ...group };
  }

  // 我这个元素能不能被拉到 target 容器
  canPullTo(target) {
    // 同容器重排永远允许
    if (target === this) return true;
    const p = this.group.pull;
    if (p === false) return false;
    if (Array.isArray(p)) return p.includes(target.group.name);
    if (typeof p === "function") return !!p({ from: this, to: target });
    return true;
  }

  // 我收不收来自 source 容器的元素
  canPutFrom(source) {
    // 同容器，放行
    if (source === this) return true;
    const p = this.group.put;
    if (p === false) return false;
    if (Array.isArray(p)) return p.includes(source.group.name);
    if (typeof p === "function") return !!p({ from: source, to: this });
    return true;
  }

  // ==================== 事件 相关 ====================
  triggerEvent(name, eventData) {
    return this.options[name]?.(eventData);
  }

  // ==================== session 相关 ====================
  acceptDrag({ initialIndex, draggedItem, sourceContainer }) {
    // 初始化相关状态
    this.initialIndex = initialIndex;
    this.insertIndex = null;
    this.lastRawIndex = -2;
    this.sessionSource = sourceContainer ?? this;
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
    const rawIndex = this.getInsertIndex(ghostRect);

    // 插入的位置不变，直接返回
    if (rawIndex === this.lastRawIndex) return this.insertIndex;
    this.lastRawIndex = rawIndex;

    // 触发 onMove，返回值用于决定是否插入（-1 表示拒绝，回原位）
    const related =
      rawIndex < this.draggableItems.length
        ? this.draggableItems[rawIndex].element
        : null;
    const accepted = this.triggerEvent("onMove", {
      item: this.draggedItem.element,
      from: this.sessionSource.container.element,
      to: this.container.element,
      oldIndex: this.initialIndex,
      newIndex: rawIndex,
      related,
      willInsertAfter: rawIndex > (this.initialIndex ?? -1),
    });

    // 拒绝插入时，effective 置 -1，表示回原位；否则 effective 就是 rawIndex
    let effective = rawIndex;
    if (accepted === false) {
      effective = -1;
    }

    this.insertIndex = effective;

    // 重排元素位置
    this.reflow(this.initialIndex, effective);
    // 更新预览元素位置
    this.updatePreviewPosition(this.initialIndex, effective);

    return effective;
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

  // 让幽灵元素本身飞到目标 slot，再交还给 session 收尾清理
  animateGhostToTarget(ghost, onComplete) {
    if (!ghost || !ghost.element) {
      onComplete();
      return;
    }

    // 没有 preview，无需飞行，直接收尾
    if (!this.previewItem.element) {
      onComplete();
      return;
    }

    const ghostEl = ghost.element;

    // 1) 算主轴局部坐标（容器局部坐标系）
    //    回原位/被拒：被拖元素自己的原始槽位
    //    正常插入：slotMainStart 算出来的插入槽位
    const isBackToOrigin =
      this.insertIndex === null ||
      this.insertIndex === -1 ||
      this.insertIndex === this.initialIndex;

    let localMain;
    if (isBackToOrigin) {
      localMain = this.ax.visualMainStart({
        itemRect: this.draggedItem.rect,
        containerRawRect: this.container.rawRect,
        transformStr: "",
        initialScroll: this.initialScrollMain,
      });
    } else {
      const gap = parseFloat(
        window.getComputedStyle(this.container.element).gap || "0",
      );
      localMain = this.ax.slotMainStart({
        items: this.draggableItems,
        containerRawRect: this.container.rawRect,
        initialScroll: this.initialScrollMain,
        initialIndex: this.initialIndex,
        insertIndex: this.insertIndex,
        gap,
        draggedRect: this.draggedItem.rect,
      });
    }

    // 2) 局部坐标 → 视口坐标
    //    viewportMain = containerRawRect.mainStart + localMain - currentScroll
    //    副轴坐标 preview 全程不参与动画（只在主轴上 transition），所以读它的
    //    实时 boundingClientRect 是安全的，不会像主轴一样踩到中间态
    const currentScroll = this.ax.getScroll(this.container.element);
    const viewportMain =
      this.ax.startOf(this.container.rawRect) + localMain - currentScroll;

    // 副轴坐标直接用 preview 的当前坐标，是绝对正确的
    const viewportCross = this.ax.crossStartOf(this.previewItem.rect);

    const finish = () => {
      ghostEl.removeEventListener("transitionend", finish);
      onComplete();
    };

    ghostEl.classList.add(CSS.animated);
    ghostEl.style[this.ax.keys.startStyle] = `${viewportMain}px`;
    ghostEl.style[this.ax.keys.crossStyle] = `${viewportCross}px`;

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

  // ==================== 把手相关 ====================
  // 判断 mousedown 的 event.target 是否落在合法的把手区域内
  // itemElement 是该 target 所在的 draggable wrapper
  isDraggableTarget(target, itemElement) {
    // 原生交互元素豁免，避免输入框/按钮无法正常使用
    if (/^(?:input|textarea|button|select|option|a)$/i.test(target.tagName)) {
      return false;
    }
    // filter 黑名单优先级最高
    if (this.filter && target.closest(this.filter)) {
      return false;
    }
    // 没配 handle，整个 item 都是把手（保持原行为）
    if (!this.handle) return true;
    // 配了 handle：target 必须在 handle 内，且 handle 必须属于该 item
    const handleEl = target.closest(this.handle);
    return !!handleEl && itemElement.contains(handleEl);
  }
}
