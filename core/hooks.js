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

  // 统一返回 Promise，同时支持同步和异步
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
