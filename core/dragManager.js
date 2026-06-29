import { mountStylesToHead } from "../style.js";
import { DragSession } from "./session.js";
import { DragContainer } from "./dragContainer.js";
import { RectCache } from "./rectCache.js";
import { HookBus, HookNames, fireAndAwait } from "./hooks.js";
import Plugins from "../plugins/index.js";
import { userCallbacksPlugin } from "../plugins/userCallbacksPlugin.js";

/**
 * DragManager：全局输入路由。
 * 监听 pointerdown / pointermove / pointerup 事件，管理拖拽会话（DragSession）。
 */

// 多个manager也只挂载一次
let stylesMounted = false;

export class DragManager {
  constructor() {
    this.containers = [];
    this.session = null;
    this.rectCache = new RectCache();
    this.hooks = new HookBus();

    // 默认注册的插件；用户可调用 use() 追加替换
    // userCallbacks 必须在其它读 insertIndex 的插件之前注册，
    // reflow 的 onSessionEnd 需要早于 ghost：先同步清空 items 的 transform，
    // 再让 ghost 的 drop 飞行动画在干净的布局上播。
    this.hooks.register(Plugins.userCallbacksPlugin());
    this.hooks.register(Plugins.groupPlugin());
    this.hooks.register(Plugins.handlePlugin());
    this.hooks.register(Plugins.previewPlugin());
    this.hooks.register(Plugins.reflowPlugin());
    this.hooks.register(Plugins.ghostPlugin());
    this.hooks.register(Plugins.autoScrollPlugin());

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    this.rectCache.attach();
    window.addEventListener("mousedown", this._onMouseDown);
    if (!stylesMounted) {
      mountStylesToHead();
      stylesMounted = true;
    }
  }

  use(plugin) {
    this.hooks.register(plugin);
    return this;
  }

  // 挂载一个拖拽容器
  mount(el, options = {}) {
    const container = new DragContainer(el, options, this.rectCache);
    this.containers.push(container);
    return container;
  }

  unmount(container) {
    const i = this.containers.indexOf(container);
    if (i >= 0) {
      this.containers.splice(i, 1);
      container.destroy?.();
    }
  }

  destroy() {
    window.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
    this.rectCache.detach();
    for (const c of this.containers) {
      c.destroy?.();
    }
    this.containers = [];
    this.session = null;
  }

  async _onMouseDown(event) {
    // 上一次 session 还没收尾完，忽略本次按下
    if (this.session) return;

    const container = this.containers.find((c) =>
      c.containsPoint(event.clientX, event.clientY),
    );
    if (!container) return;

    const itemIndex = container.findItemIndex(event.target);
    if (itemIndex === -1) return;

    // onBeforeSessionCreate 阶段，用户可 preventDefault 阻止 session 创建
    const draftCtx = {
      manager: this,
      sourceContainer: container,
      draggedItem: container.items[itemIndex],
      initialIndex: itemIndex,
      pointerEvent: event,
      _cancelled: false,
      preventDefault() {
        this._cancelled = true;
      },
    };
    await fireAndAwait(this.hooks, HookNames.onBeforeSessionCreate, draftCtx);
    if (draftCtx._cancelled) return;

    this.session = new DragSession({
      manager: this,
      sourceContainer: container,
      initialIndex: itemIndex,
      pointerEvent: event,
    });
    this.session.start();

    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  _onMouseMove(event) {
    if (this.session) this.session.updatePointer(event);
  }

  async _onMouseUp() {
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
  }
}
