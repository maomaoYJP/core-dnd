import { CSS } from "./constant.js";

export class DragSession {
  constructor({ manager, sourceContainer, initialIndex, mouseDownEvent }) {
    // 不变量（整次会话不变）
    this.manager = manager;
    this.sourceContainer = sourceContainer;
    this.initialIndex = initialIndex;
    this.mouseDownEvent = mouseDownEvent;

    // 可变状态
    this.activeContainer = sourceContainer;
    this.insertIndex = initialIndex;
    this.ghost = null; // {element: HTMLElement,rawRect: DOMRect,rect: DOMRect}
    this.offsetX = 0;
    this.offsetY = 0;

    this.preview = null; // {element}
  }

  start(event) {
    // 开始拖动，sourceContainer 做一些准备工作
    this.sourceContainer.startSession(this.initialIndex);

    const draggedElement =
      this.sourceContainer.draggableItems[this.initialIndex].element;
    // 创建幽灵元素
    this.createGhostElement(draggedElement);
    document.body.appendChild(this.ghost.element);
    this.offsetX = event.clientX - this.ghost.rect.left;
    this.offsetY = event.clientY - this.ghost.rect.top;

    // 创建预览元素
    const previewElement =
      this.activeContainer.createPreviewElement(draggedElement);
    // 预览元素添加到 container 中
    this.activeContainer.addPreviewToContainer(previewElement);
  }

  move(event) {
    this.sourceContainer.onSession();
    // 更新幽灵元素位置
    this.updateGhostPosition(
      event.clientX - this.offsetX,
      event.clientY - this.offsetY,
    );

    // 自动滚动
    this.activeContainer.autoScroll(this.ghost.rect);

    // 检测碰撞，得到新的activeContainer和insertIndex
    const insertIndex = this.activeContainer.getInsertIndex(this.ghost.rect);
    if (insertIndex === this.insertIndex) {
      return;
    }
    this.insertIndex = insertIndex;
    // 重排元素位置
    this.activeContainer.reflow(this.initialIndex, insertIndex);
    // 更新预览元素位置
    this.activeContainer.updatePreviewPosition(this.initialIndex, insertIndex);
  }
  end(event) {
    this.ghost.element.remove();
    this.ghost = null;

    // container内部方法更新dom结构
    this.activeContainer.reorderDOM(this.initialIndex, this.insertIndex);

    // 结束，session状态清理
    this.sourceContainer.endSession();
  }

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

    this.ghost = {
      element: ghostWrapper,
      rawRect: rect,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  updateGhostPosition(x, y) {
    if (this.ghost.element) {
      this.ghost.element.style.left = `${x}px`;
      this.ghost.element.style.top = `${y}px`;

      // 同时更新ghost的rect属性
      this.ghost.rect.left = x;
      this.ghost.rect.top = y;
      this.ghost.rect.right = x + this.ghost.rect.width;
      this.ghost.rect.bottom = y + this.ghost.rect.height;
    }
  }
}
