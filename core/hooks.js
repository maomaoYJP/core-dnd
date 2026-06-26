/**
 * Hooks：插件钩子总线。
 *
 * fire(name, ctx) 同步广播。ctx._cancelled = true 可短路后续插件。
 * fireAsync(name, ctx) 异步广播。ctx._pendingEnds 收集 Promise，await 后再继续收尾。
 */

// 定义hooks名称枚举
export const HookNames = {
  onBeforeSessionStart: "onBeforeSessionStart",
  onSessionStart: "onSessionStart",
  onContainerEnter: "onContainerEnter",
  onSessionMove: "onSessionMove",
  onContainerLeave: "onContainerLeave",
  onBeforeSessionEnd: "onBeforeSessionEnd",
  onSessionEnd: "onSessionEnd",
  onSessionCleanup: "onSessionCleanup",
};
export class HookBus {
  constructor() {
    this.map = {};
  }
  register(plugin) {
    if (!plugin) return;
    for (const key of Object.keys(plugin)) {
      if (!HookNames[key]) {
        console.warn(
          `[any-drag] plugin ${plugin.name || "unknown"} has unknown hook ${key}`,
        );
        continue;
      }

      if (!this.map[key]) {
        this.map[key] = [];
      }
      this.map[key].push(plugin[key]);
    }
  }

  // 统一返回 Promise
  async fire(name, ctx) {
    const handlers = this.map[name];
    if (!handlers || handlers.length === 0) return;

    const snapshot = [...handlers];

    // 我们这里改为串行执行
    for (const handle of snapshot) {
      // 执行前检查取消状态，前面的插件可以打断后续插件
      if (ctx?._cancelled) break;

      let result;
      try {
        result = handle(ctx);
      } catch (err) {
        console.error(`[any-drag] hook ${name} threw`, err);
        continue;
      }

      // 如果返回是异步结果，等待他完成，保证插件的执行顺序
      if (result && typeof result.then === "function") {
        try {
          await result;
        } catch (err) {
          console.error(`[any-drag] async hook ${name} rejected`, err);
        }
      }
    }
  }
}

export async function fireAndAwait(bus, name, ctx) {
  const result = bus.fire(name, ctx);
  if (result) await result;
}

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
