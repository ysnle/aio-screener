// v57.60: shared element factory for src/ui/components (was copied into ~20 component files).
// Argument order is (doc, tag, text, className); a few knowledge/screener files keep a
// swapped (doc, tag, className, text) local helper on purpose and do not import this.
export function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
