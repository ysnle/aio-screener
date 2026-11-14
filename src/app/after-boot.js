// Behaviours the first screen does not need to draw: they load in one chunk once boot has wired the routes.
import { installRoving } from '../ui/behaviors/roving.js';
import { installAnnouncements } from '../ui/behaviors/announce.js';
import { installToast } from '../ui/behaviors/toast.js';
import { installPageOutline } from '../ui/components/page-outline.js';

export function installAfterBoot({ root, documentRef }) {
  installAnnouncements({ root, documentRef });
  installToast({ root, documentRef });
  const stops = [installRoving({ root, documentRef }), installPageOutline({ root, documentRef })];
  return () => stops.forEach((stop) => stop());
}
