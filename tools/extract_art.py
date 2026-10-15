"""Turn the print-and-play source art (gitignored, in the project root) into web textures.

    python tools/extract_art.py            # everything
    python tools/extract_art.py cubes      # just the player cubes (also: field, board, teams)

Outputs (committed):
  public/art/cubes/<team>-<uniform>.webp   8 players atlas, 256px tiles, one row per player (ascending number)
                                           columns: top, front[, right, back, left] (all upright). The 4 sides are
                                           printed identical, so normally only top + front are kept (manifest 'cols').
  public/art/cubes/downs.webp              the down-marker cubes, same layout
  public/art/field-4k.webp / field-2k.webp the MFL field
  public/art/turf.webp                     tileable grass (cube bottoms, surroundings)
  public/art/scoreboard.webp
  public/art/punch/pb<n><f|b>.webp         punchboards, 10 x 8 token grid
  src/data/art.json                        manifest (uniforms per team, player order, face colours, field calibration)
  src/data/teams.json                      rosters, from docs/rules-and-rosters.md

Every uniform sheet uses the same template: 8 cube nets (crosses). The middle square is the top of the cube
(number on team colour); the 4 arms show the player standing with his head towards the middle.
"""
import glob, hashlib, json, os, re, sys
import cv2, fitz
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'art')
DATA = os.path.join(ROOT, 'src', 'data')
TILE = 256
INSET = 0.05  # trim crop marks / rounded corners off each face

TEAM_ALIAS = {'griffins': 'griffons'}


def slug(s):
    return re.sub('[^a-z0-9]', '', s.lower())


def label(s):
    if not s:
        return 'Home'
    if s.lower() == 'alt':
        return 'Alt'
    if re.fullmatch(r'alt\d', s.lower()):
        return 'Alt ' + s[-1]
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    return ' '.join(w if w.lower() in ('and',) else w[:1].upper() + w[1:] for w in s.replace('and', ' and ').split())


def page_rgb(pdf, dpi):
    p = fitz.open(pdf)[0]
    pix = p.get_pixmap(dpi=dpi, colorspace=fitz.csRGB)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3].copy(), p.get_text().strip()


def find_nets(rgb):
    ink = (rgb.min(2) < 225).astype(np.uint8)
    k = max(3, rgb.shape[1] // 230)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    _, _, st, _ = cv2.connectedComponentsWithStats(ink)
    nets = [tuple(int(v) for v in s[:4]) for s in st[1:] if s[3] > rgb.shape[0] * 0.1]
    # reading order: rows (by centre y, tolerant), then x
    nets.sort(key=lambda b: (b[1] + b[3] / 2, b[0]))
    rows, cur = [], []
    for b in nets:
        if cur and abs((b[1] + b[3] / 2) - (cur[0][1] + cur[0][3] / 2)) > b[3] * 0.4:
            rows.append(cur); cur = []
        cur.append(b)
    rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


def cell(rgb, x, y, w, h, i, j):
    cw, ch = w / 3, h / 3
    x0, y0 = x + j * cw, y + i * ch
    m = INSET * cw
    crop = rgb[int(round(y0 + m)):int(round(y0 + ch - m)), int(round(x0 + m)):int(round(x0 + cw - m))]
    return Image.fromarray(crop).resize((TILE, TILE), Image.LANCZOS)


def net_faces(rgb, box):
    x, y, w, h = box
    top = cell(rgb, x, y, w, h, 1, 1)
    front = cell(rgb, x, y, w, h, 2, 1)                       # bottom arm: already head-up
    back = cell(rgb, x, y, w, h, 0, 1).rotate(180)            # top arm: upside down
    left = cell(rgb, x, y, w, h, 1, 0).rotate(90, expand=True)    # head points right -> rotate CCW
    right = cell(rgb, x, y, w, h, 1, 2).rotate(-90, expand=True)  # head points left -> rotate CW
    return [top, front, right, back, left]


def colours(top):
    a = np.asarray(top.convert('RGB')).reshape(-1, 3)
    q = (a // 24) * 24 + 12
    vals, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)
    bg = vals[order[0]]
    fg = next((vals[i] for i in order[1:] if np.abs(vals[i].astype(int) - bg.astype(int)).sum() > 120), vals[order[1]])
    hexc = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
    return hexc(bg), hexc(fg)


def side_diff(faces):
    """largest mean difference between the 4 side faces. Same sprite on every sheet, but on some (Pandas, Reapers)
    it sits at a different spot / size on the turf, so ~30-48 is normal; a real back view would score far higher."""
    a = [np.asarray(f, dtype=float) for f in faces[1:]]
    return max(np.abs(a[0] - b).mean() for b in a[1:])


def save_atlas(faces_by_player, path, cols=5):
    faces_by_player = [f[:cols] for f in faces_by_player]
    atlas = Image.new('RGB', (TILE * cols, TILE * len(faces_by_player)))
    for r, faces in enumerate(faces_by_player):
        for c, f in enumerate(faces):
            atlas.paste(f, (c * TILE, r * TILE))
    atlas.save(path, 'WEBP', quality=82, method=6)


def do_teams():
    """docs/rules-and-rosters.md -> src/data/teams.json"""
    md = open(os.path.join(ROOT, 'docs', 'rules-and-rosters.md'), encoding='utf8').read()
    teams = []
    for block in re.findall(r'```json\n(\{"team".*?\})\n```', md, re.S):
        t = json.loads(block)
        t['id'] = slug(t['team'])
        t['name'] = t.pop('team').title().replace('-O-', '-o-')
        teams.append(t)
    os.makedirs(DATA, exist_ok=True)
    json.dump(teams, open(os.path.join(DATA, 'teams.json'), 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print('teams:', len(teams))
    return teams


def do_cubes():
    os.makedirs(os.path.join(OUT, 'cubes'), exist_ok=True)
    teams = {t['id']: t for t in json.load(open(os.path.join(DATA, 'teams.json'), encoding='utf8'))}
    manifest = {}
    seen = {}  # team -> {pixel hash: uniform label}: some sheets are the same art under two names
    for pdf in sorted(glob.glob(os.path.join(ROOT, '*pixelblock*.pdf'))):
        base = os.path.basename(pdf)
        m = re.match(r'([A-Za-z]+)_+(.*?)_*pixelblock', base)
        file_team, variant = m.group(1), m.group(2).strip('_.')
        rgb, text = page_rgb(pdf, 330)
        nets = find_nets(rgb)
        faces = [net_faces(rgb, b) for b in nets]
        if file_team == 'DownMarkers':
            save_atlas(faces, os.path.join(OUT, 'cubes', 'downs.webp'))
            manifest['_downs'] = {'file': 'cubes/downs.webp', 'count': len(faces)}
            print('downs', len(faces))
            continue
        tid = slug(text.splitlines()[0]) if text else slug(file_team)
        tid = TEAM_ALIAS.get(tid, tid)
        if tid not in teams:
            tid = TEAM_ALIAS.get(slug(file_team), slug(file_team))
        uid = slug(variant) or 'home'
        h = hashlib.sha1(b''.join(f.tobytes() for fs in faces for f in fs[:2])).hexdigest()
        if h in seen.setdefault(tid, {}):
            print(f'{tid:15s} {uid:16s} same art as {seen[tid][h]}: skipped')
            continue
        seen[tid][h] = uid
        fname = f'cubes/{tid}-{uid}.webp'
        diff = max(side_diff(f) for f in faces)
        cols = 2 if diff < 70 else 5   # same sprite on all sides: keep just top + front
        save_atlas(faces, os.path.join(OUT, fname), cols)
        nums = sorted(p['num'] for p in teams[tid]['players']) if tid in teams else []
        bg, fg = colours(faces[0][0])
        manifest.setdefault(tid, []).append({'id': uid, 'label': label(variant), 'file': fname, 'nums': nums, 'count': len(faces), 'cols': cols, 'colors': [bg, fg]})
        print(f'{tid:15s} {uid:16s} nets={len(faces)} sides~{diff:.1f} {bg} {fg}' + ('' if tid in teams else '  !! no roster'))
    for v in manifest.values():
        if isinstance(v, list):
            v.sort(key=lambda u: (u['id'] != 'home', u['id'] != 'alt', u['id']))
    return manifest


def do_field():
    src = Image.open(os.path.join(ROOT, 'TechnoBowl_MFL_officialfield.jpg')).convert('RGB')
    W, H = src.size
    for name, h in (('field-4k.webp', 4096), ('field-2k.webp', 2048)):
        src.resize((round(W * h / H), h), Image.LANCZOS).save(os.path.join(OUT, name), 'WEBP', quality=86, method=6)
    # measured inner edges of the sidelines / end lines (see tools/README): 13 x 24 squares of ~314px
    return {'w': W, 'h': H, 'x0': 293 / W, 'x1': 4373 / W, 'y0': 312 / H, 'y1': 7857 / H, 'cols': 13, 'rows': 24, 'endzone': 2}


def do_board():
    os.makedirs(os.path.join(OUT, 'punch'), exist_ok=True)
    # the turf sheet is 8 plain grass cube nets: take the middle square of the first one
    turf, _ = page_rgb(os.path.join(ROOT, 'Grass_Turf_1.pdf'), 330)
    x, y, w, h = find_nets(turf)[0]
    t = cell(turf, x, y, w, h, 1, 1).resize((512, 512), Image.LANCZOS)
    # cheap seamless: mirror-blend the edges
    a = np.asarray(t).astype(float)
    b = np.roll(np.roll(a, 256, 0), 256, 1)
    yy, xx = np.mgrid[0:512, 0:512]
    wgt = (np.minimum(np.minimum(xx, 511 - xx), np.minimum(yy, 511 - yy)) / 256.0).clip(0, 1)[..., None]
    Image.fromarray((a * wgt + b * (1 - wgt)).astype(np.uint8)).save(os.path.join(OUT, 'turf.webp'), 'WEBP', quality=85)
    Image.open(os.path.join(ROOT, 'TechnoBowl_ScoreBoard_DriveThru.jpg')).convert('RGB').save(os.path.join(OUT, 'scoreboard.webp'), 'WEBP', quality=90)
    for n in range(1, 5):
        for side, s in (('front', 'f'), ('back', 'b')):
            im = Image.open(os.path.join(ROOT, f'TB_punchboard_{n}_{side}_DriveThru.jpg')).convert('RGB')
            im.thumbnail((2048, 2048), Image.LANCZOS)
            im.save(os.path.join(OUT, 'punch', f'pb{n}{s}.webp'), 'WEBP', quality=86, method=6)
    return {'punch': {'cols': 10, 'rows': 8, 'files': [f'punch/pb{n}{s}.webp' for n in range(1, 5) for s in 'fb']}}


if __name__ == '__main__':
    what = set(sys.argv[1:]) or {'teams', 'cubes', 'field', 'board'}
    os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(DATA, 'art.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    if 'teams' in what: do_teams()
    if 'cubes' in what: man['uniforms'] = do_cubes()
    if 'field' in what: man['field'] = do_field()
    if 'board' in what: man.update(do_board())
    json.dump(man, open(mpath, 'w'), indent=1)
    print('wrote', mpath)
