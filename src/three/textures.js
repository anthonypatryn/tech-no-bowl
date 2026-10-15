// Texture cache for the cube atlases. One image per uniform; each face is a clone of it with its own
// offset/repeat (clones share the image, so the GPU uploads it once).
import * as THREE from 'three';
import { artUrl, DOWNS } from '../data/art';

const loader = new THREE.TextureLoader();
const images = new Map();   // file -> Texture (base)
const tiles = new Map();    // file|row|col -> Texture
const waiting = new Map();  // file -> clones made before the image arrived (they must re-upload once it does)

function prep(t) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;       // the art is pixel art: keep it crisp up close
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

export function baseTexture(file) {
  let t = images.get(file);
  if (!t) {
    t = prep(loader.load(artUrl(file), () => {
      (waiting.get(file) ?? []).forEach((c) => { c.needsUpdate = true; });
      waiting.delete(file);
    }));
    images.set(file, t);
  }
  return t;
}

// rows = players in the atlas (8), cols = faces stored (2 for players: top, front; 5 for the down markers)
export function tileTexture(file, row, col, cols, rows = 8) {
  const key = `${file}|${row}|${col}`;
  let t = tiles.get(key);
  if (!t) {
    const base = baseTexture(file);
    t = base.clone();
    t.repeat.set(1 / cols, 1 / rows);
    t.offset.set(col / cols, 1 - (row + 1) / rows);
    if (base.image?.complete !== false && base.image) t.needsUpdate = true;
    else waiting.set(file, [...(waiting.get(file) ?? []), t]);
    tiles.set(key, t);
  }
  return t;
}

let turf;
export function turfTexture() {
  if (!turf) { turf = prep(loader.load(artUrl('turf.webp'))); turf.wrapS = turf.wrapT = THREE.RepeatWrapping; turf.magFilter = THREE.LinearFilter; }
  return turf;
}

// the top face (the number) as its own texture that can turn in quarter steps round the tile's centre, so the number
// can always read upright from the camera (PlayerCube turns it). One per cube.
export function topTexture(file, row, cols, rows = 8) {
  const base = baseTexture(file);
  const t = base.clone();
  t.repeat.set(1 / cols, 1 / rows);
  t.center.set(0.5, 0.5);
  // with a centre, the tile centre must land at uv 0.5: shift the offset to match
  t.offset.set(0.5 / cols - 0.5, 1 - (row + 1) / rows + 0.5 / rows - 0.5);
  if (base.image) t.needsUpdate = true;
  else waiting.set(file, [...(waiting.get(file) ?? []), t]);
  return t;
}

// BoxGeometry material order: +x, -x, +y (top), -y (bottom), +z (front), -z (back)
export function playerMaterials(uniform, row) {
  const mat = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
  const side = mat(tileTexture(uniform.file, row, 1, uniform.cols));
  const top = mat(topTexture(uniform.file, row, uniform.cols));
  const bottom = mat(turfTexture());
  return [side, side, top, bottom, side, side];
}

// the down marker: atlas row 6 is the cube with 1 / 2 / 3 / 4 round its sides (front, right, back, left)
export function downMaterials(row = 6) {
  const mat = (col) => new THREE.MeshStandardMaterial({ map: tileTexture(DOWNS.file, row, col, 5), roughness: 0.7 });
  const [top, front, right, back, left] = [0, 1, 2, 3, 4].map(mat);
  return [right, left, top, top, front, back];
}
