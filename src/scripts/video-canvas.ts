// Safari can draw its own play/pause buttons over a <video>, even without
// the controls attribute, and on some setups CSS can't hide them. In Safari
// we lay a <canvas> over each video and paint the frames onto it, so the
// buttons stay underneath, out of sight. Other browsers keep the plain
// video. (Add ?canvas to a page URL to try the canvas in any browser.)

const useCanvas =
  /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent) ||
  new URLSearchParams(location.search).has('canvas');

export function coverWithCanvas(video: HTMLVideoElement) {
  if (!useCanvas) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'video-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  video.after(canvas);
  const ctx = canvas.getContext('2d')!;

  const draw = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!w || !h || !vw || !vh || video.readyState < 2) return;
    // Same framing as object-fit: cover, at screen sharpness but never
    // more pixels than the video itself has.
    const fit = Math.max(w / vw, h / vh);
    const ratio = Math.max(1, Math.min(devicePixelRatio || 1, 1 / fit));
    const cw = Math.round(w * ratio);
    const ch = Math.round(h * ratio);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const s = Math.max(cw / vw, ch / vh);
    ctx.drawImage(video, (cw - vw * s) / 2, (ch - vh * s) / 2, vw * s, vh * s);
  };

  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  const loop = () => {
    draw();
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(loop);
    else requestAnimationFrame(loop);
  };
  loop();
  video.addEventListener('loadeddata', draw);
  video.addEventListener('seeked', draw);
  addEventListener('resize', draw);
}

export function coverAll(selector: string) {
  for (const v of document.querySelectorAll<HTMLVideoElement>(selector)) coverWithCanvas(v);
}
