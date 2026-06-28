/**
 * groupPlugin：分组拖拽限制。
 *
 * 配置优先级：container.options.group ?? pluginOption.group
 *
 *   manager.use(groupPlugin({ group: "list" }));                 // 插件级默认
 *   manager.mount(el, { group: { name: "list", put: false } });  // 容器级覆盖
 *
 * group 结构：
 *   { name: "list", pull: true, put: true }
 *   - pull / put 可以是 boolean，也可以是 (to, from, ctx) => boolean
 *
 * 跨容器规则（source → target，from !== to）：
 *   1. 双方 group.name 必须相同且非空
 *   2. 源容器 pull 不为 false
 *   3. 目标容器 put 不为 false
 *   同容器内拖拽不做限制。
 */

const ALLOW_ALL = { name: null, pull: true, put: true };

function normalizeGroup(raw) {
  if (raw == null) return ALLOW_ALL;

  return {
    name: raw.name ?? ALLOW_ALL.name,
    pull: raw.pull ?? ALLOW_ALL.pull,
    put: raw.put ?? ALLOW_ALL.put,
  };
}

// evaluate：用于判断是否允许跨容器拖拽，支持函数和布尔值
function evaluate(value, to, from, ctx) {
  return typeof value === "function" ? value(to, from, ctx) : value;
}

export function groupPlugin(options = {}) {
  const defaultGroup = options.group ?? null;

  // groupOf：获取容器的 group 配置
  const groupOf = (container) =>
    normalizeGroup(container.options.group ?? defaultGroup);

  // 跨容器是否允许：source → target
  function canCross(source, target, ctx) {
    const src = groupOf(source);
    const tgt = groupOf(target);
    if (src.name === null || src.name !== tgt.name) return false;
    if (!evaluate(src.pull, target, source, ctx)) return false;
    if (!evaluate(tgt.put, target, source, ctx)) return false;
    return true;
  }

  return {
    name: "group",

    onBeforeSessionCreate(ctx) {
      // 源容器自身禁止 pull 时直接放弃本次拖拽
      const { sourceContainer } = ctx;
      const { pull } = groupOf(sourceContainer);
      if (!evaluate(pull, null, sourceContainer, ctx)) {
        ctx.preventDefault();
      }
    },

    onBeforeContainerEnter(ctx) {
      if (ctx.container === ctx.sourceContainer || !ctx.container) return;
      if (!canCross(ctx.sourceContainer, ctx.container, ctx)) {
        ctx.preventDefault();
      }
    },

    // DOM 提交前的最后一刻，用于最后的跨容器限制判断
    onBeforeSessionEnd(ctx) {
      const { session } = ctx;
      const target = session.activeContainer;
      if (!target || target === session.sourceContainer) return;
      if (!canCross(session.sourceContainer, target, ctx)) {
        session.insertIndex = null;
      }
    },
  };
}
