import { createResourceBag } from '../../app/lifecycle.js';

export function createLegacyObserverPage(route, { documentRef } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (page) {
        page.dataset.aioArchitectureRoute = route;
        bag.add(() => {
          if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        });
      }
      return () => bag.dispose();
    }
  };
}
