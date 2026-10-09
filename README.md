# jonah-george.com

Static portfolio site for Jonah George, built with [Astro](https://astro.build).

## Run it on your computer

You need Node.js 22 or newer (https://nodejs.org).

```sh
npm install      # once
npm run dev      # opens a live preview at http://localhost:4321
npm run build    # makes the finished site in dist/
```

## Where things live

| What                       | Where                                   |
| -------------------------- | --------------------------------------- |
| All project data           | `src/data/projects.json`                |
| Group names and order      | `src/data/projects.ts` (`GROUPS`)       |
| Sizes, colours, fonts      | `src/styles/global.css`                 |
| Homepage                   | `src/pages/index.astro`                 |
| Project page layout        | `src/components/ProjectPage.astro`      |
| About, contact, stills...  | `src/pages/*.astro`                     |
| Fonts                      | `public/fonts/` (see the README there)  |
| Showreel + poster          | `public/video/showreel.mp4`, `.jpg`     |
| Hover previews             | `public/video/previews/<slug>.mp4`      |

To add a project, add an entry to `projects.json` (menu order = file order) and
drop a preview clip named `<slug>.mp4` into `public/video/previews/`.

A project with a `todo` field shows a yellow TODO note on its page. Delete the
field once it's resolved.

## Videos

The files in `public/video` are placeholders. To replace them, install ffmpeg
(`brew install ffmpeg` on a Mac), then:

```sh
# Showreel: no encoding. Copy your exported file to public/video/showreel.mp4
# (H.264, no audio, "fast start") and make the poster from its first frame.

# Hover previews: name each source file after its slug, e.g. maana-homes.mov
./scripts/encode-previews.sh ~/Desktop/previews-source
# Smaller files: HEIGHT=720 CRF=28 ./scripts/encode-previews.sh ~/Desktop/previews-source
```

Don't run `scripts/make-placeholders.sh` after adding real footage: it
overwrites `public/video`.
