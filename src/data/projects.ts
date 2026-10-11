import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
  /** Uploaded files (paths inside public/). Missing ones fall back to the slug-based names below. */
  preview?: string;
  poster?: string;
  stills?: string[];
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
export const previewSrc = (p: Project) => withVersion(p.preview ?? `/video/previews/${p.slug}.mp4`);

/** Images for a project page: one big thumbnail, then four stills. */
export const posterSrc = (p: Project) => withVersion(p.poster ?? `/images/work/${p.slug}/poster.jpg`);

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
/** Up to four stills (from the editor, else shot-1.jpg ... shot-4.jpg); missing ones are skipped. */
export const stillSrcs = (p: Project) =>
  (p.stills ?? [1, 2, 3, 4].map((n) => `/images/work/${p.slug}/shot-${n}.jpg`))
    .slice(0, 4)
    .filter((src) => existsSync(`public${src}`))
    .map(withVersion);
