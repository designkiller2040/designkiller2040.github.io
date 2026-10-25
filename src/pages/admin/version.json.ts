import { execSync } from 'node:child_process';

/** The commit this build of the site was made from, for the editor's "Publishing" badge. */
// HEAD rather than GITHUB_SHA: the deploy workflow may add a commit of its own first.
const commit = execSync('git rev-parse HEAD').toString().trim();

export const GET = () => Response.json({ commit });
