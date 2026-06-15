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

## 事件设计

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
