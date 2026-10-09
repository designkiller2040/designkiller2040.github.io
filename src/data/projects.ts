import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import raw from './projects.json';

export type Credits = Partial<Record<CreditLabel, string>>;

export interface Project {
  slug: string;
  title: string;
  /** Shorter label for the homepage menu. Falls back to title. */
  menuLabel?: string;
  group: GroupKey;
  vimeo: string;
  credits: Credits;
  /** Short description shown under "about film:" on the project page. */
  about?: string;
  /** Open question about this project's data. Shown on its page until removed. */
  todo?: string;
}

export type GroupKey = 'commercial' | 'music' | 'concept';

export const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'commercial', label: 'commercial works' },
  { key: 'music', label: 'music videos' },
  { key: 'concept', label: 'concept videos' },
];

export const CREDIT_ORDER = ['Location', 'Producers', 'Co-Director', 'DP', 'Agency', 'Prod Co', 'Edit'] as const;

export type CreditLabel = (typeof CREDIT_ORDER)[number];

export const projects = raw as Project[];

export const menuLabel = (p: Project) => p.menuLabel ?? p.title;
export const previewSrc = (p: Project) => `/video/previews/${p.slug}.mp4`;

/** Images for a project page: one big thumbnail, then four stills. */
export const posterSrc = (p: Project) => withVersion(`/images/work/${p.slug}/poster.jpg`);

/**
 * Adds a short fingerprint of the file to its URL (?v=...), so when an image
 * is replaced, browsers fetch the new one instead of showing a cached copy.
 * Runs at build time only.
 */
function withVersion(src: string) {
  try {
    const hash = createHash('md5').update(readFileSync(`public${src}`)).digest('hex').slice(0, 8);
    return `${src}?v=${hash}`;
  } catch {
    return src;
  }
}
export const stillSrcs = (p: Project) => [1, 2, 3, 4].map((n) => `/images/work/${p.slug}/shot-${n}.jpg`);
