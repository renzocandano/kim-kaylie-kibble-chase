// Procedurally draws simple 8-bit-style cat icons for Kim and Kaylie onto Phaser
// canvas textures, instead of depending on external image files. Based on their
// reference photos: orange tabby fur, white chest/face patch, green eyes. Kim is
// drawn with a noticeably wider body than Kaylie, matching their real builds.
// pixelArt:true in the Phaser config keeps the edges crisp/blocky at game size.

const COLORS = {
  furLight: '#e0973f',
  furDark: '#b5711f',
  white: '#fdf8ef',
  outline: '#3a2410',
  nose: '#f0a3ac',
  eye: '#5c8f3f',
  eyeShine: '#ffffff'
};

function drawCat(ctx, size, { bodyWidthScale = 1, earSpread = 1 } = {}) {
  const cx = size / 2;
  ctx.clearRect(0, 0, size, size);

  // tail (drawn first so the body overlaps its base)
  ctx.beginPath();
  ctx.strokeStyle = COLORS.furDark;
  ctx.lineWidth = size * 0.14;
  ctx.lineCap = 'round';
  ctx.moveTo(cx + size * 0.30 * bodyWidthScale, size * 0.78);
  ctx.quadraticCurveTo(size * 0.98, size * 0.78, size * 0.90, size * 0.42);
  ctx.stroke();

  // body
  const bodyW = size * 0.34 * bodyWidthScale;
  const bodyH = size * 0.30;
  ctx.beginPath();
  ctx.fillStyle = COLORS.furLight;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = size * 0.04;
  ctx.ellipse(cx, size * 0.72, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // chest patch
  ctx.beginPath();
  ctx.fillStyle = COLORS.white;
  ctx.ellipse(cx, size * 0.78, bodyW * 0.45, bodyH * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  const headR = size * 0.27;
  const headY = size * 0.36;
  ctx.beginPath();
  ctx.fillStyle = COLORS.furLight;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = size * 0.04;
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ears
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.fillStyle = COLORS.furLight;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = size * 0.03;
    ctx.moveTo(cx + side * headR * 0.55 * earSpread, headY - headR * 0.55);
    ctx.lineTo(cx + side * headR * 1.15 * earSpread, headY - headR * 1.55);
    ctx.lineTo(cx + side * headR * 0.05, headY - headR * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = COLORS.nose;
    ctx.moveTo(cx + side * headR * 0.55 * earSpread, headY - headR * 0.62);
    ctx.lineTo(cx + side * headR * 0.95 * earSpread, headY - headR * 1.25);
    ctx.lineTo(cx + side * headR * 0.18, headY - headR * 0.72);
    ctx.closePath();
    ctx.fill();
  });

  // face blaze
  ctx.beginPath();
  ctx.fillStyle = COLORS.white;
  ctx.ellipse(cx, headY + headR * 0.35, headR * 0.4, headR * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.fillStyle = COLORS.eye;
    ctx.ellipse(cx + side * headR * 0.38, headY - headR * 0.05, headR * 0.15, headR * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = COLORS.eyeShine;
    ctx.arc(cx + side * headR * 0.38 + headR * 0.05, headY - headR * 0.12, headR * 0.05, 0, Math.PI * 2);
    ctx.fill();
  });

  // nose
  ctx.beginPath();
  ctx.fillStyle = COLORS.nose;
  ctx.moveTo(cx - headR * 0.08, headY + headR * 0.15);
  ctx.lineTo(cx + headR * 0.08, headY + headR * 0.15);
  ctx.lineTo(cx, headY + headR * 0.26);
  ctx.closePath();
  ctx.fill();
}

// Creates (once) the 'cat-kim' and 'cat-kaylie' textures on the given scene. Safe
// to call every scene create() - guarded so a scene restart doesn't redraw them.
export function ensureCatTextures(scene, size = 48) {
  if (!scene.textures.exists('cat-kim')) {
    const tex = scene.textures.createCanvas('cat-kim', size, size);
    drawCat(tex.getContext(), size, { bodyWidthScale: 1.35, earSpread: 1 });
    tex.refresh();
  }
  if (!scene.textures.exists('cat-kaylie')) {
    const tex = scene.textures.createCanvas('cat-kaylie', size, size);
    drawCat(tex.getContext(), size, { bodyWidthScale: 1.0, earSpread: 1.05 });
    tex.refresh();
  }
}
