import { mountStylesToHead } from "./style.js";
import { CSS } from "./constant.js";

export class DragContainer {
  //{element: HTMLElement,rawRect: DOMRectrect: DOMRect}
  containerItem = {};

  // 注意保存的是相对坐标，是相对container的
  previewItem = {};

  // 幽灵元素{element: HTMLElement,rawRect: DOMRectrect: DOMRect}
  ghostItem = {};
  offsetX = 0;
  offsetY = 0;

  // 拖动元素的初始index
  initialIndex = -1;
  // 当前ghost中心点对应的插入位置index（插入到该index对应元素之前）
  insertIndex = -1;
  // [{element: HTMLElement,rawRect: DOMRectrect: DOMRect}, ...]
  draggableItems = [];

  constructor(container) {
    this.initContainerItem(container);

    this.init();
  }

  init() {
    // 将样式挂载到head中
    mountStylesToHead();
    this.initStructure(this.containerItem.element);
    this.initDraggableItems(this.containerItem.element);
    this.initEvent();
  }

  // 初始化拖拽容器结构
  initStructure(containerElement) {
    // 最外层容器
    containerElement.classList.add(CSS.dragContainer);
    // 内部包裹层
    const frg = document.createDocumentFragment();
    // container.children是动态的
    // 不能直接使用forEach遍历，否则会有问题
    const wrapperItems = Array.from(containerElement.children);

    for (let i = 0; i < wrapperItems.length; i++) {
      const item = wrapperItems[i];
      const wrapper = document.createElement("div");
      wrapper.classList.add(CSS.dragDraggableWrapper);
      wrapper.appendChild(item);
      frg.appendChild(wrapper);
    }
    containerElement.innerHTML = "";
    containerElement.appendChild(frg);
  }

  initDraggableItems(containerElement) {
    // 找到dragDraggableWrapper类的元素，并且获取它们的边界框信息
    const wrapperItems = containerElement.querySelectorAll(
      `.${CSS.dragDraggableWrapper}`,
    );

    this.draggableItems = Array.from(wrapperItems).map((item) => {
      const rawRect = item.getBoundingClientRect();
      // rawRect是非枚举属性，所以需要复制一份
      const rect = {
        left: rawRect.left,
        top: rawRect.top,
        right: rawRect.right,
        bottom: rawRect.bottom,
        width: rawRect.width,
        height: rawRect.height,
      };

      return {
        element: item,
        rawRect: { ...rect },
        rect: { ...rect },
      };
    });
  }

  initContainerItem(containerElement) {
    this.containerItem = {
      element: containerElement,
      rawRect: containerElement.getBoundingClientRect(),
    };
  }

  initEvent() {
    // 事件监听器
    window.addEventListener("mousedown", this.handleMouseDown);
  }

  // 根据传来元素创建幽灵元素
  createGhostElement(element) {
    const ghost = element.cloneNode(true);
    // 获取被点击元素的尺寸和位置
    const rect = element.getBoundingClientRect();

    const ghostWrapper = document.createElement("div");
    // 添加样式类
    ghostWrapper.classList.add(CSS.dragGhost);
    ghost.style.visibility = "visible";
    ghostWrapper.style.width = `${rect.width}px`;
    ghostWrapper.style.height = `${rect.height}px`;
    ghostWrapper.style.left = `${rect.left}px`;
    ghostWrapper.style.top = `${rect.top}px`;

    ghostWrapper.appendChild(ghost);

    this.ghostItem = {
      element: ghostWrapper,
      rawRect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    };

    return ghostWrapper;
  }

  // 根据传来元素创建预览元素
  createPreviewElement(element) {
    const previewWrapper = document.createElement("div");
    previewWrapper.classList.add(CSS.dragDropPreviewConstant);
    previewWrapper.classList.add(CSS.animated);
    // 设置预览元素的位置和尺寸，rect是相对于viewport的，所以需要减去container的偏移
    const rect = element.getBoundingClientRect();
    const containerRect = this.containerItem.rawRect;
    // 还有scrollTop的偏移
    const scrollTop = this.containerItem.element.scrollTop;
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
    this.previewItem = {
      element: previewWrapper,
      rawRect: {
        top: rect.top - containerRect.top + scrollTop,
        height: rect.height,
        width: rect.width,
      },
      rect: {
        top: rect.top - containerRect.top + scrollTop,
        height: rect.height,
        width: rect.width,
      },
    };

    return previewWrapper;
  }

  // 更新幽灵元素位置
  updateGhostPosition(x, y) {
    if (this.ghostItem.element) {
      this.ghostItem.element.style.left = `${x}px`;
      this.ghostItem.element.style.top = `${y}px`;

      // 同时更新ghostItem的rect属性
      this.ghostItem.rect.left = x;
      this.ghostItem.rect.top = y;
      this.ghostItem.rect.right = x + this.ghostItem.rect.width;
      this.ghostItem.rect.bottom = y + this.ghostItem.rect.height;
    }
  }

  // 更新预览元素位置
  updatePreviewPosition(initialIndex, insertIndex) {
    if (!this.previewItem.element) return;
    const previewEl = this.previewItem.element;
    const rawTop = this.previewItem.rawRect.top;

    if (insertIndex === -1 || insertIndex === initialIndex) {
      previewEl.style.top = `${rawTop}px`;
      return;
    }

    const items = this.draggableItems;
    const containerTop = this.containerItem.rawRect.top;
    const initialItem = items[initialIndex];

    let newTop;
    const scrollTop = this.containerItem.element.scrollTop;
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
          : this.containerItem.rawRect.bottom - initialItem.rect.top;
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

  getTranslateY(item) {
    const transform = item.element.style.transform;
    if (!transform) return 0;
    // translateY 值通常是小数，必须匹配带小数点的形式
    const match = transform.match(/translateY\((-?[\d.]+)px\)/);
    return match ? parseFloat(match[1]) : 0;
  }

  // 二分查找插入位置：用 ghost 中心 Y 坐标在元素视觉位置序列中定位
  // 采用 insert-before 语义：insertIndex = i 表示插到 item[i] 之前
  // 范围 [0, N]：0 = 顶部（item[0] 之前），N = 底部（item[N-1] 之后）
  getInsertIndex(rect) {
    const ghostCenterY = rect.top + rect.height / 2;
    const ghostCenterX = rect.left + rect.width / 2;

    // 容器边界判断：ghost 中心是 viewport 坐标，要和 viewport 坐标的容器边界比
    const containerRect = this.containerItem.rawRect;
    if (
      ghostCenterY < containerRect.top ||
      ghostCenterY > containerRect.bottom ||
      ghostCenterX < containerRect.left ||
      ghostCenterX > containerRect.right
    ) {
      return -1;
    }

    const scrollTop = this.containerItem.element.scrollTop;

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

  reflowWrapperElements(initialIndex, insertIndex) {
    // 如果移出了容器外，所有元素回到原位
    if (insertIndex === -1 || insertIndex === initialIndex) {
      this.draggableItems.forEach((item) => {
        item.element.style.transform = "translateY(0)";
      });

      // 预览元素也回到原位
      this.updatePreviewPosition(initialIndex, insertIndex);
      return;
    }

    const initialItem = this.draggableItems[initialIndex];

    // 计算一个身位的距离距离为被拖动元素的top
    // 和下一个元素top的差值,如果是最后一个元素，则使用它的top到底部的距离作为身位距离
    const step =
      initialIndex < this.draggableItems.length - 1
        ? this.draggableItems[initialIndex + 1].rect.top - initialItem.rect.top
        : this.containerItem.rawRect.bottom - initialItem.rect.top;

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

  // 自动滚动容器：当 ghost 元素接近容器边界时，自动滚动容器
  autoScrollContainer() {
    const container = this.containerItem.element;
    const containerRect = this.containerItem.rawRect;
    const ghostRect = this.ghostItem.rect;

    const scrollThreshold = 20; // 距离容器边界多少像素时开始滚动
    const scrollSpeed = 5; // 每次滚动的像素数

    if (ghostRect.top - containerRect.top < scrollThreshold) {
      container.scrollTop -= scrollSpeed;
    } else if (containerRect.bottom - ghostRect.bottom < scrollThreshold) {
      container.scrollTop += scrollSpeed;
    }
  }

  destroyEvents() {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }

  handleMouseDown = (e) => {
    // 判断是否点击了可拖拽项
    const draggableItem = e.target.closest(`.${CSS.dragDraggableWrapper}`);
    if (!draggableItem) {
      return;
    }

    // 拖动元素的初始index
    this.initialIndex = this.draggableItems.findIndex(
      (item) => item.element === draggableItem,
    );

    // 初始化拖拽元素的信息，特别是它的rect属性
    this.initDraggableItems(this.containerItem.element);

    // 隐藏被点击的元素
    draggableItem.style.visibility = "hidden";

    this.draggableItems.forEach((item) => {
      item.element.classList.add(CSS.animated);
    });

    // 创建幽灵元素
    this.ghostItem.element = this.createGhostElement(
      this.draggableItems[this.initialIndex].element,
    );

    // 创建preview元素
    this.previewItem.element = this.createPreviewElement(
      this.draggableItems[this.initialIndex].element,
    );

    // 添加到container容器中
    this.containerItem.element.appendChild(this.ghostItem.element);
    this.containerItem.element.appendChild(this.previewItem.element);

    // 保存偏移量
    const rect = this.draggableItems[this.initialIndex].rect;
    this.offsetX = e.clientX - rect.left;
    this.offsetY = e.clientY - rect.top;

    this.initialScrollTop = this.containerItem.element.scrollTop;

    // 绑定mousemove和mouseup事件
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  handleMouseMove = (e) => {
    this.updateGhostPosition(
      e.clientX - this.offsetX,
      e.clientY - this.offsetY,
    );

    // 如果接近容器边界，自动滚动
    this.autoScrollContainer();

    const insertIndex = this.getInsertIndex(this.ghostItem.rect);
    if (insertIndex === this.insertIndex) {
      return;
    }

    this.insertIndex = insertIndex;

    this.reflowWrapperElements(this.initialIndex, this.insertIndex);
    this.updatePreviewPosition(this.initialIndex, this.insertIndex);
  };

  handleMouseUp = (e) => {
    if (this.ghostItem.element) {
      this.ghostItem.element.remove();
      this.ghostItem.element = null;
    }

    if (this.previewItem.element) {
      this.previewItem.element.remove();
      this.previewItem.element = null;
    }

    if (this.draggableItems[this.initialIndex]) {
      this.draggableItems[this.initialIndex].element.style.visibility =
        "visible";
    }

    this.reorderDOM(this.initialIndex, this.insertIndex);

    this.resetVariables();

    this.draggableItems.forEach((item) => {
      item.element.classList.remove(CSS.animated);
      item.element.style.transform = "translateY(0)";
    });

    this.initDraggableItems(this.containerItem.element);

    this.destroyEvents();
  };

  reorderDOM(initialIndex, insertIndex) {
    if (
      initialIndex === -1 ||
      insertIndex === -1 ||
      initialIndex === insertIndex
    ) {
      return;
    }

    const container = this.containerItem.element;
    const initialItem = this.draggableItems[initialIndex];

    if (insertIndex >= this.draggableItems.length) {
      container.appendChild(initialItem.element);
    } else {
      const targetItem = this.draggableItems[insertIndex];
      container.insertBefore(initialItem.element, targetItem.element);
    }
  }

  // 重置类内变量
  resetVariables() {
    this.ghostItem = {};
    this.offsetX = 0;
    this.offsetY = 0;
    this.initialIndex = -1;
    this.insertIndex = -1;
  }
}
