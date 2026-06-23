import { CSS } from "../constant.js";

/**
 * Ghost：拖拽过程中跟随鼠标移动
 *
 * 职责：
 *   1. 基于源元素克隆生成ghost，挂到 document.body
 *   2. 记录点击时相对 ghost 左上角的偏移，整次拖拽保持不变
 *   3. 按指针位置更新自身坐标，并同步维护 rect
 *   4. 拖拽结束时从 DOM 移除
 */
export class Ghost {
  element = null;
  rect = null;

  _pointerOffset = { x: 0, y: 0 };

  constructor(sourceEl, pointerEvent) {
    const { element, rect } = this.init(sourceEl, pointerEvent);
    this.element = element;
    this.rect = rect;

    // 鼠标点击位置相对 ghost 左上角的偏移
    this._pointerOffset = {
      x: pointerEvent.clientX - rect.left,
      y: pointerEvent.clientY - rect.top,
    };
  }

  // init
  init(sourceEl, pointerEvent) {
    const rect = sourceEl.getBoundingClientRect();

    const clone = sourceEl.cloneNode(true);
    clone.style.visibility = "visible";
    clone.style.width = "100%";
    clone.style.height = "100%";

    const wrapper = document.createElement("div");
    wrapper.classList.add(CSS.dragGhost);
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    wrapper.style.left = `${rect.left}px`;
    wrapper.style.top = `${rect.top}px`;
    wrapper.appendChild(clone);
    return {
      element: wrapper,
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

  mount() {
    document.body.appendChild(this.element);
  }

  syncToPointer(pointer) {
    const x = pointer.x - this._pointerOffset.x;
    const y = pointer.y - this._pointerOffset.y;

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    this.rect = {
      left: x,
      top: y,
      right: x + this.rect.width,
      bottom: y + this.rect.height,
      width: this.rect.width,
      height: this.rect.height,
    };
  }

  unmount() {
    if (this.element) {
      this.element.remove();
    }
    this.element = null;
  }
}
