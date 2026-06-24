/**
 * Hooks：插件钩子总线。
 *
 * fire(name, ctx) 同步广播。ctx._cancelled = true 可短路后续插件。
 * fireAsync(name, ctx) 异步广播。ctx._pendingEnds 收集 Promise，await 后再继续收尾。
 */

// 定义hooks名称枚举
export const HooksEnum = {
  onSessionStart: "onSessionStart",
  onSessionMove: "onSessionMove",
  onSessionLeave: "onSessionLeave",
  onSessionEnd: "onSessionEnd",
  // 跨容器场景，会执行两次
  onSessionEndAsync: "onSessionEndAsync",
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
    const handlers = this.map[name];
    if (!handlers) return;

    const promises = [];
    for (const fn of handlers) {
      const result = fn(ctx);
      // 如果返回值是 Promise，则收集起来
      if (result && typeof result.then === "function") {
        promises.push(result);
      }
      if (ctx && ctx._cancelled) break;
    }
    // 如果有异步插件，等待所有插件执行完毕，再继续后续流程
    if (promises.length) {
      await Promise.all(promises);
    }
  }
}
