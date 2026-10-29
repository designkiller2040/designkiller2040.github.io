import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/** Role -> names, in the order shown on the page. The usual roles are in CREDIT_ORDER; any other role works too. */
export type Credits = Partial<Record<CreditLabel, string>> & Record<string, string | undefined>;

export interface Project {
  slug: string;
  title: string;
  /** Position within its group in the menu (1 = top). */
  order?: number;
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
  /** Where the automatic hover clip starts in the Cloudflare film, in seconds (used when no clip is uploaded). */
  previewStart?: number;
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

/** One JSON file per project in src/data/projects/ (one editor entry each), in menu order. */
const files = import.meta.glob<Project>('./projects/*.json', { eager: true, import: 'default' });
const groupIndex = (p: Project) => GROUPS.findIndex((g) => g.key === p.group);
/** File paths from the editor sometimes lack the leading slash; add it. */
const rooted = (src?: string) => (src && !/^(\/|https?:)/.test(src) ? `/${src}` : src);
export const projects = Object.values(files)
  .map((p) => ({ ...p, preview: rooted(p.preview), poster: rooted(p.poster), stills: p.stills?.map((s) => rooted(s)!) }))
  .sort(
  (a, b) => groupIndex(a) - groupIndex(b) || (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title),
);

export const menuLabel = (p: Project) => p.menuLabel ?? p.title;
/**
 * The player for "Play full": Cloudflare Stream when the project has a Stream
 * video, else Vimeo. Accepts a bare Stream ID or any Stream link (watch page,
 * embed code, iframe URL); a customer-xxxx.cloudflarestream.com address in the
 * link is kept, otherwise Cloudflare's general player address is used.
 *
 * With both set, `check` is the Stream film's playlist and `backup` the Vimeo
 * player: the page tries the playlist when the film opens and switches to
 * Vimeo if Cloudflare can't play it (still processing, failed, or down).
 */
export function filmEmbed(p: Project): { embed: string; backup?: string; check?: string } | undefined {
  const vimeo = vimeoEmbed(p.vimeo);
  const stream = p.stream?.trim();
  const id = stream?.match(/\b[0-9a-f]{32}\b/i)?.[0];
  if (stream && id) {
    const host = stream.match(/customer-[a-z0-9]+\.cloudflarestream\.com/i)?.[0];
    const base = host ? `https://${host}/${id}/iframe` : `https://iframe.videodelivery.net/${id}`;
    const check = host ? `https://${host}/${id}/manifest/video.m3u8` : `https://videodelivery.net/${id}/manifest/video.m3u8`;
    return { embed: `${base}?autoplay=true&letterboxColor=black`, backup: vimeo, check: vimeo && check };
  }
  return vimeo ? { embed: vimeo } : undefined;
}

/** Vimeo player address from a Vimeo number, "number/code" (unlisted films) or a pasted Vimeo link. */
function vimeoEmbed(v?: string) {
  const m = v?.trim().match(/^(?:.*vimeo\.com\/(?:.*\/)?)?([0-9]{5,})(?:\/([0-9a-f]{6,}))?/i);
  if (!m) return undefined;
  const h = m[2] ?? v!.match(/[?&]h=([0-9a-f]+)/i)?.[1];
  return `https://player.vimeo.com/video/${m[1]}?${h ? `h=${h}&` : ''}dnt=1&title=0&byline=0&portrait=0&autoplay=1`;
}

/**
 * Hover preview clip. Uploads can be .mov or another format; the build turns
 * those into an .mp4 next to them (scripts/convert-previews.sh), so always
 * link the .mp4 name.
 */
/**
 * The project's clip: the uploaded one, else the 3 seconds the build cuts from
 * its Cloudflare film (scripts/stream-previews.sh), else the old slug-based name.
 */
const clipOf = (p: Project) => {
  const auto = `/video/previews/auto/${p.slug}.mp4`;
  return p.preview ?? (existsSync(`public${auto}`) ? auto : `/video/previews/${p.slug}.mp4`);
};

export const previewSrc = (p: Project) => {
  const clip = clipOf(p);
  if (!existsSync(`public${clip}`)) return undefined; // no clip: no hover preview
  return withVersion(clip).replace(/\.(mov|m4v|mkv|webm|mxf)(?=\?|$)/i, '.mp4');
};

/**
 * Big thumbnail for a project page: the uploaded "Thumbnail image", else the
 * frame at 1 second of its preview clip (made by scripts/preview-frames.sh for
 * HD clips), else the old slug-based poster, else none.
 */
export const posterSrc = (p: Project) => {
  if (p.poster && existsSync(`public${p.poster}`)) return withVersion(p.poster);
  const clip = clipOf(p);
  const frame = `/images/frames/${clip.split('/').pop()!.replace(/\.[^.]+$/, '')}.jpg`;
  if (existsSync(`public${frame}`)) return withVersion(frame);
  const poster = `/images/work/${p.slug}/poster.jpg`;
  return existsSync(`public${poster}`) ? withVersion(poster) : undefined; // none yet: plain black
};

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
