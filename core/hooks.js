/**
 * Hooks：插件钩子总线。

 * fire(name, ctx) 同步广播。ctx._cancelled = true 可短路后续插件。
 * ctx._pendingEnds: 用于 onSessionDrop 等异步钩子收集 Promise，
 *                   核心 await 所有 pending 后再继续收尾。
 */

// 定义hooks名称枚举
export const HooksEnum = {
  onSessionStart: "onSessionStart",
  onSessionMove: "onSessionMove",
  onSessionLeave: "onSessionLeave",
  onSessionEnd: "onSessionEnd",
  onSessionDrop: "onSessionDrop",
};

export class Hooks {
  constructor() {
    this.map = {};
  }

  register(plugin) {
    if (!plugin) return;
    for (const key of Object.keys(plugin)) {
      // 只注册HooksEnum中定义的钩子
      if (HooksEnum[key]) {
        if (!this.map[key]) {
          this.map[key] = [];
        }
        this.map[key].push(plugin[key]);
      } else {
        console.warn(`Plugin ${plugin.name} has an unrecognized hook: ${key}`);
      }
    }
  }

  fire(name, ctx) {
    const handlers = this.map[name];
    if (!handlers) return;
    for (const fn of handlers) {
      fn(ctx);
      // 如果 ctx._cancelled 被设置为 true，则停止调用后续插件
      if (ctx && ctx._cancelled) break;
    }
  }

  async fireAsync(name, ctx) {
    if (ctx) ctx._pendingEnds = [];
    this.fire(name, ctx);
    if (ctx && ctx._pendingEnds.length) {
      await Promise.all(ctx._pendingEnds);
    }
  }
}
