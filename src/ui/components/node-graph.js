// One node-and-line graph for every map that draws boxes joined by lines: the 개념·분석 concept map and the 산업 지도 ›
// AI 지도 데이터센터·전력 chain. Input is { nodes, edges } with each node placed in percent
// of the drawing (x 0–100 left to right, y 0–100 top to bottom); the nodes are HTML boxes (so text never scales with the
// drawing) and the lines one SVG under them. The caller makes each node's control, so a node opens whatever its screen
// opens, and a node is a real button a keyboard reaches.
//
// Two fits. 'stretch' (the concept map): the drawing fills the box at any shape, lines stretched with it. 'aspect': the box
// keeps the drawing's shape (width × height), so a line keeps its angle, its dash and its arrow head; a screen too narrow
// for the boxes shows the caller's list instead (ai-map.css hides the canvas below 744px).
// Styles: the caller's class prefix ('principles-graph' rules in index.html, 'nmap' rules in src/ui/styles/ai-map.css).

const SVG_NS = 'http://www.w3.org/2000/svg';
let markerSerial = 0;

function box(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Positions come from the visible subgraph, never hand-set coordinates (two node families with their own x/y once
// stacked boxes on one spot). Columns = hop distance from the selected node (unreached nodes in a last column), rows
// spread evenly inside a column, so no two boxes share a position and labels sit between columns.
export function layoutConceptGraph(selectedId, visibleNodes, visibleEdges) {
  const ids = visibleNodes.map((node) => node.id);
  const visible = new Set(ids);
  const distance = new Map([[selectedId, 0]]);
  const queue = [selectedId];
  while (queue.length) {
    const current = queue.shift();
    visibleEdges.forEach((edge) => {
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (next && visible.has(next) && !distance.has(next)) { distance.set(next, distance.get(current) + 1); queue.push(next); }
    });
  }
  const reached = Math.max(0, ...distance.values());
  const columnOf = (id) => (distance.has(id) ? distance.get(id) : reached + 1);
  const columns = new Map();
  visibleNodes.forEach((node) => { const c = columnOf(node.id); if (!columns.has(c)) columns.set(c, []); columns.get(c).push(node); });
  const order = [...columns.keys()].sort((a, b) => a - b);
  const positions = new Map();
  order.forEach((column, index) => {
    const nodes = columns.get(column).sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || String(a.title).localeCompare(String(b.title)));
    const x = order.length === 1 ? 50 : 12 + index * (76 / (order.length - 1));
    nodes.forEach((node, row) => positions.set(node.id, { x, y: ((row + 1) / (nodes.length + 1)) * 100 }));
  });
  const tallest = Math.max(1, ...[...columns.values()].map((list) => list.length));
  return { positions, minHeight: Math.max(420, tallest * 62 + 40) };
}

/**
 * Columns in reading order: each column is a list of node ids, placed left to right with its rows spread evenly.
 * @returns {Map<string,{x:number,y:number}>}
 */
export function columnPositions(columns, { left = 10, right = 90, top = 0, bottom = 100 } = {}) {
  const positions = new Map();
  const list = columns.filter((column) => column.length);
  list.forEach((column, index) => {
    const x = list.length === 1 ? (left + right) / 2 : left + index * ((right - left) / (list.length - 1));
    column.forEach((id, row) => positions.set(id, { x, y: top + ((row + 1) / (column.length + 1)) * (bottom - top) }));
  });
  return positions;
}

/**
 * @param {Document} doc
 * @param {object} spec
 * @param {Array<{id:string}>} spec.nodes
 * @param {Array<{from:string,to:string,className?:string,label?:string,title?:string,arrow?:boolean,active?:boolean}>} spec.edges
 * @param {Map<string,{x:number,y:number}>} spec.positions  percent positions by node id
 * @param {(node:object)=>Node} spec.renderNode             the node's control (a button)
 * @param {{x:number,y:number}} [spec.trim]               a node box's half size in percent: lines stop at the box edge
 * @param {string} [spec.prefix]                             class prefix: <prefix>-canvas, -edge, -node, -edge-label
 * @param {'stretch'|'aspect'} [spec.fit]
 * @param {number} [spec.width] [spec.height]               the drawing's shape for 'aspect'
 * @param {string} [spec.label]                              the drawing's accessible name
 * @param {string|null} [spec.selectedId]
 * @param {number} [spec.minHeight]                          'stretch' only
 */
export function createNodeGraph(doc, { nodes, edges, positions, renderNode, trim = null, prefix = 'nmap', classes = {}, fit = 'aspect', width = 100, height = 100, label = '', selectedId = null, minHeight = 0, nodeClass = null } = {}) {
  const cls = { canvas: `${prefix}-canvas`, edge: `${prefix}-edge`, label: `${prefix}-edge-label`, node: `${prefix}-node`, arrow: `${prefix}-arrow`, ...classes };
  const canvas = box(doc, 'div', cls.canvas);
  const vw = fit === 'aspect' ? width : 100;
  const vh = fit === 'aspect' ? height : 100;
  if (fit === 'aspect') canvas.style.aspectRatio = `${width} / ${height}`;
  if (minHeight) canvas.style.minHeight = `${minHeight}px`;
  const point = (p) => ({ x: (p.x / 100) * vw, y: (p.y / 100) * vh, px: p.x, py: p.y });
  const at = (id) => point(positions.get(id) || { x: 50, y: 50 });
  // Moves an end point back toward `toward` until it leaves the box of half size trim.x × trim.y around it.
  const clip = (end, toward) => {
    const hw = (trim.x / 100) * vw, hh = (trim.y / 100) * vh;
    const dx = toward.x - end.x, dy = toward.y - end.y;
    const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    if (!Number.isFinite(t) || t >= 1) return;
    end.x += dx * t; end.y += dy * t; end.px = (end.x / vw) * 100; end.py = (end.y / vh) * 100;
  };
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  svg.setAttribute('preserveAspectRatio', 'none'); // lines in the same space as the HTML nodes; 'aspect' keeps the box's shape
  svg.setAttribute('role', 'img');
  if (label) svg.setAttribute('aria-label', label);
  const markers = {};
  const marker = (active) => {
    const key = active ? 'active' : 'base';
    if (markers[key]) return markers[key];
    markerSerial += 1;
    const id = `${prefix}-arrow-${key}-${markerSerial}`;
    let defs = svg.querySelector('defs');
    if (!defs) { defs = doc.createElementNS(SVG_NS, 'defs'); svg.prepend(defs); }
    const m = doc.createElementNS(SVG_NS, 'marker');
    m.setAttribute('id', id);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '9');
    m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '7');
    m.setAttribute('markerHeight', '7');
    m.setAttribute('markerUnits', 'userSpaceOnUse');
    m.setAttribute('orient', 'auto');
    const head = doc.createElementNS(SVG_NS, 'path');
    head.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    head.setAttribute('class', `${cls.arrow}${active ? ' is-active' : ''}`);
    m.appendChild(head);
    defs.appendChild(m);
    markers[key] = id;
    return id;
  };
  const known = new Set(nodes.map((node) => node.id));
  const labels = [];
  for (const edge of edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) continue;
    const a = at(edge.from);
    const b = at(edge.to);
    // With `trim` (a node's half size in percent of the drawing) a line stops at the edge of its boxes, so the arrow head
    // shows instead of sitting under the box.
    if (trim) { clip(b, a); clip(a, b); }
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M${a.x},${a.y} L${b.x},${b.y}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('class', `${cls.edge}${edge.className ? ` ${edge.className}` : ''}${edge.active ? ' is-active' : ''}`);
    if (edge.title) path.setAttribute('aria-label', edge.title);
    if (edge.arrow) path.setAttribute('marker-end', `url(#${marker(!!edge.active)})`);
    svg.appendChild(path);
    if (edge.label) {
      // HTML label at the line's midpoint, so the drawing's scale never stretches the text.
      const text = box(doc, 'span', `${cls.label}${edge.active ? ' is-active' : ''}`, edge.label);
      text.style.left = `${(a.px + b.px) / 2}%`;
      text.style.top = `${(a.py + b.py) / 2}%`;
      if (edge.title && !text.title) text.title = edge.title;
      labels.push(text);
    }
  }
  canvas.appendChild(svg);
  labels.forEach((item) => canvas.appendChild(item));
  for (const node of nodes) {
    const p = positions.get(node.id) || { x: 50, y: 50 };
    const item = box(doc, 'div', `${cls.node}${node.id === selectedId ? ' is-selected' : ''}${nodeClass ? ` ${nodeClass(node)}` : ''}`);
    item.style.left = `${p.x}%`;
    item.style.top = `${p.y}%`;
    item.appendChild(renderNode(node));
    canvas.appendChild(item);
  }
  return canvas;
}
