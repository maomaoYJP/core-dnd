export class RectCache {
  constructor() {
    // key: DragContainer, value: { container: RectRecord, items: RectRecord[] }
    this.records = new Map();
    this._listening = false;
    this._markDirty = this.markDirty.bind(this);
  }

  attach() {
    if (this._listening) return;
    window.addEventListener("resize", this._markDirty);
    this._listening = true;
  }

  detach() {
    if (!this._listening) return;
    window.removeEventListener("resize", this._markDirty);
    this._listening = false;
  }

  registerContainer(container, element) {
    this.records.set(container, {
      container: new RectRecord(element),
      items: [],
    });
  }

  unregisterContainer(container) {
    this.records.delete(container);
  }

  // 所有容器和元素都标记为脏
  markDirty() {
    for (const container of this.records.keys()) {
      this.markContainerDirty(container);
    }
  }

  // 标记指定容器及其所有元素为脏
  markContainerDirty(container) {
    const record = this._recordOf(container);
    record.container.markDirty();
    for (const item of record.items) {
      item.markDirty();
    }
  }

  // 传入的容器列表中，所有脏的容器及其元素都刷新
  ensureFresh(containers) {
    for (const container of containers) {
      this.ensureFreshContainer(container);
    }
  }

  // 传入单个容器，如果它或其元素脏了，就刷新
  ensureFreshContainer(container) {
    const record = this._recordOf(container);
    if (!this._isRecordDirty(record)) return;

    this._syncItems(container, record);
    record.container.ensureFresh();
    for (const item of record.items) {
      item.ensureFresh(container.containerEl);
    }
  }

  // 强制刷新指定容器及其元素的 rect 缓存，用于一开始初始化cache
  refreshContainer(container) {
    const record = this._recordOf(container);

    record.container.measure();
    this._syncItems(container, record);
    for (const item of record.items) {
      item.measure(container.containerEl);
    }
  }

  _recordOf(container) {
    const record = this.records.get(container);
    if (!record) {
      throw new Error("[core-dnd] container is not registered in RectCache");
    }
    return record;
  }

  // 同步 items 数组，保证顺序与 DOM 中一致
  _syncItems(container, record) {
    const elements = container.getItemElements();
    const byElement = new Map(record.items.map((it) => [it.element, it]));

    record.items = elements.map((element) => {
      return byElement.get(element) ?? new RectRecord(element);
    });
  }

  // 只要有一个脏，就认为整个 record 脏
  _isRecordDirty(record) {
    return record.container.dirty || record.items.some((item) => item.dirty);
  }
}

class RectRecord {
  constructor(element) {
    this.element = element;
    this.baseRect = null;
    this.dirty = true;
    this.scrollTracker = new ScrollTracker();
  }

  measure() {
    this.baseRect = readRect(this.element.getBoundingClientRect());
    this.scrollTracker.capture(this.element);
    this.dirty = false;
  }

  markDirty() {
    this.dirty = true;
  }

  ensureFresh() {
    if (!this.dirty) return;
    this.measure();
  }

  getCachedRect() {
    // 需要考虑滚动偏移，使用 ScrollTracker 来计算滚动变化量
    // ScrollTracker找到所有祖先可滚动元素，计算滚动，叠加到 baseRect 上
    return this.scrollTracker.applyTo(this.baseRect);
  }
}

class ScrollTracker {
  constructor() {
    this.snapshots = [];
  }

  capture(element) {
    this.snapshots = getScrollAncestors(element).map((ancestor) => ({
      ancestor,
      left: getScrollLeft(ancestor),
      top: getScrollTop(ancestor),
    }));
  }

  applyTo(rect) {
    const { x, y } = this.delta();
    return offsetRect(rect, -x, -y);
  }

  delta() {
    let x = 0;
    let y = 0;

    for (const { ancestor, left, top } of this.snapshots) {
      x += getScrollLeft(ancestor) - left;
      y += getScrollTop(ancestor) - top;
    }

    return { x, y };
  }
}

function readRect(r) {
  const { left, top, right, bottom, width, height } = r;
  return { left, top, right, bottom, width, height };
}

function offsetRect(rect, x, y) {
  return {
    left: rect.left + x,
    top: rect.top + y,
    right: rect.right + x,
    bottom: rect.bottom + y,
    width: rect.width,
    height: rect.height,
  };
}

function getScrollAncestors(element) {
  const ancestors = [];
  let current = element.parentElement;
  if (!current) {
    throw new Error("[core-dnd] element is not in the document");
  }

  while (current) {
    if (!isDocumentScrollElement(current) && isScrollable(current)) {
      ancestors.push(current);
    }
    current = current.parentElement;
  }

  if (typeof window !== "undefined") {
    ancestors.push(window);
  }

  return ancestors;
}

function isScrollable(element) {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
}

function isDocumentScrollElement(element) {
  return (
    typeof document !== "undefined" &&
    (element === document.body || element === document.documentElement)
  );
}

function getScrollLeft(ancestor) {
  return typeof window !== "undefined" && ancestor === window
    ? window.scrollX
    : ancestor.scrollLeft;
}

function getScrollTop(ancestor) {
  return typeof window !== "undefined" && ancestor === window
    ? window.scrollY
    : ancestor.scrollTop;
}
