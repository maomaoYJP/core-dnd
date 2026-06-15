import { mountStylesToHead } from "./style.js";
import { CSS } from "./constant.js";

export class DragContainer {
  //{element: HTMLElement,rawRect: DOMRectrect: DOMRect}
  containerItem = {};

  // 幽灵元素{element: HTMLElement,rawRect: DOMRectrect: DOMRect}
  ghostItem = {};
  offsetX = 0;
  offsetY = 0;

  // 拖动元素的初始index
  initialIndex = -1;
  // 当前碰撞的目标元素index
  targetIndex = -1;
  // [{element: HTMLElement,rawRect: DOMRectrect: DOMRect}, ...]
  draggableItems = [];

  constructor(container) {
    this.containerItem = {
      element: container,
      rawRect: container.getBoundingClientRect(),
    };

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
    this.draggableItems = Array.from(containerElement.children).map((item) => {
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

  // 更新幽灵元素位置
  updateGhostPosition(x, y) {
    if (this.ghostItem.element) {
      this.ghostItem.element.style.left = `${x}px`;
      this.ghostItem.element.style.top = `${y}px`;

      // 同时更新ghostItem的rect属性
      this.ghostItem.rect.left = x;
      this.ghostItem.rect.top = y;
    }
  }

  // 碰撞检测，得到目标index
  getTargetDraggedEleIndex(rect) {
    // rect是 ghostElement 的边界框
    const ghostCenterX = rect.left + rect.width / 2;
    const ghostCenterY = rect.top + rect.height / 2;
    const containerRect = this.containerItem.rawRect;

    // 判断逻辑是，如果拖拽元素中心点在某个元素的范围内，就认为碰撞了
    for (let i = 0; i < this.draggableItems.length; i++) {
      const item = this.draggableItems[i];
      const eleRect = item.rect;
      // 检查 ghostElement 的中心点是否在 ele 的边界框内
      if (
        ghostCenterX >= eleRect.left &&
        ghostCenterX <= eleRect.right &&
        ghostCenterY >= eleRect.top &&
        ghostCenterY <= eleRect.bottom
      ) {
        return i;
      }
    }
    if (
      ghostCenterX < containerRect.left ||
      ghostCenterX > containerRect.right ||
      ghostCenterY < containerRect.top ||
      ghostCenterY > containerRect.bottom
    ) {
      return -1;
    }

    return this.targetIndex;
  }

  // 更新元素位置，使用transform进行位置调整
  reflowWrapperElements(initialIndex, targetIndex) {
    if (
      initialIndex === -1 ||
      targetIndex === -1 ||
      initialIndex === targetIndex
    ) {
      // 如果回到了原位，必须把所有元素的 transform 都清零！
      this.draggableItems.forEach((item) => {
        item.element.style.transform = `translateY(0)`;
      });
      return;
    }

    // 如果targetIndex < initialIndex，说明被拖动元素在向前移动，
    // 需要将index到initialIndex之间的元素向后移动一个位置，
    // 移动的距离为被拖动元素的高度
    const direction = targetIndex > initialIndex ? -1 : 1;
    const initialItem = this.draggableItems[initialIndex];
    const targetItem = this.draggableItems[targetIndex];
    const translateY = direction * initialItem.rect.height;

    // 需要考虑css的 gap 属性
    const gap = parseFloat(
      getComputedStyle(this.containerItem.element).gap || "0",
    );

    const translateYWithGap = translateY + direction * gap;

    for (let i = 0; i < this.draggableItems.length; i++) {
      const item = this.draggableItems[i];
      if (
        i >= Math.min(initialIndex, targetIndex) &&
        i <= Math.max(initialIndex, targetIndex)
      ) {
        item.element.style.transform = `translateY(${translateYWithGap}px)`;
      } else {
        item.element.style.transform = "translateY(0)";
      }
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

    // 隐藏被点击的元素
    draggableItem.style.visibility = "hidden";

    // 创建幽灵元素
    this.ghostItem.element = this.createGhostElement(
      this.draggableItems[this.initialIndex].element,
    );
    // 添加到container容器中
    this.containerItem.element.appendChild(this.ghostItem.element);

    // 保存偏移量
    const rect = this.draggableItems[this.initialIndex].rect;
    this.offsetX = e.clientX - rect.left;
    this.offsetY = e.clientY - rect.top;

    // 绑定mousemove和mouseup事件
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  handleMouseMove = (e) => {
    // 更新幽灵元素位置
    this.updateGhostPosition(
      e.clientX - this.offsetX,
      e.clientY - this.offsetY,
    );

    // 检测碰撞，更新目标index
    const targetIndex = this.getTargetDraggedEleIndex(this.ghostItem.rect);
    if (targetIndex !== this.targetIndex) {
      this.targetIndex = targetIndex;
    }

    // 给元素加入过渡动画
    this.draggableItems.forEach((item) => {
      item.element.classList.add(CSS.animated);
    });

    // 更新元素位置
    this.reflowWrapperElements(this.initialIndex, this.targetIndex);
  };

  handleMouseUp = (e) => {
    // 删除幽灵元素，并且将被点击的元素显示
    if (this.ghostItem.element) {
      this.ghostItem.element.remove();
      this.ghostItem.element = null;
    }

    // 显示被点击的元素
    if (this.draggableItems[this.initialIndex]) {
      this.draggableItems[this.initialIndex].element.style.visibility =
        "visible";
    }

    // 重置变量
    this.resetVariables();

    // 移除过渡动画
    this.draggableItems.forEach((item) => {
      item.element.classList.remove(CSS.animated);
    });

    this.destroyEvents();
  };

  // 重置类内变量
  resetVariables() {
    this.ghostItem = {};
    this.offsetX = 0;
    this.offsetY = 0;
    this.initialIndex = -1;
    this.targetIndex = -1;
  }
}
