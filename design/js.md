## 初始化元素结构

用户使用时,只需要提供一个容器,并且容器的直接子元素会被识别为可拖拽项

```html
<div id="container">
  <!-- 直接子元素,可拖拽项 -->
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

传入容器元素,初始化容器结构

```javascript
const container = document.getElementById("container");
const dragContainer = new DragContainer(container);
```

具体步骤

1. container接收到用户传入的容器元素
2. 初始化容器结构,修改元素，将元素进行包装

## 基本事件设计

1. 定义事件，mousedown事件监听器(一直监听)，点击可拖拽项时，创建幽灵元素，并且将被点击的元素隐藏。在mousedown中绑定mousemove和mouseup事件监听器
2. mouseup中，移除mousemove和mouseup事件监听器

### mousedown事件

1. 获取被点击的元素
2. 隐藏被点击的元素
3. 创建幽灵元素
4. 绑定mousemove和mouseup事件监听器

创建幽灵元素

```html
<!-- 外层包裹 -->
<div class="drag-ghost animated">
  <!-- 点击的元素 -->
</div>
```

使用fixed定位，设置幽灵元素的尺寸和位置，使其与被点击的元素重叠

### mousemove事件

1. 获取鼠标位置
2. 更新幽灵元素的位置，使其跟随鼠标移动

需要保存鼠标相对于被点击元素的偏移量，以确保幽灵元素能够正确地跟随鼠标移动

1. 保存鼠标点击位置与被点击元素左上角的偏移量
2. 在mousemove事件中，根据鼠标位置和偏移量计算幽灵元素的新位置

### mouseup事件

1. 删除幽灵元素，并且将被点击的元素显示
2. 移除mousemove和mouseup事件监听器

## 拖动排序

1. 记录被拖动元素的初始initialIndex
2. 在mousemove事件中，检测幽灵元素与其他可拖拽项的碰撞，得到targetIndex
   如果当前`targetIndex < initialIndex`，说明被拖动元素在向前移动，需要将index到initialIndex之间的元素向后移动一个位置，移动的距离为被拖动元素的高度
   如果当前`targetIndex > initialIndex`，说明被拖动元素在向后移动，需要将initialIndex到index之间的元素向前移动一个位置

### 得到targetIndex

为了方便管理，一开始的时候保存拖拽元素数组，而不是每次都重新获取

```javascript
const draggableItems = [{
  element: HTMLElement,
  rawRect: DOMRect
  rect: DOMRect
}, ...]

const ghostItem = {element: HTMLElement,rawRect: DOMRectrect: DOMRect}
```

initDraggableItems初始化draggableItems，注意rect是只读的非枚举属性，不能使用展开运算符进行复制，需要手动创建一个新的对象

```javascript
initDraggableItems(container) {
    this.draggableItems = Array.from(container.children).map((item) => {
      const rawRect = item.getBoundingClientRect();
      // rawRect是非枚举属性，所以需要复制一份
      const rect = {
        left: rawRect.left,
        top: rawRect.top,
        right: rawRect.right,
        bottom: rawRect.bottom,
        width: rawRect.width,
        height: rawRect.height,
      };

      return {
        element: item,
        rawRect: { ...rect },
        rect: { ...rect },
      };
    });
  }
```

1. 判断幽灵元素的中心点是否在某个元素的边界框内
2. 如果在，返回该元素的index作为targetIndex

只是简单的这样判断，有一些问题。比如在空隙的时候，一直返回-1，导致元素一直在抖动。
改变思路：

1. 加上容器本身的判断，如果ghost元素的中心点在容器内，那么不应该targetIndex为-1，而是上一次的targetIndex
2. 只有ghost元素的中心点在容器外的时候，才应该targetIndex为-1

### 更新元素位置

1. 如果targetIndex < initialIndex，说明被拖动元素在向前移动，需要将index到initialIndex之间的元素向后移动一个位置，移动的距离为被拖动元素的高度
2. 如果targetIndex > initialIndex，说明被拖动元素在向后移动，需要
   将initialIndex到index之间的元素向前移动一个位置
3. 如果targetIndex === initialIndex，不需要移动元素
4. 如果targetIndex === -1，下方全部元素向前移动一个位置
5. 如果回到了原位，必须把所有元素的 transform 都清零！

```javascript
reflowWrapperElements(initialIndex, targetIndex) {
    if (
      initialIndex === -1 ||
      targetIndex === -1 ||
      initialIndex === targetIndex
    ) {
      // 如果回到了原位，必须把所有元素的 transform 都清零！
      this.draggableItems.forEach((item) => {
        item.element.style.transform = `translateY(0)`;
      });
      return;
    }

    // 如果targetIndex < initialIndex，说明被拖动元素在向前移动，
    // 需要将index到initialIndex之间的元素向后移动一个位置，
    // 移动的距离为被拖动元素的高度
    const direction = targetIndex > initialIndex ? -1 : 1;
    const initialItem = this.draggableItems[initialIndex];
    const targetItem = this.draggableItems[targetIndex];
    const translateY = direction * initialItem.rect.height;

    // 需要考虑css的 gap 属性
    const gap = parseFloat(
      getComputedStyle(this.containerItem.element).gap || "0",
    );

    const translateYWithGap = translateY + direction * gap;

    for (let i = 0; i < this.draggableItems.length; i++) {
      const item = this.draggableItems[i];
      if (
        i >= Math.min(initialIndex, targetIndex) &&
        i <= Math.max(initialIndex, targetIndex)
      ) {
        item.element.style.transform = `translateY(${translateYWithGap}px)`;
      } else {
        item.element.style.transform = "translateY(0)";
      }
    }
  }
```

### 更新dom

1. 在mouseup事件中，根据targetIndex和initialIndex的关系，更新dom结构
2. 如果targetIndex < initialIndex，说明被拖动元素在向前移动，需要将被拖动元素插入到targetIndex位置之前
3. 如果targetIndex > initialIndex，说明被拖动元素在向后移动，需要将被拖动元素插入到targetIndex位置之后
4. 如果targetIndex === -1，说明被拖动元素被拖出了容器，不需要插入到容器中，直接放回原位即可

同时还需要

1. 动画结束后，清除所有元素的 transform 样式
2. 更新draggableItems数组中元素的index和rect信息，以便下一次拖动时能够正确地计算位置

## 实现 drag-drop-preview 功能

html结构设计

```html
<div class="drag-drop-preview-constant" style="position:absolute">
  <div class="drag-drop-preview-flex-container">
    <div class="drag-drop-preview-inner drag-drop-preview-default"></div>
  </div>
</div>
```

1. drag-drop-preview-constant: 最外层，position: absolute，脱离文档流，用于跟随鼠标定位，不影响其他元素布局。
2. drag-drop-preview-flex-container: 中间层，用 flex 布局，方便内部元素自适应对齐。
3. drag-drop-preview-inner: 真正的内容区域，flex: 1，填满父容器，用户可以在这个元素上添加自定义样式和内容。
4. drag-drop-preview-default: 预览元素的默认样式类，可以根据需要进行自定义样式的覆盖

### 在 mousedown 事件中，创建并显示预览元素

1. 创建预览元素，并将其添加到 containerItem.element 中

### 在 mousemove 事件中，更新预览元素的位置

1. 根据initialIndex和targetIndex，计算预览元素应该向上还是向下移动，以及移动的距离。移动的距离为差值的绝对值乘以被拖动元素的高度，再加上gap的距离
2. 更新预览元素的位置，使其跟随被拖动元素移动

可以试试在之前transform上计算

### 发现之前更新元素位置的逻辑有问题

检测碰撞一直使用原始rect
虽然视觉上使用transform移动了元素，但是碰撞检测还是使用之前的rect进行判断，之前看起来没有问题是因为基于原始的rect进行碰撞检测，在初始位置的时候是没有问题的，但是当元素发生位移后，再想要正确地进行碰撞检测，就需要基于元素的当前rect进行判断，而不是之前的rect

优化过程

1. mouseDown中，初始化保存每个拖拽项的信息，特别是它的rect属性
2. mouseMove中，计算targetIndex，具体计算思路是
   1. 获取幽灵元素的中心点位置
   2. 遍历每个拖拽项，获取开始结束位置（rectTop+translate，+rectHeight）
   3. 判断中心点位置是否在开始结束位置之间，并且判断是在上半部分还是下半部分，得到insertIndex，表示应该插入到哪个位置
3. mouseMove中，更新元素位置，具体更新思路是
   1. 如果 insertIndex 没有变化，不需要更新元素位置
   2. 如果insertIndex === -1，所有元素回原位、
   3. 计算需要移动的距离
   4. 遍历所有元素，如果是拖动元素，跳过。根据initialIndex和insertIndex的关系，判断元素应该向上还是向下移动，并且设置transform。
      注意：向上还是向下相对关系是拖动开始就确定的，如果一开始是向下移动，那么后续都是走向下逻辑，这里是相对初始位置的。然后遍历所有元素设置transform

现在insertIndex的意思是insert-before，然后也没有屏蔽当前拖动的元素。
所以会出现一种情况，就是，拖动的是第三个元素，然后往上移动到第二个元素下半部分insertIndex是2，移动到第四个元素上半部分是3。
插在2之前和插在3之前，都是把拖动元素放在第三个位置。这两个情况是一样的，都是把拖动元素放在第三个位置

### preview显示

更新preview思路

1. 根据insertIndex，可以知道 item[insertIndex] 的当前视觉位置 = rect.top + translateY
2. 也就是说，根据目标元素偏移的距离，就可以知道preview应该显示的位置
3. 不需要需要考虑到 gap 的问题，gap不包含在计算中，需要独立算出
4. 如果是插到最后一个，直接算出即可

```
newTop = last.rect.bottom - initialItem.rect.height - containerTop;
```

## 实现 auto-scroll 功能，当拖动元素接近容器边缘时，自动滚动容器，以便用户能够继续拖动元素到容器内的其他位置。

注意preview使用的是相对容器的定位，而所有其它位置使用的是相对于视口的定位

1. 在 mousemove 事件中，检测幽灵元素是否接近容器的边缘
2. 在容器边缘有一个范围，根据幽灵元素底部位置和容器底部位置的差值，判断是否需要自动滚动，和滚动速度。

现在整个坐标计算有点复杂，需要好好思路一下

1. 获取insertIndex，现在计算insertIndex是基于一开始计算得到的rect进行的。已经包含了scrollTop的影响。但是这是针对一开始的，如果初始化之后，用户滚动了容器，那么这些rect就不对了。所以在点击的时候，保存一个initialScrollTop，在计算insertIndex的时候，应该基于当前的scrollTop和initialScrollTop的差值来计算出一个修正值，然后在原来的rect基础上加上这个修正值，这样就能够得到正确的insertIndex了
2. 对于计算preview的位置，现在的计算是基于item[insertIndex].rect.top来计算的，这个rect.top也是一开始计算得到的，并且包含了scrollTop的影响，所以同样需要加上一个修正值，来得到正确的preview位置。具体来说就是加上initialScrollTop

不一样是因为preview使用相对容器定位。而getInsertIndex使用的是相对于视口的坐标，如果我滚动的时候重新计算rect，那么就不需要加上initialScrollTop了

## 实现跨容器拖动

### 重构项目结构

1. 实现dragManager

```javascript
class DragManager {
  constructor() {
    this.containers = [];
    this.session = null;
    this.initEvent();
  }

  registerContainer(container) {
    this.containers.push(container);
  }
  unregisterContainer(container) {
    this.containers = this.containers.filter((c) => c !== container);
  }

  initEvent() {
    window.addEventListener("mousedown", this.handleMouseDown);
  }

  handleMouseDown = (event) => {
    // 找到点击的容器
    // 如果点击的容器是注册过的容器，那么创建一个新的session
    // 启动session
    // 监听mousemove和mouseup事件
  };

  handleMouseMove = (event) => {
    // 如果有session，那么调用session的start方法
  };

  handleMouseUp = (event) => {
    // 如果有session，那么调用session的end方法
    // 清空session
    // 清空事件
  };
}
```

2. 拖动过程使用一个session类来管理，处理拖动过程中的状态和事件

```javascript
class DragSession {
  constructor({ manager, sourceContainer, initialIndex, mouseDownEvent }) {
    // 不变量（整次会话不变）
    this.manager = manager;
    this.sourceContainer = sourceContainer;
    this.initialIndex = initialIndex;
    this.mouseDownEvent = mouseDownEvent;

    // 可变状态
    this.activeContainer = sourceContainer;
    this.insertIndex = initialIndex;
    this.ghost = null; // {element, rect, update(x,y)}
    this.preview = null; // {element}
  }

  start() {
    // 隐藏被点击的元素
    // 初始化activeContainer
    // 都是container内部方法创建
    // 创建幽灵元素
    // 创建预览元素
  }
  move() {
    // 更新幽灵元素位置
    // 检测碰撞，得到新的activeContainer和insertIndex
    // 重排元素位置
    // 更新预览元素位置
  }
  end() {
    // session状态清理
    // container内部方法更新dom结构
    // container内部方法清理，ghost、preview等
  }
}
```

3. container类专门负责管理容器内事，rect 维护、reflow 计算、preview 摆放、auto-scroll。

```javascript
class DragContainer {
  constructor(element) {
    //{element: HTMLElement,rawRect: DOMRect,rect: DOMRect}
    this.element = element;
    // [{element: HTMLElement,rawRect: DOMRectrect: DOMRect}, ...]
    this.draggableItems = [];

    this.initStructure();
    this.refreshRects();

    dragManager.registerContainer(this);
  }

  // ===== 初始化 =====
  initStructure() {
    // 把 children 包一层 .drag-draggable-wrapper（原 initStructure 逻辑）
  }

  // ===== 状态维护 =====
  refreshRects() {
    // 重新读取更新 元素rect
    // 在 mousedown 触发时 / 拖动结束后 / Session 进入时调用
  }

  getGap() {
    // 读 computedStyle.rowGap
  }

  // ===== 查询（Session 用） =====
  containsPoint(x, y) {
    // 判断点 (x, y) 是否在容器内，返回布尔值
  }

  findItemIndex(wrapperElement) {
    // 返回 wrapperElement 在 draggableItems 中的 index，找不到返回 -1
  }

  // 二分查找：ghost 中心落在哪个插入位之前
  // initialScrollTop 由 Session 传入，用于 scroll 修正
  getInsertIndex(ghostRect, initialScrollTop) {
    // 原 getInsertIndex 逻辑搬过来
  }

  // ===== 会话生命周期 hook（Session 调） =====
  // 一开始需要做的事
  enterSession() {
    // 1. refreshRects()
    // 2. 给所有 item.element 加 animated 类
  }

  // 收尾工作
  leaveSession() {
    // 1. 清所有 item 的 transform
    // 2. 移除 animated 类
    // 3. refreshRects()
  }

  // ===== 拖动期间的动作（Session 调） =====
  // 让位动画：把 (initialIndex, insertIndex) 区间的元素平移
  reflow(initialIndex, insertIndex) {
    // 原 reflowWrapperElements 的逻辑
  }

  // 计算 preview 此刻在容器内（容器相对坐标系）应该处于的 top
  computePreviewTop(
    initialIndex,
    insertIndex,
    initialScrollTop,
    draggedHeight,
  ) {
    // 原 updatePreviewPosition 计算 newTop 的部分
    // 把 newTop 返回给 Session，由 Session 设置 preview.element.style.top
  }

  // 自动滚动：靠近边缘时滚动容器
  autoScroll(ghostRect) {
    // 原 autoScrollContainer 逻辑
  }

  // ===== 结束时（Session 调） =====
  reorderDOM(initialIndex, insertIndex) {
    // 原 reorderDOM 逻辑：把 draggedElement 插到新位置
  }

  // ===== 工具 =====
  getTranslateY(item) {
    // 解析 item.element.style.transform 里的 translateY
    // 给 getInsertIndex / computePreviewTop 内部用
  }
}
```
