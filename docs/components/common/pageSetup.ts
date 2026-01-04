/**
 * pageSetup.ts - Common page initialization shared across all doc pages
 */

/**
 * Highlights the currently active link in the sidebar navigation
 */
export function highlightActiveSidebarLink(): void {
  const currentPath = window.location.pathname;
  const sidebarLinks = document.querySelectorAll('.sidebar .section-nav a');

  sidebarLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && currentPath.endsWith(href.replace(/\/$/, '') + '/')) {
      link.classList.add('active');
    } else if (href && currentPath === href) {
      link.classList.add('active');
    }
  });
}

/**
 * Initialize common page features
 * Call this on DOMContentLoaded for all doc pages
 */
export function initPageSetup(): void {
  highlightActiveSidebarLink();
}
