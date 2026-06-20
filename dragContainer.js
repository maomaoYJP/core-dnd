import { dragManager } from "./dragManager.js";
import { CSS } from "./constant.js";

export class DragContainer {
  constructor(containerElement) {
    //{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}
    this.container = { element: containerElement, rawRect: null, rect: null };
    // [{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}, ...]
    this.draggableItems = [];

    this.initialIndex = null; // 拖动开始时被点击的元素的 index，由 session 传入
    this.initialScrollTop = 0; // 拖动开始时 container 的 scrollTop

    this.previewItem = {};

    // 自动滚动配置：threshold 为触发区宽度(px)，speed 为像素/帧
    this.scrollConfig = { threshold: 20, minSpeed: 5, maxSpeed: 20 };

    this.initStructure();
    this.refreshRects();

    dragManager.registerContainer(this);
  }

  // ===== 初始化 =====
  initStructure() {
    // 把 children 包一层 .drag-draggable-wrapper（原 initStructure 逻辑）
    // 最外层容器
    this.container.element.classList.add(CSS.dragContainer);
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
  startSession(initialIndex) {
    this.initialIndex = initialIndex;

    this.refreshRects();

    // 隐藏被拖动的元素
    const draggableItem = this.draggableItems[this.initialIndex].element;
    draggableItem.style.visibility = "hidden";

    this.initialScrollTop = this.container.element.scrollTop;
  }

  onSession() {
    // 拖动过程中需要做的事
    this.draggableItems.forEach((item) => {
      if (!item.element.classList.contains(CSS.animated)) {
        item.element.classList.add(CSS.animated);
      }
    });
  }

  // 收尾工作
  endSession() {
    // 恢复被拖动的元素的可见性
    const draggableItem = this.draggableItems[this.initialIndex].element;
    draggableItem.style.visibility = "visible";

    // 移除 animated 类
    this.draggableItems.forEach((item) => {
      item.element.classList.remove(CSS.animated);
      item.element.style.transform = "translateY(0)";
    });

    // 清理预览元素
    this.removePreview();

    // 重置rect
    this.refreshRects();
  }

  // ==================== 排序相关 ====================
  // 二分查找：ghost 中心落在哪个插入位之前
  // initialScrollTop 由 Session 传入，用于 scroll 修正
  getInsertIndex(ghostRect) {
    const ghostCenterY = ghostRect.top + ghostRect.height / 2;
    const ghostCenterX = ghostRect.left + ghostRect.width / 2;

    const scrollTop = this.container.element.scrollTop;

    // 二分查找用 viewport 绝对坐标，因为 item.rect.top 也是 viewport 绝对坐标
    let low = 0;
    let high = this.draggableItems.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const item = this.draggableItems[mid];
      const translateY =
        this.getTranslateY(item) - scrollTop + this.initialScrollTop;
      const top = item.rect.top + translateY;
      const bottom = top + item.rect.height;
      const midpoint = (top + bottom) / 2;

      if (ghostCenterY < midpoint) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    return low;
  }

  // ===== 拖动期间的动作（Session 调） =====
  // 让位动画：把 (initialIndex, insertIndex) 区间的元素平移
  reflow(initialIndex, insertIndex) {
    // 如果移出了容器外，所有元素回到原位
    if (insertIndex === -1 || insertIndex === initialIndex) {
      this.draggableItems.forEach((item) => {
        item.element.style.transform = "translateY(0)";
      });

      return;
    }

    const initialItem = this.draggableItems[initialIndex];

    // 计算一个身位的距离距离为被拖动元素的top
    // 和下一个元素top的差值,如果是最后一个元素，则使用它的top到底部的距离作为身位距离
    const step =
      initialIndex < this.draggableItems.length - 1
        ? this.draggableItems[initialIndex + 1].rect.top - initialItem.rect.top
        : this.container.rawRect.bottom - initialItem.rect.top;

    this.draggableItems.forEach((item, index) => {
      // 1. 被拖拽元素本身，不参与 translate 位移（它隐藏在原位，由 ghost 代替移动）
      if (index === initialIndex) {
        item.element.style.transform = "translateY(0)";
        return;
      }

      // 2. 向下拖，这里是相对一开始的位置来判断的
      // 不是相对上一次的位置来判断的
      if (insertIndex > initialIndex) {
        // insert-before 语义：ghost 落在 item[insertIndex] 之前
        // 需要让位的是 (initialIndex, insertIndex) 区间的元素
        if (index > initialIndex && index < insertIndex) {
          item.element.style.transform = `translateY(${-step}px)`;
        } else {
          item.element.style.transform = "translateY(0)";
        }
      }
      // 3. 向上拖（从大索引拖到小索引）
      else {
        // insert-before 语义：ghost 落在 item[insertIndex] 之前
        // 需要让位的是 [insertIndex, initialIndex) 区间的元素
        if (index >= insertIndex && index < initialIndex) {
          item.element.style.transform = `translateY(${step}px)`;
        } else {
          item.element.style.transform = "translateY(0)";
        }
      }
    });
  }

  // 自动滚动（纯函数）：根据 ghost 到边界的距离算出方向和速度，不实际滚动
  // direction: -1 向上 / 0 不滚 / 1 向下；speed 单位为像素/帧
  getScrollIntent(ghostRect) {
    const { threshold, minSpeed, maxSpeed } = this.scrollConfig;
    const containerRect = this.container.rect;

    const top = ghostRect.top - containerRect.top;
    const bottom = containerRect.bottom - ghostRect.bottom;

    // 距离越近(distance 越小) 速度越大，在 [minSpeed, maxSpeed] 间线性插值
    const calcSpeed = (distance) => {
      const ratio = (threshold - distance) / threshold; // 0~1
      return minSpeed + (maxSpeed - minSpeed) * ratio;
    };

    if (top < threshold) {
      return { direction: -1, speed: calcSpeed(top) };
    }
    if (bottom < threshold) {
      return { direction: 1, speed: calcSpeed(bottom) };
    }
    return { direction: 0, speed: 0 };
  }

  // 实际滚动容器
  scrollBy(delta) {
    this.container.element.scrollTop += delta;
  }

  // ===== 结束时（Session 调） =====
  reorderDOM(initialIndex, insertIndex) {
    if (
      initialIndex === -1 ||
      insertIndex === -1 ||
      initialIndex === insertIndex
    ) {
      return;
    }

    const container = this.container.element;
    const initialItem = this.draggableItems[initialIndex];

    if (insertIndex >= this.draggableItems.length) {
      container.appendChild(initialItem.element);
    } else {
      const targetItem = this.draggableItems[insertIndex];
      container.insertBefore(initialItem.element, targetItem.element);
    }
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
    // 设置预览元素的位置和尺寸，rect是相对于viewport的，所以需要减去container的偏移
    const rect = element.getBoundingClientRect();
    const containerRect = this.container.rawRect;
    // 还有scrollTop的偏移
    const scrollTop = this.container.element.scrollTop;
    previewWrapper.style.left = `${rect.left - containerRect.left}px`;
    previewWrapper.style.top = `${rect.top - containerRect.top + scrollTop}px`;
    previewWrapper.style.height = `${rect.height}px`;
    previewWrapper.style.width = `${rect.width}px`;

    const previewInner = document.createElement("div");
    previewInner.classList.add(CSS.dragDropPreviewFlexContainer);
    const previewContent = document.createElement("div");
    previewContent.classList.add(
      CSS.dragDropPreviewInner,
      CSS.dragDropPreviewDefault,
    );
    previewInner.appendChild(previewContent);
    previewWrapper.appendChild(previewInner);

    // 预览元素的rawRect和rect属性
    const readRect = this.readRect(rect);
    readRect.top = readRect.top - containerRect.top + scrollTop;
    readRect.bottom = readRect.top + readRect.height;
    this.previewItem = {
      element: previewWrapper,
      rawRect: rect,
      rect: readRect,
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
    const previewEl = this.previewItem.element;
    const rawTop = this.previewItem.rect.top;

    if (insertIndex === -1 || insertIndex === initialIndex) {
      previewEl.style.top = `${rawTop}px`;
      return;
    }

    const items = this.draggableItems;
    const containerTop = this.container.rawRect.top;
    const initialItem = items[initialIndex];

    let newTop;
    const scrollTop = this.container.element.scrollTop;
    if (insertIndex >= items.length) {
      const last = items[items.length - 1];
      newTop =
        last.rect.bottom -
        initialItem.rect.height -
        containerTop +
        this.initialScrollTop;
    } else {
      // 中间：preview 占据 item[insertIndex] 上方"被让出的 slot"
      // step = 一整个身位（initialHeight + gap），从相邻 item 的 rect 差推出
      const step =
        initialIndex < items.length - 1
          ? items[initialIndex + 1].rect.top - initialItem.rect.top
          : this.container.rawRect.bottom - initialItem.rect.top;
      const target = items[insertIndex];
      const targetVisualTop =
        target.rect.top -
        containerTop +
        this.initialScrollTop +
        this.getTranslateY(target);
      newTop = targetVisualTop - step;
    }

    previewEl.style.top = `${newTop}px`;
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

  getTranslateY(item) {
    const transform = item.element.style.transform;
    if (!transform) return 0;
    // translateY 值通常是小数，必须匹配带小数点的形式
    const match = transform.match(/translateY\((-?[\d.]+)px\)/);
    return match ? parseFloat(match[1]) : 0;
  }
}
