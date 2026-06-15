import { mountStylesToHead } from "./style.js";
import { CSS } from "./constant.js";

export class DragContainer {
  container = null;
  // 当前被拖拽的元素
  currentDragItem = null;
  // 幽灵元素
  ghostElement = null;
  offsetX = 0;
  offsetY = 0;

  constructor(container) {
    this.container = container;

    this.init();
  }

  init() {
    // 将样式挂载到head中
    mountStylesToHead();
    this.initStructure(this.container);
    this.initEvent();
  }

  // 初始化拖拽容器结构
  initStructure() {
    // 最外层容器
    this.container.classList.add(CSS.dragContainer);
    // 内部包裹层
    const frg = document.createDocumentFragment();
    // this.container.children是动态的
    // 不能直接使用forEach遍历，否则会有问题
    const wrapperItems = Array.from(this.container.children);

    for (let i = 0; i < wrapperItems.length; i++) {
      const item = wrapperItems[i];
      const wrapper = document.createElement("div");
      wrapper.classList.add(CSS.dragDraggableWrapper);
      wrapper.appendChild(item);
      frg.appendChild(wrapper);
    }
    this.container.innerHTML = "";
    this.container.appendChild(frg);
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

    return ghostWrapper;
  }

  // 更新幽灵元素位置
  updateGhostPosition(x, y) {
    if (this.ghostElement) {
      this.ghostElement.style.left = `${x}px`;
      this.ghostElement.style.top = `${y}px`;
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

    // 隐藏被点击的元素
    draggableItem.style.visibility = "hidden";
    this.currentDragItem = draggableItem;

    // 创建幽灵元素
    this.ghostElement = this.createGhostElement(this.currentDragItem);
    // 添加到container容器中
    this.container.appendChild(this.ghostElement);

    // 保存偏移量
    const rect = this.currentDragItem.getBoundingClientRect();
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
  };

  handleMouseUp = (e) => {
    // 删除幽灵元素，并且将被点击的元素显示
    if (this.ghostElement) {
      this.ghostElement.remove();
      this.ghostElement = null;
    }

    // 显示被点击的元素
    if (this.currentDragItem) {
      this.currentDragItem.style.visibility = "visible";
    }

    this.destroyEvents();
  };
}
