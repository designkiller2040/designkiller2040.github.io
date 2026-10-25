import { execSync } from 'node:child_process';

/** The commit this build of the site was made from, for the editor's "Publishing" badge. */
const commit = process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD').toString().trim();

export const GET = () => Response.json({ commit });
