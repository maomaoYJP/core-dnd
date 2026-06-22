/**
 * Axis 类：封装横向/竖向的差异，提供统一接口供 dragContainer 调用。
 * 这样 dragContainer 就不需要关心自己是横向还是竖向了。
 */

export class Axis {
  constructor(axis) {
    // axis: 'horizontal' | 'vertical'
    this.axis = axis;
    this.isX = axis === "horizontal";

    // 主轴上读 rect / 操作元素 style / 操作 scroll 时用到的字段名
    this.keys = this.isX
      ? {
          size: "width",
          start: "left",
          end: "right",
          scrollProp: "scrollLeft",
          startStyle: "left",
          crossStyle: "top",
        }
      : {
          size: "height",
          start: "top",
          end: "bottom",
          scrollProp: "scrollTop",
          startStyle: "top",
          crossStyle: "left",
        };

    // 解析 transform style 时用到的正则表达式
    this.translateRe = this.isX
      ? /translateX\((-?[\d.]+)px\)/
      : /translateY\((-?[\d.]+)px\)/;

    // 自动滚动配置：threshold 为触发区宽度(px)，speed 为像素/帧
    this.scrollConfig = this.isX
      ? { threshold: 40, minSpeed: 5, maxSpeed: 20 }
      : { threshold: 20, minSpeed: 5, maxSpeed: 20 };
  }

  // ============ 一、查 ============
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

  parseTranslate(transformStr) {
    if (!transformStr) return 0;
    const m = transformStr.match(this.translateRe);
    return m ? parseFloat(m[1]) : 0;
  }

  // ============ 二、改 ============
  setTranslate(el, distance) {
    el.style.transform = this.isX
      ? `translateX(${distance}px)`
      : `translateY(${distance}px)`;
  }

  clearTranslate(el) {
    this.setTranslate(el, 0);
  }

  setScroll(el, v) {
    el[this.keys.scrollProp] = v;
  }
  addScroll(el, delta) {
    el[this.keys.scrollProp] += delta;
  }

  // 设置元素主轴起点
  setMainStart(el, v) {
    el.style[this.keys.startStyle] = `${v}px`;
  }

  // ============ 三、算（纯函数） ============
  // 主轴步长：被拖元素的主轴尺寸 + 容器 gap
  step(draggedRect, gap) {
    return this.sizeOf(draggedRect) + gap;
  }

  // scroll 修正后的 translate
  correctedTranslate(transformStr, currentScroll, initialScroll) {
    return this.parseTranslate(transformStr) - currentScroll + initialScroll;
  }

  // 计算当前空位的主轴起点（容器局部坐标）
  visualMainStart({ itemRect, containerRawRect, transformStr, initialScroll }) {
    const localStart =
      this.startOf(itemRect) - this.startOf(containerRawRect) + initialScroll;
    return localStart + this.parseTranslate(transformStr);
  }

  // 给定插入位，返回该槽位的主轴起点（容器局部坐标）
  // 即计算如果把 ghost 插入该位，ghost 的主轴起点应该放在哪里
  slotMainStart({
    items, // [{ rect, element }]
    containerRawRect,
    initialScroll,
    initialIndex,
    insertIndex,
    gap,
    draggedRect,
  }) {
    if (items.length === 0) return 0;

    const visualOf = (item) =>
      this.visualMainStart({
        itemRect: item.rect,
        containerRawRect,
        transformStr: item.element.style.transform,
        initialScroll,
      });

    if (insertIndex >= items.length) {
      // 尾部追加：参照最后一个"非被拖元素"
      // 源容器里被拖元素仍占着一个槽（translate=0），不能当作末尾参照
      let lastIdx = items.length - 1;
      if (initialIndex !== null && lastIdx === initialIndex) {
        lastIdx -= 1;
      }
      // 容器里只有被拖元素本身，没有其他可参照的元素：
      // 尾部槽位就是被拖元素自己的原始槽位
      if (lastIdx < 0) {
        return visualOf(items[initialIndex]);
      }
      const last = items[lastIdx];
      return visualOf(last) + this.sizeOf(last.rect) + gap;
    }
    // 中间插入：item[insertIndex] 上方让出的洞
    return visualOf(items[insertIndex]) - this.step(draggedRect, gap);
  }

  // 二分查找：ghost 中心落在 items 哪个插入位之前
  // items: [{ rect, element }]，Axis 内部自己算 corrected translate
  findInsertIndex(ghostRect, items, currentScroll, initialScroll) {
    const ghostCenter = this.startOf(ghostRect) + this.sizeOf(ghostRect) / 2;

    let low = 0;
    let high = items.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      const it = items[mid];
      const translate = this.correctedTranslate(
        it.element.style.transform,
        currentScroll,
        initialScroll,
      );
      const start = this.startOf(it.rect) + translate;
      const midpoint = start + this.sizeOf(it.rect) / 2;

      if (ghostCenter < midpoint) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return low;
  }

  // 自动滚动意图：纯算 direction / speed，不实际滚动
  // direction: -1 向起点 / 0 不滚 / 1 向终点
  getScrollIntent(ghostRect, containerRect) {
    const { threshold, minSpeed, maxSpeed } = this.scrollConfig;
    const startGap = this.startOf(ghostRect) - this.startOf(containerRect);
    const endGap = this.endOf(containerRect) - this.endOf(ghostRect);

    const calcSpeed = (distance) => {
      const ratio = (threshold - distance) / threshold; // 0~1
      return minSpeed + (maxSpeed - minSpeed) * ratio;
    };

    if (startGap < threshold) {
      return { direction: -1, speed: calcSpeed(startGap) };
    }
    if (endGap < threshold) {
      return { direction: 1, speed: calcSpeed(endGap) };
    }
    return { direction: 0, speed: 0 };
  }
}
