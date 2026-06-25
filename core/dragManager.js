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
    // 上一次 session 还没收尾完，忽略本次按下
    if (this.session) return;

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

  _onMouseUp = async () => {
    if (!this.session) return;

    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);

    // 保证同一时刻只存在一个 session。
    try {
      await this.session.end();
    } catch (err) {
      console.error("[any-drag] session end failed:", err);
    } finally {
      this.session = null;
    }
  };
}

export const dragManager = new DragManager();
