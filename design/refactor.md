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
    reflowPlugin.js     reflow 让位 + ghost 飞行
    preview.js          ★ preview 元素生命周期
    group.js            ★ pull/put 规则
    handle.js           ★ 把手 / filter
    autoScroll.js       ★ 自动滚动

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

问题：
现在没有松手之后回到目标位置的过渡效果

思路：

1. 新增onSessionEndAsync钩子，允许先执行完插件操作，再进行后续操作

onSessionEndAsync的时机是松手之后，但是在dom提交之后，endDrag之前

## 实现previewPlugin

思路：

1. preview使用absolute定位，放到container中
2. onSessionStart中，创建preview元素，设置样式，添加到container中
3. 计算需要添加到的位置，由于是相对容器定位，而系统中坐标都是相对viewport的，所以需要计算出相对容器的坐标
4. onSessionMove中，更新preview元素的位置
5. onSessionLeave中，隐藏preview元素
6. onSessionEnd中，移除preview元素

找到preview的top位置

1. 定义step，这个是空位的大小。只需要找到top或者bottom，和这俩计算就知道preview应该的位置
2. 如果是从上往下拖，使用insertIndex后面的元素的top作为参考，如果没有后面元素了，就用最后一个元素的bottom作为参考
3. 如果是从下往上拖，使用insertIndex前面的元素的bottom作为参考，如果没有前面元素了，就用第一个元素的top作为参考

不同容器之间的切换
每个容器都有自己的preview元素，切换容器时，隐藏上一个容器的preview元素，显示当前容器的preview元素。
在onSessionStart中，创建preview元素，需要根据当前是源容器还是目标容器，来决定preview元素。如果是另外一个容器，那么这个时候因为不知道insertIndex，所有preview元素先隐藏，先给宽高，然后在onSessionMove中再更新位置。
