import { mountStylesToHead } from "../style.js";
import { DragSession } from "./session.js";

/**
 * DragManager：全局输入路由。
 * 监听 pointerdown / pointermove / pointerup 事件，管理拖拽会话（DragSession）。
 */
class DragManager {
  constructor() {
    this.containers = [];
    this.session = null;

    window.addEventListener("mousedown", this._onMouseDown);
    mountStylesToHead();
  }

  registerContainer(container) {
    this.containers.push(container);
  }

  unregisterContainer(container) {
    this.containers = this.containers.filter((c) => c !== container);
  }

  _onMouseDown = (event) => {
    const container = this.containers.find((c) =>
      c.containsPoint(event.clientX, event.clientY),
    );
    if (!container) return;

    const itemIndex = container.findItemIndex(event.target);
    if (itemIndex === -1) return;

    this.session = new DragSession({
      sourceContainer: container,
      initialIndex: itemIndex,
      pointerEvent: event,
    });
    this.session.start();

    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
  };

  _onMouseMove = (event) => {
    if (this.session) this.session.updatePointer(event);
  };

  _onMouseUp = () => {
    if (this.session) {
      this.session.end();
      this.session = null;
    }
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
  };
}

export const dragManager = new DragManager();
