1. html设计

用户使用时,只需要提供一个容器,并且容器的直接子元素会被识别为可拖拽项

```html
<!-- 用户提供的容器 -->
<div id="container">
  <!-- 直接子元素,可拖拽项 -->
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

初始化容器

```html
<div id="container" class="drag-container vertical">
  <div class="drag-draggable-wrapper vertical">
    <div>Item 1</div>
  </div>
  <div class="drag-draggable-wrapper vertical animated">
    <div>Item 2</div>
  </div>
  <div class="drag-draggable-wrapper vertical">
    <div>Item 3</div>
  </div>
  <!-- 可选的占位符（拖拽时动态插入） -->
  <div class="drag-drop-preview-constant-class" style="position:absolute">
    <div class="drag-drop-preview-flex-container-class">
      <div
        class="drag-drop-preview-inner-class drag-drop-preview-default-class"
      ></div>
    </div>
  </div>
  <!-- 幽灵元素 -->
  <div class="drag-ghost animated">
    <div>Item 2</div>
  </div>
</div>
```

2. 样式设计

```css
.drag-container {
  position: relative;
  display: flex;
  min-height: 30px; /* 确保容器有足够的高度 */
  min-width: 30px; /* 确保容器有足够的宽度 */
}

.drag-container.vertical {
  flex-direction: column; /* 垂直排列 */
}

.drag-container.horizontal {
  flex-direction: row; /* 水平排列 */
}

.drag-draggable-wrapper {
  box-sizing: border-box;
  cursor: move;
  user-select: none;
}

.animated {
  transition: all 0.3s ease; /* 添加过渡效果 */
}

.drag-ghost {
  position: absolute;
  pointer-events: none; /* 使幽灵元素不响应鼠标事件 */
  opacity: 1; /* 可选：调整幽灵元素的透明度 */
}
```

需要style和constant两个文件,分别定义样式和样式类名常量

style中定义需要挂载到全局的样式，并且提供挂载方法
constant中定义样式类名常量，导入到style中使用
在后续需要动态添加样式类名的地方,直接使用常量,避免硬编码字符串
