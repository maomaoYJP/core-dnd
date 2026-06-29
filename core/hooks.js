/**
 * Hooks：插件钩子总线。
 */

// 定义hooks名称枚举
export const HookNames = {
  onBeforeSessionCreate: "onBeforeSessionCreate",
  onBeforeSessionStart: "onBeforeSessionStart",
  onSessionStart: "onSessionStart",
  onContainerEnter: "onContainerEnter",
  onBeforeSessionFrame: "onBeforeSessionFrame",
  onSessionFrame: "onSessionFrame",
  onContainerLeave: "onContainerLeave",
  onBeforeContainerEnter: "onBeforeContainerEnter",
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
      if (!HookNames[key] && key !== "name") {
        console.warn(
          `[core-dnd] plugin ${plugin.name || "unknown"} has unknown hook ${key}`,
        );
        continue;
      }

      if (!this.map[key]) {
        this.map[key] = [];
      }
      this.map[key].push(plugin[key]);
    }
  }

  /**
   * 同步 fire：串行执行所有 handler，不 await 异步结果。
   */
  fireSync(name, ctx) {
    const handlers = this.map[name];
    if (!handlers || handlers.length === 0) return;

    const snapshot = [...handlers];
    for (const handle of snapshot) {
      if (ctx?._cancelled) break;
      try {
        handle(ctx);
      } catch (err) {
        console.error(`[core-dnd] hook ${name} threw`, err);
      }
    }
  }

  // 异步fire 统一返回 Promise
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
        console.error(`[core-dnd] hook ${name} threw`, err);
        continue;
      }

      // 如果返回是异步结果，等待他完成，保证插件的执行顺序
      if (result && typeof result.then === "function") {
        try {
          await result;
        } catch (err) {
          console.error(`[core-dnd] async hook ${name} rejected`, err);
        }
      }
    }
  }
}

export async function fireAndAwait(bus, name, ctx) {
  const result = bus.fire(name, ctx);
  if (result) await result;
}
