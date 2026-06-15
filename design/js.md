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
