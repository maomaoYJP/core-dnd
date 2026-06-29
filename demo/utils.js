export function card(index, name, detail, size = "", tone = "") {
  const classes = ["demo-card", size, tone].filter(Boolean).join(" ");
  return `
    <div class="${classes}">
      <span class="card-index">${index}</span>
      <span class="card-text">
        <strong>${name}</strong>
        <span>${detail}</span>
      </span>
    </div>
  `;
}

export function handleCard(index, name, detail) {
  return `
    <div class="demo-card">
      <span class="drag-handle" aria-label="拖拽手柄">::</span>
      <span class="card-index">${index}</span>
      <span class="card-text">
        <strong>${name}</strong>
        <span>${detail}</span>
      </span>
    </div>
  `;
}