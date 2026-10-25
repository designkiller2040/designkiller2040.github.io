// Connects preview clips uploaded in the editor's Assets page to their
// projects, by file name. A clip whose name contains all the words of a
// project's page address (e.g. "Givenchy TK 360 Web.mov" for givenchy-tk-360)
// becomes that project's hover preview, as long as the project still uses its
// old placeholder clip (<slug>.mp4). A clip picked by hand in the editor is
// never replaced. Run by the deploy workflow before the build.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = 'src/data/projects';
const CLIPS = 'public/video/previews';
const words = (name) => new Set(name.toLowerCase().replace(/\.[a-z0-9]+$/, '').split(/[^a-z0-9]+/).filter(Boolean));

const projects = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: `${DIR}/${f}`, data: JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) }));
const clips = readdirSync(CLIPS).filter((f) => /\.(mp4|mov|m4v|mkv|webm|mxf)$/i.test(f));

for (const clip of clips) {
  const clipWords = words(clip);
  // The project whose page address matches the most words (all of its words must be in the name).
  const match = projects
    .filter(({ data }) => clip !== `${data.slug}.mp4` && [...words(data.slug)].every((w) => clipWords.has(w)))
    .sort((a, b) => words(b.data.slug).size - words(a.data.slug).size)[0];
  if (!match) continue;
  const { data } = match;
  const current = data.preview ?? `/video/previews/${data.slug}.mp4`;
  if (current.replace(/^\//, '') !== `video/previews/${data.slug}.mp4`) continue; // already has a real clip
  data.preview = `/video/previews/${clip}`;
  writeFileSync(match.file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${data.slug}: preview → ${clip}`);
}
