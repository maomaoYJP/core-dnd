import { CSS } from "./constant.js";

/**
 * 核心样式：只包含容器布局和 ghost 必需的样式。
 * 插件需要的样式由插件自己挂载。
 */
const css = {
  [CSS.dragContainer]: {
    position: "relative",
    display: "flex",
    "min-height": "30px",
    "min-width": "30px",
  },
  [CSS.vertical]: {
    "flex-direction": "column",
  },
  [CSS.horizontal]: {
    "flex-direction": "row",
  },
  [CSS.dragDraggableWrapper]: {
    "box-sizing": "border-box",
    "user-select": "none",
    display: "grid",
  },
  [CSS.dragGhost]: {
    position: "fixed",
    "z-index": 9999,
    "pointer-events": "none",
    opacity: 1.0,
  },
  [CSS.dragPreview]: {
    border: "1px dashed #000",
    "background-color": "rgba(0, 0, 0, 0.1)",
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
    const selector = /[\s.\[]/.test(className) ? className : `.${className}`;
    cssString += `${selector} { ${styleString} }\n`;
  }
  styleElement.textContent = cssString;
  document.head.appendChild(styleElement);
}

export { mountStylesToHead };
