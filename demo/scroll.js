import { card } from "./utils.js";

export default {
  id: "scroll",
  icon: "07",
  name: "自动滚动",
  description:
    "列表内容超出容器时，拖到边缘会触发自动滚动，长列表也能完成排序。",
  code: `manager.mount(document.querySelector("#scrollList"), {
  preview: { className: "drag-preview" },
  ghost: {},
});`,
  render(stage, manager) {
    stage.className = "stage";
    stage.innerHTML = `
      <div id="scrollList" class="demo-list tall">
        ${Array.from({ length: 14 }, (_, index) =>
            card(
              String(index + 1).padStart(2, "0"),
              `Card ${index + 1}`,
              "",
            ),
          ).join("")}
      </div>
    `;

    manager.mount(document.querySelector("#scrollList"), {
      preview: { className: "drag-preview" },
      ghost: {},
    });
  },
};