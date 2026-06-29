import { handleCard } from "./utils.js";

export default {
  id: "handle",
  icon: "03",
  name: "拖拽手柄",
  description:
    "通过 handle 限定触发区域，避免点击输入框、按钮或正文内容时误触拖拽。",
  code: `manager.mount(document.querySelector("#handleList"), {
  handle: ".drag-handle",
});`,
  render(stage, manager) {
    stage.className = "stage";
    stage.innerHTML = `
      <div id="handleList" class="demo-list">
        ${handleCard("1", "Card 1", "")}
        ${handleCard("2", "Card 2", "")}
        ${handleCard("3", "Card 3", "")}
        ${handleCard("4", "Card 4", "")}
      </div>
    `;

    manager.mount(document.querySelector("#handleList"), {
      handle: ".drag-handle",
    });
  },
};