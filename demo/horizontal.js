import { card } from "./utils.js";

export default {
  id: "horizontal",
  icon: "04",
  name: "横向排序",
  description:
    "把 axis 设置为 horizontal 后，拖拽命中和插入位置会按横向坐标计算。",
  code: `manager.mount(document.querySelector("#horizontalList"), {
  axis: "horizontal",
});`,
  render(stage, manager) {
    stage.className = "stage";
    stage.innerHTML = `
      <div id="horizontalList" class="demo-list horizontal">
        ${card("A", "Card A", "", "horizontal-item")}
        ${card("B", "Card B", "", "horizontal-item")}
        ${card("C", "Card C", "", "horizontal-item")}
        ${card("D", "Card D", "", "horizontal-item")}
        ${card("E", "Card E", "", "horizontal-item")}
      </div>
    `;

    manager.mount(document.querySelector("#horizontalList"), {
      axis: "horizontal",
    });
  },
};