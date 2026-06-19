import { CSS } from "./constant.js";
import { mountStylesToHead } from "./style.js";
import { DragSession } from "./session.js";

class DragManager {
  constructor() {
    this.containers = [];
    this.session = null;
    this.initEvent();

    mountStylesToHead();
  }

  registerContainer(container) {
    this.containers.push(container);
  }

  unregisterContainer(container) {
    this.containers = this.containers.filter((c) => c !== container);
  }

  initEvent() {
    window.addEventListener("mousedown", this.handleMouseDown);
  }

  handleMouseDown = (event) => {
    // 找到点击的容器类
    const container = this.containers.find((c) => {
      return c.containsPoint(event.clientX, event.clientY);
    });

    if (!container) return;

    // 找到点击的itemIndex
    const itemIndex = container.findItemIndex(event.target);

    if (itemIndex === -1) return;

    this.session = new DragSession({
      manager: this,
      sourceContainer: container,
      initialIndex: itemIndex,
      mouseDownEvent: event,
    });
    this.session.start(event);

    // 监听mousemove和mouseup事件
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  handleMouseMove = (event) => {
    // 如果有session，那么调用session的start方法
    if (this.session) {
      this.session.move(event);
    }
  };

  handleMouseUp = (event) => {
    // 如果有session，那么调用session的end方法
    if (this.session) {
      this.session.end(event);
      this.session = null;
    }
    // 移除mousemove和mouseup事件监听
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  };
}

export const dragManager = new DragManager();
