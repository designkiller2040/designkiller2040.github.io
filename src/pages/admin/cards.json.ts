import { posterSrc, previewSrc, projects } from '../../data/projects';

/** Preview clip and thumbnail per project, for the card view in the editor (/admin/). */
export const GET = () =>
  Response.json(
    projects.map((p) => ({ title: p.title, slug: p.slug, preview: previewSrc(p), poster: posterSrc(p) })),
  );
