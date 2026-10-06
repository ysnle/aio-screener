// Reading text for the 95 산업·밸류체인 nodes and 19 domain overviews, merged from the three authoring parts. Loaded on demand by the
// atlas page (dynamic import) so the route's first paint does not carry ~45k characters of copy.
import { NODE_STORIES_1 } from './industry-node-stories-1.js';
import { NODE_STORIES_2 } from './industry-node-stories-2.js';
import { NODE_STORIES_3 } from './industry-node-stories-3.js';
export { INDUSTRY_DOMAIN_STORIES } from './industry-domain-stories.js';

export const INDUSTRY_NODE_STORIES = Object.freeze({ ...NODE_STORIES_1, ...NODE_STORIES_2, ...NODE_STORIES_3 });
