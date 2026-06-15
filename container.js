import { mountStylesToHead } from "./style.js";
import { CSS } from "./constant.js";

export class DragContainer {
  container = null;

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

    // 绑定mousemove和mouseup事件
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  handleMouseMove = (e) => {
    // 更新幽灵元素位置
    console.log("mousemove", e.clientX, e.clientY);
  };

  handleMouseUp = (e) => {
    // 删除幽灵元素，并且将被点击的元素显示
    console.log("mouseup", e.clientX, e.clientY);
    this.destroyEvents();
  };
}
