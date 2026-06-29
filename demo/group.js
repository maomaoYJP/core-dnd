import { card } from "./utils.js";

export default {
  id: "group",
  icon: "02",
  name: "跨容器拖拽",
  description:
    "相同 group 的三列表，分别演示 pull / pull+put / put 三种权限组合。",
  code: `manager.mount(listA, {
  group: { name: "tasks", pull: true, put: false },
});

manager.mount(listB, {
  group: { name: "tasks", pull: true, put: true },
});

manager.mount(listC, {
  group: { name: "tasks", pull: false, put: true },
});`,
  render(stage, manager) {
    stage.className = "stage three-columns";
    stage.innerHTML = `
      <div class="demo-column">
        <p class="demo-list-title">List A (pull only)</p>
        <div id="listA" class="demo-list">
          ${card("A", "Card A", "")}
          ${card("B", "Card B", "")}
        </div>
      </div>
      <div class="demo-column">
        <p class="demo-list-title">List B (pull + put)</p>
        <div id="listB" class="demo-list">
          ${card("C", "Card C", "")}
          ${card("D", "Card D", "")}
          ${card("E", "Card E", "")}
        </div>
      </div>
      <div class="demo-column">
        <p class="demo-list-title">List C (put only)</p>
        <div id="listC" class="demo-list">
          ${card("F", "Card F", "")}
        </div>
      </div>
    `;

    manager.mount(document.querySelector("#listA"), {
      group: { name: "tasks", pull: true, put: false },
    });
    manager.mount(document.querySelector("#listB"), {
      group: { name: "tasks", pull: true, put: true },
    });
    manager.mount(document.querySelector("#listC"), {
      group: { name: "tasks", pull: false, put: true },
    });
  },
};
