import { CSS } from "./constant.js";

export class DragSession {
  constructor({ manager, sourceContainer, initialIndex, mouseDownEvent }) {
    // 不变量（整次会话不变）
    this.manager = manager;
    this.sourceContainer = sourceContainer;
    this.initialIndex = initialIndex;
    this.mouseDownEvent = mouseDownEvent;
    this.draggedItem = sourceContainer.draggableItems[initialIndex];

    // 可变状态
    this.activeContainer = sourceContainer;
    this.insertIndex = initialIndex;
    this.ghost = null; // {element: HTMLElement,rawRect: DOMRect,rect: DOMRect}

    // 输入状态：最新指针位置，由 mousemove 写入，frame 读取
    this.pointer = { x: 0, y: 0 };
    // 贯穿整次拖拽的渲染循环句柄
    this.rafId = null;
  }

  start(event) {
    const draggedElement = this.draggedItem.element;
    // 创建幽灵元素
    this.createGhostElement(draggedElement);
    document.body.appendChild(this.ghost.element);

    this.sourceContainer.acceptDrag({
      initialIndex: this.initialIndex,
      draggedItem: this.draggedItem,
      sourceContainer: this.sourceContainer,
    });

    // 记录初始指针位置，并启动贯穿整次拖拽的渲染循环
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.rafId = requestAnimationFrame(this.frame);

    // 通知源容器：拖拽已真正开始
    this.sourceContainer.triggerEvent("onStart", {
      item: this.draggedItem.element,
      from: this.sourceContainer.container.element,
      oldIndex: this.initialIndex,
    });
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

    const prev = this.activeContainer;
    const next = this.resolveActiveContainer();
    if (!next) {
      // 排下一帧
      this.rafId = requestAnimationFrame(this.frame);
      return;
    }

    if (next !== prev) {
      if (prev) prev.releaseDrag();
      if (next) {
        const opts = {
          initialIndex: null,
          draggedItem: this.draggedItem,
          sourceContainer: this.sourceContainer,
        };
        // 回到源容器时要带上 initialIndex
        if (next === this.sourceContainer) {
          opts.initialIndex = this.initialIndex;
        }
        next.acceptDrag(opts);
      }
      this.activeContainer = next;
    }

    if (next) {
      const intent = next.getScrollIntent(this.ghost.rect);
      if (intent.direction) next.scrollBy(intent.direction * intent.speed);
      this.insertIndex = next.updateDrag(this.ghost.rect);
    }

    // 排下一帧
    this.rafId = requestAnimationFrame(this.frame);
  };

  resolveActiveContainer() {
    const prev = this.activeContainer;

    const hovered =
      this.manager.containers.find((c) =>
        c.containsPoint(this.pointer.x, this.pointer.y),
      ) ?? null;

    return hovered;
  }

  end(event) {
    // 先停掉渲染循环
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const target = this.activeContainer;

    // 幽灵元素飞到目标 slot（preview 所在位置），飞行结束后再做收尾
    // 飞行期间保持当前画面冻结：被拖元素仍隐藏、其它元素仍让位、preview 仍在
    target.animateGhostToTarget(this.ghost, () => {
      // 在 endDrag 清理状态之前，先把要传给回调的值抓出来
      const from = this.sourceContainer;
      const to = target;
      const oldIndex = this.initialIndex;
      const newIndex = this.insertIndex;
      const item = this.draggedItem.element;
      const evt = {
        item,
        from: from.container.element,
        to: to.container.element,
        oldIndex,
        newIndex,
      };

      // 只有当拖动发生了实际位置变化时才执行 takeNode/dropNode
      // newIndex === -1 表示 onMove 拒绝过，不算移动（避免 takeNode/dropNode 误操作）
      if (newIndex !== -1 && (oldIndex !== newIndex || from !== to)) {
        const node = from.takeNode();
        to.dropNode(node);

        // 跨容器移动：源失去、目标获得
        if (from !== to) {
          from.triggerEvent("onRemove", evt);
          to.triggerEvent("onAdd", evt);
        }
      }

      // DOM 已是最终状态，触发 onEnd（始终在源容器触发）
      from.triggerEvent("onEnd", evt);

      // 两个容器各自收尾（同容器只收一次）
      from.endDrag();
      if (to !== from) {
        to.endDrag();
      }

      this.ghost.element.remove();
      this.ghost = null;
    });
  }

  // ==================== ghost 相关 ====================
  createGhostElement(element) {
    const ghost = element.cloneNode(true);
    // 获取被点击元素的尺寸和位置
    const rect = element.getBoundingClientRect();

    const ghostWrapper = document.createElement("div");
    // 添加样式类
    ghostWrapper.classList.add(CSS.dragGhost);
    ghost.style.visibility = "visible";
    ghost.style.width = "100%";
    ghost.style.height = "100%";
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
