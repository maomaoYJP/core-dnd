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

    this.preview = null; // {element}

    // 输入状态：最新指针位置，由 mousemove 写入，frame 读取
    this.pointer = { x: 0, y: 0 };
    // 贯穿整次拖拽的渲染循环句柄
    this.rafId = null;
  }

  start(event) {
    // 开始拖动，sourceContainer 做一些准备工作
    this.sourceContainer.startSession(this.initialIndex);

    const draggedElement =
      this.sourceContainer.draggableItems[this.initialIndex].element;
    // 创建幽灵元素
    this.createGhostElement(draggedElement);
    document.body.appendChild(this.ghost.element);

    // 创建预览元素
    const previewElement =
      this.activeContainer.createPreviewElement(draggedElement);
    // 预览元素添加到 container 中
    this.activeContainer.addPreviewToContainer(previewElement);

    // 一次性：给参与排序的元素加上动画类
    this.sourceContainer.onSession();

    // 记录初始指针位置，并启动贯穿整次拖拽的渲染循环
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.rafId = requestAnimationFrame(this.frame);
  }

  // mousemove 只更新指针，不做任何计算
  updatePointer(event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }

  // 渲染循环：拖拽全程每帧执行一次（鼠标不动也会跑，从而实现持续滚动）
  frame = () => {
    // 1. 用最新指针更新幽灵元素位置
    const offsetX = this.mouseDownEvent.clientX - this.ghost.rawRect.left;
    const offsetY = this.mouseDownEvent.clientY - this.ghost.rawRect.top;
    this.updateGhostPosition(
      this.pointer.x - offsetX,
      this.pointer.y - offsetY,
    );

    // 2. 自动滚动：容器只负责算速度和滚动，timing 由这里掌控
    const intent = this.activeContainer.getScrollIntent(this.ghost.rect);
    if (intent.direction) {
      this.activeContainer.scrollBy(intent.direction * intent.speed);
    }

    // 3. 重新评估插入位置（滚动后相对位置变化，这里会持续更新排序）
    this.evaluatePosition();

    // 4. 排下一帧
    this.rafId = requestAnimationFrame(this.frame);
  };

  // 计算插入位并按需重排（insertIndex 没变则跳过）
  evaluatePosition() {
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
    // 先停掉渲染循环
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // 幽灵元素飞到目标 slot（preview 所在位置），飞行结束后再做收尾
    // 飞行期间保持当前画面冻结：被拖元素仍隐藏、其它元素仍让位、preview 仍在
    this.activeContainer.animateGhostToTarget(this.ghost, () => {
      this.activeContainer.reorderDOM(this.initialIndex, this.insertIndex);
      this.sourceContainer.endSession();

      this.ghost.element.remove();
      this.ghost = null;
    });
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
