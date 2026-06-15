import { CSS } from "./constant.js";

const css = {
  [CSS.dragContainer]: {
    position: "relative",
    display: "flex",
    "min-height": "30px" /* 确保容器有足够的高度 */,
    "min-width": "30px" /* 确保容器有足够的宽度 */,
  },
  [CSS.vertical]: {
    "flex-direction": "column" /* 垂直排列 */,
  },
  [CSS.horizontal]: {
    "flex-direction": "row" /* 水平排列 */,
  },
  [CSS.dragDraggableWrapper]: {
    "box-sizing": "border-box",
    "user-select": "none",
  },
  [CSS.animated]: {
    transition: "all 0.3s ease" /* 添加过渡效果 */,
  },
  [CSS.dragGhost]: {
    position: "absolute",
    "pointer-events": "none" /* 使幽灵元素不响应鼠标事件 */,
    opacity: 1.0 /* 可选：调整幽灵元素的透明度 */,
  },
};

function mountStylesToHead() {
  const styleElement = document.createElement("style");
  let cssString = "";
  for (const className in css) {
    const styles = css[className];
    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key}: ${value};`)
      .join(" ");
    cssString += `.${className} { ${styleString} }\n`;
  }
  styleElement.textContent = cssString;
  document.head.appendChild(styleElement);
}

export { mountStylesToHead };
