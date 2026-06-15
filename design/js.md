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
