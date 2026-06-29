# core-dnd

一个轻量、可插件化的原生 JavaScript 拖拽排序库。

`core-dnd` 以 `DragManager` 为核心，提供列表排序、跨容器拖拽、横向/纵向布局、拖拽手柄、拖拽预览、元素让位动画、自动滚动和生命周期回调。项目基于浏览器原生 DOM API 与 ES Module，不依赖框架。

## 特性

- 原生 JavaScript 实现，无框架绑定
- 支持同容器排序和跨容器拖拽
- 支持纵向列表与横向列表
- 支持拖拽手柄，避免整项都可触发拖拽
- 支持 ghost 元素跟随指针
- 支持 preview 占位预览和 reflow 让位动画
- 支持容器边缘自动滚动
- 支持插件扩展拖拽生命周期
- 内置常用事件回调：`onStart`、`onMove`、`onEnd`、`onAdd`、`onRemove`

## 快速开始

在 HTML 中通过 ES Module 引入：

```html
<script type="module">
  import { DragManager } from "./index.js";

  const manager = new DragManager();
  const container = document.querySelector("#list");

  manager.mount(container, {
    onStart: (event) => console.log("start", event),
    onEnd: (event) => console.log("end", event),
  });
</script>
```

准备一个普通列表容器：

```html
<div id="list" class="list">
  <div class="item">Item 1</div>
  <div class="item">Item 2</div>
  <div class="item">Item 3</div>
</div>
```

`DragManager` 会在挂载时为容器添加必要结构和样式。每个子元素会被包装为可拖拽单元。

## 基础用法

### 创建管理器

```js
import { DragManager } from "./index.js";

const manager = new DragManager();
```

### 挂载容器

```js
const container = document.querySelector("#container");

manager.mount(container, {
  axis: "vertical",
  onStart: (event) => console.log(event),
  onEnd: (event) => console.log(event),
});
```

### 横向拖拽

```js
manager.mount(document.querySelector("#horizontal-list"), {
  axis: "horizontal",
});
```

容器自身需要配合横向布局样式：

```css
.horizontal-list {
  display: flex;
  flex-direction: row;
  gap: 10px;
  overflow: auto;
}
```

### 跨容器拖拽

多个容器使用相同的 `group.name`，并允许 `pull` 与 `put`，即可在它们之间拖拽：

```js
manager.mount(containerA, {
  group: { name: "list", pull: true, put: true },
});

manager.mount(containerB, {
  group: { name: "list", pull: true, put: true },
});
```

### 拖拽手柄

通过 `handle` 限定只有指定元素可以触发拖拽：

```html
<div id="tasks">
  <div class="task">
    <span class="drag-handle">=</span>
    Task A
  </div>
  <div class="task">
    <span class="drag-handle">=</span>
    Task B
  </div>
</div>
```

```js
manager.mount(document.querySelector("#tasks"), {
  handle: ".drag-handle",
});
```

`handle` 也可以是函数：

```js
manager.mount(container, {
  handle: (target, ctx) => target.matches(".drag-handle"),
});
```

## 配置项

### `axis`

拖拽方向。

```js
manager.mount(container, {
  axis: "vertical",
});
```

可选值：

- `vertical`：纵向拖拽，默认值
- `horizontal`：横向拖拽

### `group`

控制跨容器拖拽。

```js
manager.mount(container, {
  group: {
    name: "list",
    pull: true,
    put: true,
  },
});
```

字段说明：

- `name`：分组名称，只有同名分组之间可以跨容器拖拽
- `pull`：是否允许从当前容器拖出
- `put`：是否允许拖入当前容器

`pull` 和 `put` 可以是布尔值，也可以是函数：

```js
manager.mount(container, {
  group: {
    name: "list",
    pull: true,
    put: (to, from, ctx) => true,
  },
});
```

### `handle`

拖拽手柄配置。

```js
manager.mount(container, {
  handle: ".drag-handle",
});
```

### `preview`

配置拖拽时的占位预览元素。

```js
manager.mount(container, {
  preview: {
    className: "drag-preview",
    duration: 200,
    easing: "ease-in-out",
  },
});
```

字段说明：

- `className`：preview 元素的 class 名称
- `duration`：动画时长，单位为毫秒
- `easing`：CSS transition 缓动函数

### `ghost`

配置跟随指针移动的 ghost 元素。

```js
manager.mount(container, {
  ghost: {
    className: "drag-ghost",
    renderContent: (ctx) => {
      const el = ctx.draggedItem.element.cloneNode(true);
      return el;
    },
  },
});
```

常用字段：

- `className`：ghost 外层元素的 class 名称
- `renderContent(ctx)`：自定义 ghost 内部内容
- `onEnter(ghostEl, ctx)`：自定义 ghost 入场动画
- `onDrop(ghostEl, ctx)`：自定义 drop 动画，可返回 `Promise`

## 事件回调

### `onStart`

拖拽开始时触发。

```js
manager.mount(container, {
  onStart: ({ item, from, oldIndex }) => {
    console.log(item, from, oldIndex);
  },
});
```

### `onMove`

拖拽移动到可落点时触发。

```js
manager.mount(container, {
  onMove: ({ item, from, to, related, willInsertAfter }) => {
    return true;
  },
});
```

返回 `false` 可以拒绝当前落点。

### `onEnd`

拖拽结束时触发。

```js
manager.mount(container, {
  onEnd: ({ item, from, to, oldIndex, newIndex }) => {
    console.log(oldIndex, newIndex);
  },
});
```

### `onAdd`

元素从其他容器拖入当前容器时触发。

```js
manager.mount(container, {
  onAdd: ({ item, from, to, oldIndex, newIndex }) => {
    console.log("add", item);
  },
});
```

### `onRemove`

元素从当前容器拖出到其他容器时触发。

```js
manager.mount(container, {
  onRemove: ({ item, from, to, oldIndex, newIndex }) => {
    console.log("remove", item);
  },
});
```

## 插件

项目内置插件会在 `DragManager` 创建时默认注册：

- `userCallbacksPlugin`：把用户配置的事件回调接入拖拽生命周期
- `groupPlugin`：处理跨容器分组规则
- `handlePlugin`：处理拖拽手柄
- `previewPlugin`：处理占位预览
- `reflowPlugin`：处理拖拽过程中的元素让位动画
- `ghostPlugin`：处理跟随指针的 ghost 元素和 drop 动画
- `autoScrollPlugin`：处理容器或窗口边缘自动滚动

你也可以通过 `manager.use(plugin)` 追加自定义插件：

```js
const customPlugin = {
  name: "custom",
  onSessionStart(ctx) {
    console.log("drag started", ctx);
  },
};

manager.use(customPlugin);
```

插件可使用的生命周期名称包括：

- `onBeforeSessionCreate`
- `onBeforeSessionStart`
- `onSessionStart`
- `onContainerEnter`
- `onBeforeSessionFrame`
- `onSessionFrame`
- `onContainerLeave`
- `onBeforeContainerEnter`
- `onBeforeSessionEnd`
- `onSessionEnd`
- `onSessionCleanup`
