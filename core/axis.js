/**
 * Axis：主轴工具类，封装横竖轴的差异。
 * 主要用于：1. 读 rect 的主轴相关字段；2. 二分查找插入位。
 */
export class Axis {
  constructor(axis) {
    this.axis = axis; // 'horizontal' | 'vertical'
    this.isX = axis === "horizontal";

    // 主轴 / 副轴在 rect 和 element 上对应的字段名
    this.keys = this.isX
      ? {
          size: "width",
          start: "left",
          end: "right",
          scrollProp: "scrollLeft",
        }
      : {
          size: "height",
          start: "top",
          end: "bottom",
          scrollProp: "scrollTop",
        };
  }

  // ============ 读 ============
  sizeOf(rect) {
    return rect[this.keys.size];
  }
  startOf(rect) {
    return rect[this.keys.start];
  }
  endOf(rect) {
    return rect[this.keys.end];
  }
  getScroll(el) {
    return el[this.keys.scrollProp];
  }

  // ============ 算 ============
  // 二分查找：ghost 中心落在 items 哪个插入位之前
  // items: [{ rect }]
  findInsertIndex(ghostRect, items) {
    const ghostCenter = this.startOf(ghostRect) + this.sizeOf(ghostRect) / 2;

    let low = 0;
    let high = items.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      const it = items[mid];
      const start = this.startOf(it.rect);
      const midpoint = start + this.sizeOf(it.rect) / 2;

      if (ghostCenter < midpoint) high = mid;
      else low = mid + 1;
    }
    return low;
  }
}
