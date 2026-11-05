import { GLView } from 'expo-gl';
import type { WebGLRenderer } from 'three';
import { THEME } from '../ui/theme';
import { BoardShot, contextOf, snapshotUri } from './boardShot';
import { loadShareArt } from './shareArt';
import { CARD, DrawItem, hexTint, layoutCard, ShareResult } from './shareCard';
import { readyForReset } from './glReset';
import { keepOnly } from './tempFiles';

/**
 * The finished card, as a PNG file — made ON DEMAND, when the player
 * taps "Share your win", never on its own.
 *
 * HOW, AND WHY THIS WAY. React Native cannot draw a picture into a
 * file without a native view-capture package, and this game adds no
 * packages for this. What it does have is a GL context (the board's)
 * and expo-gl, which can both load an image file straight into a
 * texture (`texImage2D` with `{ localUri }`) and write any framebuffer
 * out as a PNG (`takeSnapshotAsync` with `framebuffer`). So the card is
 * drawn as a dozen textured rectangles into a 1080 x 1350 framebuffer
 * of our own — the board picture, the banner, the paper, the words —
 * and expo-gl writes the file. The decode and the encode are native;
 * JavaScript issues about forty GL calls and waits.
 *
 * Plain WebGL rather than three for the drawing. The whole thing is a
 * two-dimensional "put this picture here" list (shareCard.ts), one
 * shader covers it, and going through three would have meant reaching
 * into its render-target internals to find the framebuffer id the
 * snapshot needs. The only part of three used is `resetState()`, which
 * tells it its context was borrowed.
 *
 * Colour: the textures are uploaded raw and drawn raw, so the pixels in
 * the file are the pixels in the pictures; no colour management is in
 * the way to shift the game's own ink and paper.
 *
 * Nothing here throws. Null means "couldn't make the picture", and the
 * sheet says so.
 */

const VERTEX = `
attribute vec2 aCorner;
uniform vec4 uRect;
uniform vec4 uUv;
uniform vec2 uCard;
varying vec2 vUv;
void main() {
  vec2 p = uRect.xy + aCorner * uRect.zw;
  gl_Position = vec4(p.x / uCard.x * 2.0 - 1.0, 1.0 - p.y / uCard.y * 2.0, 0.0, 1.0);
  vUv = mix(uUv.xy, uUv.zw, aCorner);
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uTex, vUv);
  gl_FragColor = vec4(c.rgb * uTint, c.a);
}`;

function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('no shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  }
  return shader;
}

/** A texture holding the image file at `localUri`, decoded natively by expo-gl. */
function textureFromFile(gl: WebGL2RenderingContext, localUri: string): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('no texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // expo-gl's extension: an object with `localUri` is read from disk.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, {
    localUri,
  } as unknown as TexImageSource);
  return texture;
}

export async function composeWinCard(
  renderer: WebGLRenderer | null,
  shot: BoardShot,
  result: ShareResult,
): Promise<string | null> {
  const gl = contextOf(renderer);
  if (!gl || !renderer) return null;
  const art = await loadShareArt();
  if (!art) return null;
  // Still here, after the wait? The battle may have been left.
  if (contextOf(renderer) !== gl) return null;
  // Before ANY GL call: a reset that throws breaks the board (glReset.ts).
  if (!readyForReset(gl, renderer.domElement)) return null;

  const items: DrawItem[] = layoutCard(shot, result);
  const { width, height } = CARD;
  const textures = new Map<string, WebGLTexture>();
  let program: WebGLProgram | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  let buffer: WebGLBuffer | null = null;
  let target: WebGLTexture | null = null;
  let framebuffer: WebGLFramebuffer | null = null;
  let uri: string | null = null;

  try {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram();
    if (!program) throw new Error('no program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    }

    textures.set('board', textureFromFile(gl, shot.uri));
    for (const item of items) {
      if (item.art !== 'board' && !textures.has(item.art)) {
        textures.set(item.art, textureFromFile(gl, art[item.art]));
      }
    }

    target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('framebuffer');
    }

    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const [r, g, b] = hexTint(THEME.ground);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    /*
      A vertex array of our own. The attribute below is switched on in
      whichever vertex array is bound, and the one bound now is the last
      one three drew with: switched on there, it would point one of the
      board's shapes at this little buffer and then at nothing once the
      buffer is deleted.
    */
    vertexArray = gl.createVertexArray();
    gl.bindVertexArray(vertexArray);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, 'aCorner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'uCard'), width, height);
    gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);
    const uRect = gl.getUniformLocation(program, 'uRect');
    const uUv = gl.getUniformLocation(program, 'uUv');
    const uTint = gl.getUniformLocation(program, 'uTint');
    gl.activeTexture(gl.TEXTURE0);

    for (const item of items) {
      const texture = textures.get(item.art);
      if (!texture) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform4f(uRect, item.x, item.y, item.w, item.h);
      gl.uniform4f(uUv, item.uv[0], item.uv[1], item.uv[2], item.uv[3]);
      gl.uniform3f(uTint, item.tint[0], item.tint[1], item.tint[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.resetState();

    const snap = await GLView.takeSnapshotAsync(gl, {
      framebuffer,
      rect: { x: 0, y: 0, width, height },
      format: 'png',
    });
    uri = snapshotUri(snap);
  } catch {
    uri = null;
  } finally {
    try {
      for (const texture of textures.values()) gl.deleteTexture(texture);
      if (target) gl.deleteTexture(target);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      gl.bindVertexArray(null);
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      renderer.resetState();
    } catch {
      // The context is gone; so is everything in it.
    }
  }
  keepOnly('card', uri);
  return uri;
}
