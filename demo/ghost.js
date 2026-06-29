import { card } from "./utils.js";

export default {
  id: "ghost",
  icon: "06",
  name: "自定义 Ghost",
  description:
    "通过 renderContent 可以自定义拖拽影子的样式和内容，不限于克隆原始元素。",
  code: `manager.mount(document.querySelector("#ghostList"), {
  ghost: {
    className: "custom-ghost",
    renderContent(ctx) {
      const el = document.createElement("div");
      el.textContent = "✨ " + ctx.draggedItem.element.querySelector("strong").textContent;
      return el;
    },
  },
});`,
  render(stage, manager) {
    stage.className = "stage";
    stage.innerHTML = `
      <div id="ghostList" class="demo-list">
        ${card("1", "Card 1", "")}
        ${card("2", "Card 2", "")}
        ${card("3", "Card 3", "")}
        ${card("4", "Card 4", "")}
      </div>
    `;

    manager.mount(document.querySelector("#ghostList"), {
      ghost: {
        className: "custom-ghost",
        renderContent(ctx) {
          const el = document.createElement("div");
          el.textContent = "✨ " + ctx.draggedItem.element.querySelector("strong").textContent;
          return el;
        },
      },
    });
  },
};