// Auto-heal the .next cache before `next dev`.
//
// `next dev` and `next build` share the same frontend/.next folder. On Windows,
// starting `next dev` on top of a leftover PRODUCTION build (e.g. after `npm run
// fast`) crashes with `EINVAL: readlink ...\.next\static\chunks\app\...page-*.js`
// and — via `concurrently -k` — takes the backend and ML down too.
//
// A production build writes `.next/BUILD_ID`; `next dev` does not. So if we see
// BUILD_ID, the .next folder is a production build: wipe it so dev starts clean.
// Normal dev→dev restarts have no BUILD_ID, so their fast incremental cache is kept.

import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextDir = join(frontendRoot, '.next');
const prodMarker = join(nextDir, 'BUILD_ID');

if (existsSync(prodMarker)) {
  try {
    rmSync(nextDir, { recursive: true, force: true });
    console.log('[predev] Cleared a leftover production build from .next so dev starts clean.');
  } catch (err) {
    console.warn('[predev] Could not remove .next automatically:', err?.message ?? err);
    console.warn('[predev] If dev fails to start, delete the frontend/.next folder manually.');
  }
}
