// Page chunk loaders. Kept in one place so the app can warm them up in the background: navigating to
// a page whose code has not been downloaded yet would otherwise suspend and flash a placeholder.
export const pageLoaders = {
  Login: () => import('../pages/Login'),
  Dashboard: () => import('../pages/Dashboard'),
  Outlets: () => import('../pages/Outlets'),
  OutletNew: () => import('../pages/OutletNew'),
  Menu: () => import('../pages/Menu'),
  MasterMenu: () => import('../pages/MasterMenu'),
  Inventory: () => import('../pages/Inventory'),
  Sales: () => import('../pages/Sales'),
  Receipt: () => import('../pages/Receipt'),
  Reports: () => import('../pages/Reports'),
  Users: () => import('../pages/Users'),
  UserNew: () => import('../pages/UserNew'),
  NotFound: () => import('../pages/NotFound'),
};

let preloaded = false;

/** Downloads every page chunk when the browser is idle (once per session). */
export function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  const run = () => Object.values(pageLoaders).forEach((load) => void load().catch(() => undefined));
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 300);
}
