import { card } from "./utils.js";

export default {
  id: "basic",
  icon: "01",
  name: "基础排序",
  description:
    "最小配置即可完成同容器纵向拖拽排序，适合普通列表、任务队列和菜单排序。",
  code: `const manager = new DragManager();

manager.mount(document.querySelector("#basicList"), {
  axis: "vertical",
});`,
  render(stage, manager) {
    stage.className = "stage";
    stage.innerHTML = `
      <div id="basicList" class="demo-list">
        ${card("1", "Card 1", "")}
        ${card("2", "Card 2", "")}
        ${card("3", "Card 3", "")}
        ${card("4", "Card 4", "")}
      </div>
    `;

    manager.mount(document.querySelector("#basicList"));
  },
};