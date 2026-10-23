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
  /** Cloudflare Stream video ID, or a Stream link pasted from the dashboard. Wins over Vimeo when set. */
  stream?: string;
  /** Vimeo ID, used for projects not moved to Cloudflare Stream yet. */
  vimeo?: string;
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
/**
 * The player for "Play full": Cloudflare Stream when the project has a Stream
 * video, else Vimeo. Accepts a bare Stream ID or any Stream link (watch page,
 * embed code, iframe URL); a customer-xxxx.cloudflarestream.com address in the
 * link is kept, otherwise Cloudflare's general player address is used.
 */
export function filmEmbed(p: Project): string | undefined {
  const stream = p.stream?.trim();
  if (stream) {
    const id = stream.match(/\b[0-9a-f]{32}\b/i)?.[0];
    if (id) {
      const host = stream.match(/customer-[a-z0-9]+\.cloudflarestream\.com/i)?.[0];
      const base = host ? `https://${host}/${id}/iframe` : `https://iframe.videodelivery.net/${id}`;
      return `${base}?autoplay=true&letterboxColor=black`;
    }
  }
  const vimeo = p.vimeo?.trim();
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}?dnt=1&title=0&byline=0&portrait=0&autoplay=1`;
  return undefined;
}

export const previewSrc = (p: Project) => withVersion(p.preview ?? `/video/previews/${p.slug}.mp4`);

/** Images for a project page: one big thumbnail, then four stills. */
export const posterSrc = (p: Project) => withVersion(p.poster ?? `/images/work/${p.slug}/poster.jpg`);

/**
 * Adds a short fingerprint of the file to its URL (?v=...), so when an image
 * is replaced, browsers fetch the new one instead of showing a cached copy.
 * Runs at build time only.
 */
export function withVersion(src: string) {
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
