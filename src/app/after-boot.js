// Behaviours the first screen does not need to draw: they load in one chunk once boot has wired the routes.
import { installRoving } from '../ui/behaviors/roving.js';
import { installAnnouncements } from '../ui/behaviors/announce.js';
import { installToast } from '../ui/behaviors/toast.js';
import { installPageViews } from '../ui/navigation/page-views.js';
import { installMasterDetail } from '../ui/behaviors/master-detail.js';

function followThemeColor(root, documentRef) {
  const meta = documentRef.querySelector('meta[name="theme-color"]');
  const update = () => { if (meta) meta.setAttribute('content', root.getComputedStyle(documentRef.body).backgroundColor); };
  documentRef.addEventListener('aio:colorThemeChanged', update);
  update();
  return () => documentRef.removeEventListener('aio:colorThemeChanged', update);
}

export function installAfterBoot({ root, documentRef }) {
  installAnnouncements({ root, documentRef });
  installToast({ root, documentRef });
  const stops = [installRoving({ root, documentRef }), installPageViews({ root, documentRef }), installMasterDetail({ root, documentRef }), followThemeColor(root, documentRef)];
  return () => stops.forEach((stop) => stop());
}
