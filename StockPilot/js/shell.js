// Shared layout shell — injects sidebar + topbar into .app-shell
export function renderShell(activePage, pageTitle = "Dashboard") {
  const pages = [
    {
      id: "dashboard", label: "Dashboard", href: "dashboard.html", section: "overview",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
    },
    {
      id: "inventory", label: "Inventory", href: "inventory.html", section: "overview",
      badge: "3", badgeClass: "danger",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`
    },
    {
      id: "orders", label: "Pending carts", href: "orders.html", section: "overview",
      badge: "1", badgeClass: "warn",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>`
    },
    {
      id: "history", label: "Order history", href: "history.html", section: "reports",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
    },
    {
      id: "analytics", label: "Analytics", href: "analytics.html", section: "reports",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
    },
    {
      id: "settings", label: "Settings", href: "settings.html", section: "account",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
    }
  ];

  const sections = { overview: "Overview", reports: "Reports", account: "Account" };
  let navHTML = "";
  let lastSection = null;
  for (const p of pages) {
    if (p.section !== lastSection) {
      navHTML += `<span class="nav-section-label">${sections[p.section]}</span>`;
      lastSection = p.section;
    }
    navHTML += `
      <a href="${p.href}" class="nav-item ${p.id === activePage ? "active" : ""}">
        ${p.icon}
        ${p.label}
        ${p.badge ? `<span class="nav-badge ${p.badgeClass || ""}">${p.badge}</span>` : ""}
      </a>`;
  }

  const sidebarHTML = `
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <div class="logo-text">HomeAgent</div>
          <div class="logo-badge">AI Inventory</div>
        </div>
      </div>
      ${navHTML}
      <div class="sidebar-footer">
        <div class="user-card" id="user-card-btn">
          <img id="user-avatar" class="user-avatar" src="" alt="avatar"
            onerror="this.style.display='none';document.getElementById('avatar-fallback').style.display='flex'" />
          <div class="user-avatar-fallback" id="avatar-fallback" style="display:none">?</div>
          <div class="user-info">
            <div class="user-name" id="user-name">Loading…</div>
            <div class="user-email" id="user-email"></div>
          </div>
        </div>
      </div>
    </aside>`;

  const topbarHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <div class="page-title">${pageTitle}</div>
      </div>
      <div class="topbar-right">
        <span class="badge badge-success"><span class="pulse-dot"></span>&nbsp;All agents running</span>
        <span class="badge badge-warn">3 low-stock</span>
        <button id="signout-btn" class="btn btn-ghost" style="font-size:12px;padding:5px 12px">Sign out</button>
      </div>
    </header>`;

  const shell = document.querySelector(".app-shell");
  if (shell) {
    const main = shell.querySelector(".main-content");
    shell.insertAdjacentHTML("afterbegin", sidebarHTML + topbarHTML);
    // Ensure main-content is still last
    if (main) shell.appendChild(main);
  }

  // Global toast helper
  window.showToast = function(msg, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  };
}
