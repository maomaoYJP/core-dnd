export class RectCache {
  constructor() {
    this.records = new Map();
    this._listening = false;
    this._refreshAll = this.refreshAll.bind(this);
  }

  attach() {
    if (this._listening || typeof window === "undefined") return;
    window.addEventListener("resize", this._refreshAll);
    this._listening = true;
  }

  detach() {
    if (!this._listening || typeof window === "undefined") return;
    window.removeEventListener("resize", this._refreshAll);
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

  refreshAll() {
    for (const container of this.records.keys()) {
      this.refreshContainer(container);
    }
  }

  refreshContainer(container) {
    const record = this._recordOf(container);

    record.container.measure();
    this._syncItems(container, record);
    for (const item of record.items) {
      item.measure();
    }
  }

  _recordOf(container) {
    const record = this.records.get(container);
    if (!record) {
      throw new Error("[core-dnd] container is not registered in RectCache");
    }
    return record;
  }

  _syncItems(container, record) {
    const elements = container.getItemElements();
    const byElement = new Map(record.items.map((it) => [it.element, it]));

    record.items = elements.map((element) => {
      return byElement.get(element) ?? new RectRecord(element);
    });
  }
}

class RectRecord {
  constructor(element) {
    this.element = element;
    this.baseRect = null;
    this.scrollTracker = new ScrollTracker();
  }

  measure() {
    this.baseRect = readRect(this.element.getBoundingClientRect());
    this.scrollTracker.capture(this.element);
  }

  getCachedRect() {
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
