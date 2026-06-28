# 架构设计 v3

重构目标：把拖拽库拆成稳定的核心内核、可替换的输入源、可组合的插件扩展，以及清晰的数据流。

这一版设计的重点不是把目录拆得越细越好，而是让每个模块只回答一个问题：

- 输入从哪里来？
- 当前拖拽状态是什么？
- 每一帧产生了什么拖拽意图？
- 这个意图是否允许？
- 最终如何提交？
- 视觉、滚动、回调等副作用挂在哪里？

---

## 一、总体架构

插件不再被视为核心分层中的一层，而是核心内核旁边的扩展模块。

核心只认识插件协议，不依赖任何具体插件；`DragManager` 负责把核心、插件、输入源装配起来。

```
┌─────────────────────────────────────────────────────┐
│ Public API / Composition                            │
│   DragManager                                       │
│   - mount / unmount / destroy                       │
│   - use(plugin) / useSensor(sensor)                 │
│   - 默认装配内置 sensor 和 plugin                   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ Kernel                                               │
│   DragController      起拖 / 移动 / 结束入口         │
│   SessionRunner       rAF 循环 + 生命周期编排        │
│   HookBus             插件协议调度                  │
│   OperationResolver   每帧生成 MoveOperation         │
│   Committer           提交 DOM 或交给适配层          │
└─────────────────────────────────────────────────────┘
             │                         │
             ▼                         ▼
┌───────────────────────┐     ┌───────────────────────┐
│ Domain Model          │     │ Extensions             │
│   Container           │     │   Plugins               │
│   DragSession         │     │   Sensors               │
│   MoveOperation       │     │                         │
│   RectCache           │     │                         │
└───────────────────────┘     └───────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ Primitives                                           │
│   Axis / Rect / Point / DOM utils                    │
└─────────────────────────────────────────────────────┘
```

依赖规则：

- `Kernel` 可以依赖 `Domain` 和 `Primitives`。
- `Extensions` 只能依赖公开的 hook ctx、operation、session 只读信息和少量安全 API。
- `Kernel` 不依赖具体插件，只依赖插件协议。
- `DragManager` 是 composition root，负责创建和连接所有对象。

---

## 二、建议目录结构

```
/any-drag
  /primitives
    axis.js
    rect.js
    point.js
    domUtils.js

  /domain
    container.js
    session.js
    operation.js
    rectCache.js

  /kernel
    dragController.js
    sessionRunner.js
    operationResolver.js
    committer.js
    hookBus.js
    hookNames.js

  /sensors
    pointerSensor.js
    keyboardSensor.js
    programmaticSensor.js

  /plugins
    ghostPlugin.js
    reflowPlugin.js
    previewPlugin.js
    autoScrollPlugin.js
    handlePlugin.js
    groupPlugin.js
    clonePlugin.js
    userCallbacksPlugin.js

  /style
    constants.js
    css.js

  dragManager.js
  index.js
```

说明：

- `kernel` 替代原来的 `orchestration` 命名，更强调这里是拖拽运行时内核。
- `plugins` 和 `sensors` 是扩展模块，不放进核心单向分层里。
- `style` 只放核心必要样式；插件样式由插件自己声明或挂载。

---

## 三、核心抽象

### DragManager

公开 API 和装配入口。

```js
class DragManager {
  mount(el, options);
  unmount(container);
  destroy();

  use(plugin);
  useSensor(sensor);
}
```

职责：

- 维护 containers。
- 初始化 `HookBus`、`DragController`、`SessionRunner`、`RectCache`、`Committer`。
- 注册默认插件，如 `ghostPlugin`、`userCallbacksPlugin`。
- 注册默认输入源，如 `PointerSensor`。
- 对外隐藏内部复杂度。

不建议让 `DragManager` 直接监听鼠标事件或直接跑拖拽流程；这些交给 `Sensor` 和 `Controller`。

### Sensor

输入源抽象。

```js
class Sensor {
  attach(controller);
  detach();
}
```

Sensor 只负责把外部输入翻译成统一的 intent：

```js
{
  type: 'start' | 'move' | 'end' | 'cancel',
  pointer,
  event,
  container,
  itemIndex,
}
```

内置输入源：

- `PointerSensor`：鼠标 / pointer / touch。
- `KeyboardSensor`：键盘可访问性拖拽。
- `ProgrammaticSensor`：通过 API 主动发起拖拽。

### DragController

拖拽入口控制器。

```js
class DragController {
  start(intent);
  move(intent);
  end(intent);
  cancel(reason);
}
```

职责：

- 接收 sensor intent。
- 判断是否可以创建 session。
- 触发 `onTryStart` 等 gate hook。
- 创建 `DragSession`。
- 把 session 交给 `SessionRunner`。

### DragSession

一次拖拽的状态对象。

```js
class DragSession {
  sourceContainer;
  activeContainer;
  draggedItem;
  initialIndex;
  pointer;
  currentOperation;
  committedOperation;
  phase;

  updatePointer(point);
  setActiveContainer(container);
  setOperation(operation);
  markCommitted(operation);
  finish();
}
```

`DragSession` 不应该负责：

- 监听输入事件。
- 启动 rAF。
- 触发 hook。
- 提交 DOM。
- 调用用户回调。

但它可以保留少量状态方法，用于维护自身不变量。完全贫血的 session 反而容易让状态修改散落在各处。

### SessionRunner

拖拽生命周期编排器。

```js
class SessionRunner {
  start(session);
  updatePointer(point);
  end();
  cancel(reason);
}
```

职责：

- 启动和停止 rAF。
- 每帧按固定阶段运行。
- 调用 `OperationResolver` 生成 operation。
- 调用 `HookBus`。
- 在结束时调用 `Committer`。

每帧建议分成三个阶段，避免 DOM 读写混杂：

```txt
read phase
  读取 pointer / rect / scroll 状态

decide phase
  resolve activeContainer
  generate MoveOperation
  run gate hooks

write phase
  ghost / reflow / preview / autoScroll 等插件写 DOM
```

### Container

容器领域对象。

```js
class Container {
  el;
  options;
  items;

  mount();
  unmount();
  getItemAt(index);
  indexOf(target);
}
```

建议 `Container` 只负责：

- DOM 结构包装和还原。
- 维护 item 列表。
- 保存用户配置。

不建议 `Container` 负责：

- 用户回调代理。
- session 生命周期。
- DOM commit。
- 复杂几何计算。

这些可以交给 `userCallbacksPlugin`、`Committer`、`RectCache`、`OperationResolver`。

### RectCache

几何信息服务。

```js
class RectCache {
  refresh(container);
  refreshAll();
  invalidate(container);
  getContainerRect(container);
  getItemRects(container);
}
```

注意点：

- 不建议在任意 `get()` 时偷偷刷新，因为这可能造成 layout thrashing。
- 更推荐由 `SessionRunner` 在 read phase 统一刷新。
- `autoScroll` 或 DOM 变化后可以调用 `invalidate`，下一帧统一读新 rect。

### OperationResolver

每帧根据 session、pointer、rect 生成 operation。

```js
class OperationResolver {
  resolve(session) {
    return new MoveOperation(...);
  }
}
```

职责：

- 找到当前 active container。
- 计算目标插入位置。
- 描述 related item 和插入方向。
- 不修改 DOM。
- 不触发用户回调。

### MoveOperation

拖拽意图的纯数据对象。

```js
class MoveOperation {
  from;
  fromIndex;
  to;
  toIndex;
  item;
  mode; // move | clone | copy
  related;
  willInsertAfter;
  accepted;
  reason;

  isNoop();
  isCrossList();
  isValid();
  describe();
}
```

重点：`MoveOperation` 不直接 `apply()`。

原因：

- operation 是描述，不是执行器。
- hook、callback、plugin 都应该围绕同一个纯数据对象通信。
- 后续支持 clone、受控模式、虚拟列表、React/Vue 适配时，不会被 DOM 操作绑死。

### Committer

最终提交执行器。

```js
class Committer {
  commit(operation);
  rollback(operation);
}
```

默认实现可以是 `DomCommitter`，负责真实移动 DOM。

后续可替换为：

- `ControlledCommitter`：只发事件，不直接改 DOM。
- `VirtualListCommitter`：交给虚拟列表适配层。
- `CloneCommitter`：根据 clone/copy 模式决定是否移动源节点。

---

## 四、Hook 系统

### Hook 类型

Hook 分三类：

- `notify`：通知型，返回值无意义。
- `gate`：决策型，返回 `false` 或 reject result 即否决。
- `async`：异步型，用于动画、清理等可等待阶段。

建议规则：

- 高频帧内 gate 尽量同步，避免拖拽手感被 Promise 阻塞。
- `ctx` 默认只读；插件要改变决策，应通过返回值或明确 API。
- 插件异常默认隔离，不应该让整个拖拽崩溃；但关键 gate hook 可以返回 reject。
- hook 顺序由 priority 决定，同 priority 按注册顺序。

### HookBus

```js
class HookBus {
  register(plugin);
  fire(name, ctx);
  fireDecision(name, ctx);
  fireAsync(name, ctx);
}
```

### 建议 hook 集合

| Hook | Kind | 时机 |
|---|---|---|
| `onManagerDestroy` | notify | manager 销毁前 |
| `onContainerRegister` | notify | container mount 后 |
| `onContainerUnregister` | notify | container unmount 前 |
| `onTryStart` | gate | 命中 item 后、session 创建前 |
| `onStart` | notify | session 创建并初始化后 |
| `onBeforeRead` | notify | 每帧 read phase 前 |
| `onAfterRead` | notify | 每帧 read phase 后 |
| `onTryEnter` | gate | active container 即将切换 |
| `onEnter` | notify | 进入容器 |
| `onLeave` | notify | 离开容器 |
| `onFrame` | notify | operation 已生成，每帧主通知 |
| `onTryCommit` | gate | 松手后、提交前 |
| `onCommit` | notify | 提交成功后 |
| `onCancel` | notify | 拖拽取消 |
| `onDropAnimate` | async | drop / rollback 动画 |
| `onCleanup` | notify | 清理资源 |

### Hook 签名

统一签名：

```js
hook(ctx)
```

ctx 结构：

```js
{
  manager,
  session,
  operation,
  sourceContainer,
  activeContainer,
  previousContainer,
  pointer,
  rectCache,
  api,
}
```

相比 `hook(session, payload)`，单 ctx 更容易向后兼容。

### Priority 建议

可以给内置插件约定优先级区间：

| 区间 | 用途 |
|---|---|
| `1000` | 核心内部保留 |
| `500 ~ 900` | 输入限制、group、handle、clone 等决策插件 |
| `100 ~ 499` | 视觉插件，如 ghost、preview、reflow |
| `0 ~ 99` | 普通用户插件 |
| `-100` | userCallbacksPlugin |

原则：

- 决策插件早于视觉插件。
- 视觉插件早于用户回调。
- 用户回调尽量看到稳定后的 operation。

---

## 五、插件落位

| 插件 | 类型 | 建议 hooks |
|---|---|---|
| `ghostPlugin` | visual | `onStart` / `onFrame` / `onDropAnimate` / `onCleanup` |
| `reflowPlugin` | visual | `onEnter` / `onLeave` / `onFrame` / `onDropAnimate` / `onCleanup` |
| `previewPlugin` | visual | `onEnter` / `onFrame` / `onLeave` / `onCleanup` |
| `autoScrollPlugin` | behavior | `onFrame` |
| `handlePlugin` | gate | `onTryStart` |
| `groupPlugin` | gate | `onTryStart` / `onTryEnter` / `onTryCommit` |
| `clonePlugin` | behavior | `onTryStart` / `onFrame` / `onTryCommit` / `onCommit` |
| `userCallbacksPlugin` | callback | `onStart` / `onFrame` / `onCommit` / `onCancel` |

### userCallbacksPlugin

用户回调建议内置为插件，而不是由 `Container` 或 `Session` 直接调用。

```js
function userCallbacksPlugin() {
  return {
    name: 'userCallbacks',
    priority: -100,
    onStart(ctx) {},
    onFrame(ctx) {},
    onCommit(ctx) {},
    onCancel(ctx) {},
  };
}
```

这样 core 不需要知道 `onStart / onMove / onAdd / onRemove / onEnd` 的存在。

### groupPlugin

跨容器能力建议放在插件里。

```js
group: {
  name: 'shared',
  pull: true,
  put: true,
}
```

它可以在这些阶段决策：

- `onTryStart`：是否允许从源容器拖出。
- `onTryEnter`：是否允许进入目标容器。
- `onTryCommit`：是否允许最终提交。

### clonePlugin

clone/copy 不建议写进核心提交逻辑。

核心只生成：

```js
operation.mode = 'move' | 'clone' | 'copy'
```

具体是否移动源节点、是否复制节点、是否保留源节点，由 `Committer` 或 clone 插件协作处理。

---

## 六、数据流

### 起拖

```txt
pointerdown / keyboard / programmatic
  ↓
Sensor 生成 start intent
  ↓
DragController.start(intent)
  ↓
hooks.fireDecision(onTryStart, ctx)
  ↓
new DragSession(...)
  ↓
SessionRunner.start(session)
  ↓
hooks.fire(onStart, ctx)
  ↓
rAF loop
```

### 每帧

```txt
rAF tick
  ↓
onBeforeRead
  ↓
RectCache.refreshDirty()
  ↓
onAfterRead
  ↓
OperationResolver.resolve(session)
  ↓
if activeContainer changed:
    hooks.fireDecision(onTryEnter, ctx)
    hooks.fire(onLeave / onEnter, ctx)
  ↓
session.setOperation(operation)
  ↓
hooks.fire(onFrame, ctx)
```

### 结束

```txt
pointerup / keyboard confirm / programmatic end
  ↓
DragController.end()
  ↓
operation = session.currentOperation
  ↓
hooks.fireDecision(onTryCommit, ctx)
  ↓
if accepted:
    committer.commit(operation)
    session.markCommitted(operation)
    hooks.fire(onCommit, ctx)
  else:
    hooks.fire(onCancel, ctx)
  ↓
await hooks.fireAsync(onDropAnimate, ctx)
  ↓
hooks.fire(onCleanup, ctx)
  ↓
session.finish()
```

---

## 七、受控模式预留

后续可以支持两种提交模式：

### 非受控模式

默认模式，库直接移动 DOM。

```js
manager.mount(list, {
  controlled: false,
});
```

使用 `DomCommitter`。

### 受控模式

库只计算 operation 并发出事件，不直接改 DOM。

```js
manager.mount(list, {
  controlled: true,
  onCommit(operation) {
    // 用户更新自己的数据源
  },
});
```

使用 `ControlledCommitter`。

这个预留对 React/Vue/Svelte 适配很重要，因为框架场景里 DOM 通常应该由数据驱动。

---

## 八、渐进落地顺序

不要一次性把所有模块都拆完。建议按收益从高到低迁移：

### Step 1：定义 MoveOperation

先把拖拽结果统一成纯数据对象。

收益：

- callback、hook、commit 都有统一语言。
- 后续 group、clone、controlled mode 更好接。

### Step 2：引入 userCallbacksPlugin

把用户回调从 session/container 中移出。

收益：

- core 不再知道用户回调。
- 插件体系更闭合。

### Step 3：补齐 HookBus 语义

实现：

- priority
- `fire`
- `fireDecision`
- `fireAsync`
- 错误隔离

收益：

- 插件顺序可控。
- gate/async 语义清楚。

### Step 4：拆出 Committer

把 DOM 提交从 session/container 中移出。

收益：

- operation 保持纯粹。
- 为受控模式和框架适配预留空间。

### Step 5：拆出 SessionRunner

把 rAF 和生命周期编排从 session 中移出。

收益：

- session 变轻。
- sensor 复用同一套运行时。

### Step 6：拆出 Sensor / Controller

最后处理输入源抽象。

收益：

- 支持 pointer、touch、keyboard、programmatic。
- Public API 更稳定。

---

## 九、关键设计原则

1. Operation 是事实，不是执行器。

`MoveOperation` 只描述“发生了什么 / 想发生什么”，不直接改 DOM。

2. 插件是扩展，不是核心分层的一层。

核心只依赖插件协议，具体插件由 `DragManager` 装配。

3. 高频路径避免异步 gate。

拖拽手感优先，每帧决策应尽量同步完成。

4. DOM 读写分阶段。

统一 read phase 读布局，write phase 做视觉更新，避免频繁强制重排。

5. Core 不知道用户回调。

用户回调只是一个内置插件。

6. DOM commit 可替换。

默认可以移动 DOM，但架构上要允许受控模式和框架适配。

---

## 十、用户使用示例

```js
import {
  DragManager,
  reflowPlugin,
  previewPlugin,
  autoScrollPlugin,
  handlePlugin,
  groupPlugin,
} from 'any-drag';

const manager = new DragManager()
  .use(handlePlugin())
  .use(groupPlugin())
  .use(reflowPlugin())
  .use(previewPlugin())
  .use(autoScrollPlugin());

manager.mount(listA, {
  axis: 'vertical',
  handle: '.drag-handle',
  group: {
    name: 'shared',
    pull: true,
    put: true,
  },
  onEnd(event) {
    console.log(event);
  },
});
```

内部装配：

- 默认 sensor：`PointerSensor`
- 默认 plugin：`ghostPlugin`、`userCallbacksPlugin`
- 默认 committer：`DomCommitter`
- 用户通过 `.use()` 追加插件
- 用户通过 `.useSensor()` 追加输入源

---

## 总结

v3 的核心方向是：

```txt
Sensor -> Controller -> SessionRunner -> Operation -> Committer
                                      ↓
                                    Hooks
                                      ↓
                                  Plugins
```

最重要的调整是：

- 插件是扩展模块，不是核心依赖链中的上层。
- `MoveOperation` 保持纯数据，不直接提交 DOM。
- `DragSession` 可以有少量状态方法，但不做编排。
- `RectCache` 尽量在固定 read phase 刷新。
- 用户回调通过内置插件实现。

这样设计会更适合后续扩展 group、clone、keyboard、受控模式和框架适配。
