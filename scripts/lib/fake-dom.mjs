// scripts/lib/fake-dom.mjs — a permissive, dependency-free DOM stand-in for offline gates that mount native ESM pages.
//
// Gates used to slice page internals out of src/ui/pages/*.js and run them in a vm; a helper moving behind an import
// broke the slice. Mounting the page's exported factory against this document needs no knowledge of its internals.
// getElementById creates the element on first use — any id, or only the shell's ids when `ids` is given (so a page's
// `if (!getElementById(x)) create x` path still runs); an element given an id is what getElementById returns from then on. document.querySelector resolves
// id selectors (`#x`, `[id="x"]`) the same way; element queries search the element's own subtree with simple compound
// selectors (tag, #id, .class, [attr], [attr="v"], comma lists; for a descendant chain only the last part is matched).
// Pass `queryAll(element, selector)` to answer querySelectorAll for a fixture that needs specific nodes; return
// undefined from it to fall back to the subtree search.

const ID_SELECTOR = /^(?:#([\w-]+)|\[id="([^"]+)"\])$/;
const COMPOUND = /([#.]?[\w-]+|\[[\w-]+(?:[~^$*|]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]|\*)/g;

function matchesCompound(element, compound) {
  const parts = String(compound).replace(/:[\w-]+(?:\([^)]*\))?/g, '').match(COMPOUND) || [];
  if (!parts.length) return false;
  return parts.every((part) => {
    if (part === '*') return true;
    if (part[0] === '#') return element.id === part.slice(1);
    if (part[0] === '.') return element.classList?.contains(part.slice(1));
    if (part[0] === '[') {
      const [, key, op, raw] = part.match(/^\[([\w-]+)(?:([~^$*|]?=)(.*))?\]$/) || [];
      const actual = element.getAttribute?.(key);
      if (!op) return actual != null;
      const want = String(raw).replace(/^["']|["']$/g, '');
      if (op === '=') return actual === want;
      if (op === '^=') return actual?.startsWith(want);
      if (op === '*=') return actual?.includes(want);
      if (op === '~=') return String(actual || '').split(/\s+/).includes(want);
      return false;
    }
    return element.tagName === part.toUpperCase();
  });
}

export function matchesSelector(element, selector) {
  return String(selector).split(',').some((one) => {
    const chain = one.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
    return chain.length > 0 && matchesCompound(element, chain.at(-1));
  });
}

function descendants(element, out = []) {
  for (const child of element.children || []) { if (child?.nodeType === 1) { out.push(child); descendants(child, out); } }
  return out;
}

function camel(name) { return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

// The ids a static shell (index.html) declares, for `createFakeDocument({ ids })`.
export function shellIds(html) {
  return new Set([...String(html).matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
}

export function createFakeDocument({ queryAll = null, ids = null } = {}) {
  const byId = new Map();
  const declared = ids ? new Set(ids) : null;
  const listeners = new Map();
  const doc = {};

  function makeEventTarget(target) {
    const own = new Map();
    target.addEventListener = (type, fn) => { if (!own.has(type)) own.set(type, new Set()); own.get(type).add(fn); };
    target.removeEventListener = (type, fn) => { own.get(type)?.delete(fn); };
    target.dispatchEvent = (event) => { for (const fn of [...(own.get(event?.type) || [])]) fn.call(target, event); return true; };
    target.listenerCount = (type) => own.get(type)?.size || 0;
    return target;
  }

  function createElement(tagName = 'div') {
    let ownText = '';
    let ownId = '';
    const attrs = new Map();
    const classes = new Set();
    const element = makeEventTarget({
      tagName: String(tagName).toUpperCase(), nodeName: String(tagName).toUpperCase(), nodeType: 1, ownerDocument: doc,
      style: { setProperty() {}, removeProperty() {} }, dataset: {}, children: [], parentNode: null,
      hidden: false, disabled: false, value: '', checked: false, title: '',
      attrs,
      get id() { return ownId; },
      set id(value) { ownId = String(value ?? ''); if (ownId) byId.set(ownId, this); },
      get textContent() { return ownText + this.children.map((child) => child.textContent ?? '').join(''); },
      set textContent(text) { ownText = text == null ? '' : String(text); this.children = []; },
      get innerText() { return this.textContent; },
      set innerText(text) { this.textContent = text; },
      get innerHTML() { return ''; },
      set innerHTML(_) { ownText = ''; this.children = []; },
      get className() { return [...classes].join(' '); },
      set className(value) { classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)); },
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        toggle: (name, force) => { const on = force === undefined ? !classes.has(name) : !!force; if (on) classes.add(name); else classes.delete(name); return on; },
        contains: (name) => classes.has(name),
        replace: (a, b) => { if (!classes.has(a)) return false; classes.delete(a); classes.add(b); return true; }
      },
      get childNodes() { return this.children; },
      get firstChild() { return this.children[0] || null; },
      get lastChild() { return this.children.at(-1) || null; },
      get firstElementChild() { return this.children[0] || null; },
      get lastElementChild() { return this.children.at(-1) || null; },
      get childElementCount() { return this.children.length; },
      get options() { return descendants(this).filter((node) => node.tagName === 'OPTION'); },
      get selectedOptions() { const all = this.options; const hit = all.filter((o) => o.selected || (this.value !== '' && o.value === this.value)); return hit.length ? hit.slice(0, 1) : all.slice(0, 1); },
      get isConnected() { return true; },
      get nextElementSibling() { const s = this.parentNode?.children; return s ? s[s.indexOf(this) + 1] || null : null; },
      get previousElementSibling() { const s = this.parentNode?.children; return s ? s[s.indexOf(this) - 1] || null : null; },
      append(...items) { for (const item of items) this.appendChild(item); },
      prepend(...items) { for (const item of items.reverse()) this.insertBefore(item, this.children[0] || null); },
      appendChild(child) { return this.insertBefore(child, null); },
      insertBefore(child, ref) {
        const node = typeof child === 'string' ? doc.createTextNode(child) : child;
        if (node?.isFragment) { for (const item of [...node.children]) this.insertBefore(item, ref); node.children = []; return node; }
        node?.parentNode?.removeChild?.(node);
        const index = ref ? this.children.indexOf(ref) : -1;
        if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
        if (node && typeof node === 'object') node.parentNode = this;
        return node;
      },
      insertAdjacentElement(position, node) {
        if (position === 'afterbegin') this.prepend(node);
        else if (position === 'beforeend') this.appendChild(node);
        else if (this.parentNode) this.parentNode.insertBefore(node, position === 'beforebegin' ? this : this.nextElementSibling);
        return node;
      },
      insertAdjacentHTML() {}, insertAdjacentText() {},
      after(...items) { const p = this.parentNode; if (p) { const next = this.nextElementSibling; for (const item of items) p.insertBefore(item, next); } },
      before(...items) { const p = this.parentNode; if (p) for (const item of items) p.insertBefore(item, this); },
      replaceWith(...items) { const p = this.parentNode; if (p) { this.before(...items); this.remove(); } },
      removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); if (child) child.parentNode = null; return child; },
      remove() { this.parentNode?.removeChild(this); },
      replaceChildren(...items) { ownText = ''; for (const c of this.children) if (c && typeof c === 'object') c.parentNode = null; this.children = []; this.append(...items); },
      contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; },
      closest(selector) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matchesSelector(n, selector)) return n; return null; },
      matches(selector) { return matchesSelector(this, selector); },
      cloneNode() { return createElement(tagName); },
      setAttribute(key, value) {
        const text = String(value);
        attrs.set(key, text);
        if (key === 'id') this.id = text;
        if (key === 'class') this.className = text;
        if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = text;
      },
      // data-* attributes and dataset are one store, as in a browser.
      getAttribute(key) {
        if (key === 'id' && this.id) return this.id;
        if (key.startsWith('data-') && this.dataset[camel(key.slice(5))] !== undefined) return String(this.dataset[camel(key.slice(5))]);
        return attrs.has(key) ? attrs.get(key) : null;
      },
      hasAttribute(key) { return this.getAttribute(key) != null; },
      removeAttribute(key) { attrs.delete(key); if (key.startsWith('data-')) delete this.dataset[camel(key.slice(5))]; },
      toggleAttribute(key, force) { const on = force === undefined ? !attrs.has(key) : !!force; if (on) attrs.set(key, ''); else attrs.delete(key); return on; },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) {
        const fixed = queryAll ? queryAll(this, selector) : undefined;
        return fixed !== undefined ? fixed || [] : descendants(this).filter((node) => matchesSelector(node, selector));
      },
      getElementsByTagName(tag) { return descendants(this).filter((node) => node.tagName === String(tag).toUpperCase()); },
      getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
      getContext() { return null; },
      focus() {}, blur() {}, click() {}, scrollIntoView() {}, scrollTo() {},
      animate() { return { finished: Promise.resolve(), cancel() {} }; },
      scrollTop: 0, scrollLeft: 0, scrollHeight: 0, clientHeight: 0, clientWidth: 0, offsetWidth: 0, offsetHeight: 0
    });
    return element;
  }

  Object.assign(doc, makeEventTarget({
    nodeType: 9,
    createElement,
    createElementNS: (_, tag) => createElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), children: [], parentNode: null }),
    createDocumentFragment: () => Object.assign(createElement('#fragment'), { isFragment: true }),
    getElementById(id) {
      if (!byId.has(id) && (!declared || declared.has(id))) createElement('div').id = id;
      return byId.get(id) || null;
    },
    querySelector(selector) {
      const match = String(selector).trim().match(ID_SELECTOR);
      if (match) return doc.getElementById(match[1] || match[2]);
      return doc.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const fixed = queryAll ? queryAll(doc, selector) : undefined;
      if (fixed !== undefined) return fixed || [];
      const seen = new Set();
      for (const el of byId.values()) { seen.add(el); for (const d of descendants(el)) seen.add(d); }
      return [...seen].filter((node) => matchesSelector(node, selector));
    },
    getElementsByTagName() { return []; },
    hasNode: (id) => byId.has(id),
    nodes: byId,
    listeners
  }));
  doc.body = createElement('body');
  doc.documentElement = createElement('html');
  doc.head = createElement('head');
  doc.activeElement = doc.body;
  return doc;
}

// An event the factories' listeners accept (they read only `type` and `detail`).
export function fakeEvent(type, detail = undefined) { return { type, detail, target: null, preventDefault() {}, stopPropagation() {} }; }
