# any-drag 不足与改进清单

对照 Sortable.js / dnd-kit / react-beautiful-dnd，结合当前代码（dragManager / session / dragContainer / axis）实际状态梳理。
标记说明：📌 表示已在 [design/js.md](../design/js.md) 路线图中计划实现。

---

## 一、能力缺口（决定能不能用在真实场景）

### 1. 只支持鼠标，无触摸 / 触控笔 📌（隐含）
[dragManager.js:23](../dragManager.js#L23) 只挂 `mousedown`，移动端、笔、辅助设备全用不了。
- 改用 **Pointer Events**（`pointerdown/move/up/cancel`），一份代码覆盖所有输入。
- 配合 `setPointerCapture`，解决"拖出窗口松手丢事件"——目前 [dragManager.js:49](../dragManager.js#L49) 的 mouseup 挂在 window 上，鼠标移出浏览器松开会卡住。
- wrapper 上设 `touch-action: none`，禁止页面滚动抢手势。

### 2. 没有"拖拽阈值"，按下即拖拽
[dragManager.js:39](../dragManager.js#L39) `mousedown` 立刻 `new DragSession`，与 click、文字选择、表单输入冲突——任何 `<input>/<a>/<button>` 都点不动。
- 引入 `activationConstraint`：`{ distance: 5 }` 或 `{ delay: 150, tolerance: 5 }`。
- `pointerdown` 只记位置，首次 `pointermove` 超过阈值才真正 `session.start()`。

### 3. 没有事件 / 回调系统 📌（已规划 onStart/onMove/onEnd/onAdd/onRemove）
[design/js.md:494](../design/js.md#L494) 已有详细设计，但代码尚未落地。当前拖拽结果只反映在 DOM 上，用户拿不到 `(from,to,oldIndex,newIndex,item)`，无法对接数据驱动框架。
- `onMove(evt)` 返回 `false` 阻止某次插入，是"分组限制 / 某些位置不可放"的基础。

### 4. 没有 group / pull / put 容器约束 📌（已规划）
[design/js.md:530](../design/js.md#L530) 已有设计。当前所有 `DragContainer` 互相可拖，无法做"A 可拖到 B 但 B 不能拖回 A"、克隆模式、按 name 过滤等多列看板刚需。

### 5. 没有 handle / filter / disabled
整个 item 都是拖把手。常见需求：
- `handle: '.drag-handle'`——只有把手触发。
- `filter: 'input, .no-drag'`——某些子元素不触发。
- `disabled: true`——临时禁用容器（编辑态切换常用）。

### 6. 没有键盘 / 无障碍支持
react-beautiful-dnd、dnd-kit 都内置键盘拖拽（Space 拿起、方向键移动、Enter 放下）+ ARIA live region。决定"能不能合规上线"。

---

## 二、稳定性 / 正确性问题

### 7. `initStructure` 用 `innerHTML = ""` 重建子节点
[dragContainer.js:48](../dragContainer.js#L48) 把 children 全部摘下再放进 wrapper，会丢失用户在原 DOM 上挂的事件监听、Vue/React 框架引用、Shadow DOM 状态。
- 改用 `replaceWith(wrapper)` 原地包一层，或 `wrapper.appendChild(item)` 后 `parentNode.insertBefore(wrapper, ref)`。

### 8. Rect 缓存会过期
`refreshRects` 只在 mousedown / endDrag 时跑（[dragContainer.js:54](../dragContainer.js#L54)）。拖拽中若其他容器尺寸变化（resize、字体/图片加载、外部数据更新）就错位。
- 用 `ResizeObserver` 观察容器和 items，`MutationObserver` 观察 children 变化（用户动态增删 item 后必须能识别）。
- 当前用户在外面 `appendChild` 一个 item 后，必须手动重建 `DragContainer`，体验差。

### 9. 没有 destroy / unregister 入口
`registerContainer` 有，但 `DragContainer` 没暴露 `destroy()` 反注册自己、移除事件、还原 DOM。SPA 切页内存泄漏。

### 10. `parseTranslate` 用正则解析 `el.style.transform`
[axis.js:32](../axis.js#L32) 只能读到 inline 的 `translateX/Y(...)`。用户给 item 加了别的 transform（rotate/scale）或用 CSS class 设 transform 时失效。
- 读 `getComputedStyle(el).transform` 拿 matrix 解析；或**完全不依赖读 transform**——把"让位偏移"维护在 JS 数据里，不从 DOM 反推。后者更鲁棒。

### 11. `mousedown` 没区分按键 / 没过滤元素
应 `if (event.button !== 0) return`（只响应左键），并在 input/select/textarea/contenteditable 上跳过。

### 12. 飞行收尾依赖 `transitionend`
[dragContainer.js:253](../dragContainer.js#L253) 起点终点完全相同时浏览器不触发 `transitionend`，`onComplete` 永不调用，ghost 卡死。
- 起点终点比较，相同直接 `onComplete()`；
- 加 `setTimeout` 兜底（duration + 50ms）。

### 13. 自动滚动只滚动容器自己
[dragContainer.js:223](../dragContainer.js#L223) 没有"祖先可滚容器"或"页面 window"的递归。拖到屏幕底部时页面不会自动滚。Sortable 的 autoScroll 会爬 `overflow` 链。

### 14. 跨容器 reflow 兜底缺失
[dragContainer.js:202-213](../dragContainer.js#L202-L213)：当 `initialIndex === null && insertIndex === null` 时不进入任何分支。若 session 某帧把源容器 `insertIndex` 重置但 `initialIndex` 未置，元素 translate 不会清零——隐蔽 bug。加一行"任何 fallthrough 走清零"。

### 15. `acceptDrag` 创建 preview 读的是被隐藏前的 rect
[dragContainer.js:262](../dragContainer.js#L262) `createPreviewElement` 在被拖元素已 `visibility:hidden` 后才调用，但用的是 `getBoundingClientRect`——visibility 不影响几何，目前 OK；但顺序依赖脆弱，建议显式用 `draggedItem.rect` 而非现读。

---

## 三、体验细节

### 16. 动画固定 0.25s，无法配置 / 无 FLIP
[style.js:22](../style.js#L22) `transition: all 0.25s`。item 高度差大时切换瞬间跳变。Sortable 用 FLIP 正确处理尺寸不一的项。
- options 暴露 `animation: 150`、`easing`。
- 让位用 FLIP（记位置 → DOM 移动 → 反算 translate → 清零触发过渡）。

### 17. 切换插入位的滞回（hysteresis）
ghost 中心刚好压在两 item 边界时，会高频切换 insertIndex（手抖就反复 reflow）。Sortable 用 `swapThreshold` / `invertSwap`：进入对方一定百分比后才切。

### 18. 没有 ghost / preview 自定义
ghost 直接 `cloneNode`（[session.js:135](../session.js#L135)），preview 是固定虚线框。暴露 `options.createGhost(item) / options.createPreview(item)` 让用户接管，比 Sortable 的 `dragClass/ghostClass` 更简单。

### 19. 没有多选拖拽（multiDrag）
Ctrl/Shift 多选后一起拖，看板类场景常见。

### 20. RTL 没适配
Axis 的 `start/end` 在 `direction: rtl` 下要交换。Flex + rtl 时插入位计算会反。

### 21. Cursor / 文字选择视觉
拖拽时整页文字会被选中。拖拽期间设 `document.body.style.cursor='grabbing'` + `user-select:none`，结束恢复。

---

## 四、性能 / 工程

### 22. `frame` 每帧无脑跑完整流程
[session.js:47](../session.js#L47) `getInsertIndex` 每帧二分。
- ghost 位置没变就跳过 `updateDrag`；
- 用脏标记减少 `getBoundingClientRect` 调用。

### 23. 没有 TypeScript 类型 / 没有测试
对要给别人用的库是减分项。即使保留 JS 也可加 `.d.ts`。`Axis.findInsertIndex / slotMainStart` 这些纯函数特别适合单测。

### 24. 没有打包产物 / 入口
[index.js](../index.js) 只是 reexport。缺 `package.json` 的 `main/module/exports`、UMD、ESM、CDN 入口；用户没法 `npm install` 直接用。

### 25. 样式硬编码颜色 / 无法换肤
[style.js:56](../style.js#L56) preview 默认 `border:2px dashed #999; background:#f0f0f0`。建议改成 CSS 变量（`--any-drag-preview-border` 等），用户覆盖即可换肤。

### 26. 全局单例 dragManager 无法多实例
[dragManager.js:71](../dragManager.js#L71) 导出单例。若一个页面想用不同配置跑两套独立拖拽系统做不到。考虑导出 `createDragManager()` 工厂。

---

## 建议实施顺序

挑三个对"成熟度"提升最大的：

1. **Pointer Events + 激活阈值**——解决移动端 + 不抢 click 两大硬伤，工作量小。
2. **事件回调 + group 约束**（已在路线图）——让库能被数据驱动框架接进去，质变。
3. **ResizeObserver/MutationObserver + destroy**——动态内容场景下不再崩，长寿命应用必备。

剩下的（handle、键盘 a11y、FLIP、multiDrag）按目标用户决定优先级：
- 给自己项目用 → 先停在第 3 步。
- 做成开源库 → 键盘 / a11y、TS 类型、打包入口迟早要补。
