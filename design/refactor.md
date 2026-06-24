# 插件式重构

```
/any-drag
  /core
    dragManager.js      输入路由
    session.js          会话编排
    dragContainer.js    容器操作
    ghost.js            ghost 元素
    axis.js             几何纯函数
    hooks.js            钩子总线

  /plugins
    animation.js        ★ reflow 让位 + ghost 飞行
    preview.js          ★ preview 元素生命周期
    group.js            ★ pull/put 规则
    handle.js           ★ 把手 / filter
    autoScroll.js       ★ 自动滚动（顺手抽出来）

  index.js              导出 DragContainer + 内置插件
  constant.js
  style.js

```

## insertIndex坐标歧义问题

问题：
由于拖拽的时候隐藏了原始元素，导致在计算落点时，`insertIndex` 可能会出现歧义。
例如：
一开始初始化的时候是基于全部元素得到的 initIndex，拖拽过程中计算落点时是基于可见元素得到的 insertIndex。这两个的坐标体系不一致。

onMove 不传 newIndex 是个关键设计——因为 newIndex 在"还没提交"的状态下定义模糊（要不要算 dragged？算到哪个坐标系？）。改用 related + willInsertAfter 描述位置语义就清晰且无歧义。
而在 onEnd，onAdd onRemove 这些事件中，DOM 已经提交了变更，所以 newIndex 就是一个清晰的坐标。统一使用全部items的坐标体系。

修改：
现在统一修改，insertIndex意思是插入后的坐标，坐标体系是全部items。insertIndex = 1表示插入后在items[1]的位置。即使拖拽过程中隐藏了原始元素，insertIndex也不会改变。

无有效目标位置（onMove 拒绝 / 尚未计算 / 容器外）时 `insertIndex = null`，调用方据此判断是否提交；

## 实现一个ghost样式增强插件

问题：
现在ctx中并没有ghost引用，插件无法获取ghost元素进行样式增强。

修改：
在ctx中传入ghost引用，插件可以在onStart中获取ghost元素并进行样式增强。
因为ghost元素session创建，一次会话唯一的，就算有多个container，ghost也是一个引用，将其传入ctx中是安全的。

## 实现reflowPlugin

思路：

1. onSessionStart中，给需要过渡的元素添加过渡样式
2. onSessionMove中，计算每个元素应该移动的距离，设置transform
   1. 根据 initialIndex和insertIndex计算每个元素的位移。
   2. 具体逻辑，如果 initialIndex < insertIndex，说明dragged元素向后移动，所有在initialIndex和insertIndex之间的元素都需要向前移动一位。
   3. 如果 initialIndex > insertIndex，说明dragged元素向前移动，所有在insertIndex和initialIndex之间的元素都需要向后移动一位。
   4. 移动的距离是固定的step，就是被拖动元素的高度或宽度，取决于容器的方向。
3. onSessionLeave中，清除transform
4. onSessionEnd中，清除过渡样式
