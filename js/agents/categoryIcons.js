// ============================================================
//  js/agents/categoryIcons.js
//  Shared SVG icon + color map for product categories.
//  Used by: dashboard.html, orders.html, inventory.html
// ============================================================

export const categoryIcons = {
  Dairy:      { color:"#2563EB", bg:"rgba(37,99,235,0.10)",  svg:'<path d="M8 2h8M9 2v4l-3 4v10a2 2 0 002 2h8a2 2 0 002-2V10l-3-4V2"/>' },
  Pantry:     { color:"#D97706", bg:"rgba(217,119,6,0.10)",  svg:'<path d="M3 3h18v18H3z"/><path d="M3 9h18"/>' },
  Vegetables: { color:"#16A34A", bg:"rgba(22,163,74,0.10)",  svg:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/>' },
  Spices:     { color:"#DC2626", bg:"rgba(220,38,38,0.10)",  svg:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>' },
  Bakery:     { color:"#D97706", bg:"rgba(217,119,6,0.10)",  svg:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M7 9V6a5 5 0 0110 0v3"/>' },
  Cleaning:   { color:"#7C3AED", bg:"rgba(124,58,237,0.10)", svg:'<path d="M3 3l18 18M9 3v6m6-6v6M3 9h18"/>' },
  Beverages:  { color:"#92400E", bg:"rgba(146,64,14,0.10)",  svg:'<path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>' },
  Meat:       { color:"#B91C1C", bg:"rgba(185,28,28,0.10)",  svg:'<path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z"/>' },
  Other:      { color:"#6B7280", bg:"rgba(107,114,128,0.10)",svg:'<circle cx="12" cy="12" r="9"/>' },
  Default:    { color:"#2563EB", bg:"rgba(37,99,235,0.10)",  svg:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>' },
};

/** Returns a full <svg> string for the given category, sized via parent .item-icon-cell etc. */
export function categoryIcon(category) {
  const c = categoryIcons[category] || categoryIcons.Default;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${c.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.svg}</svg>`;
}

/** Returns the tinted background color for the given category. */
export function categoryBg(category) {
  return (categoryIcons[category] || categoryIcons.Default).bg;
}
