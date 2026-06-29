import { card } from "./utils.js";

export default {
  id: "preview",
  icon: "05",
  name: "Preview 占位",
  description:
    "拖拽过程中显示占位元素，用户可以清楚看到松手后会插入的位置。",
  code: `manager.mount(document.querySelector("#previewList"), {
  preview: {
    className: "drag-preview",
    duration: 200,
    easing: "ease-in-out",
  },
});`,
  render(stage, manager) {
    stage.className = "stage";
    stage.innerHTML = `
      <div id="previewList" class="demo-list">
        ${card("1", "Card 1", "")}
        ${card("2", "Card 2", "")}
        ${card("3", "Card 3", "")}
        ${card("4", "Card 4", "")}
      </div>
    `;

    manager.mount(document.querySelector("#previewList"), {
      preview: {
        className: "drag-preview",
        duration: 200,
        easing: "ease-in-out",
      },
    });
  },
};