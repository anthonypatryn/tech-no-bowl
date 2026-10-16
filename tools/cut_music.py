"""Cut the owner's ESPN NFL Primetime compilation into one MP3 per track, at frame boundaries (no re-encoding, no
quality loss, no ffmpeg). Writes public/music/NN-slug.mp3 and src/data/music.json.

    python tools/cut_music.py "C:/Users/ampat/Downloads/ESPN NFL Primetime Music Compilation (24 Tracks).mp3"
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'music')
DATA = os.path.join(ROOT, 'src', 'data', 'music.json')

# the owner's track list: (start, title, by)
TRACKS = [
    ('0:00', 'International Statement', 'Alan Bell & Roger Dexter'),
    ('2:40', 'Powersurge', 'Ken Nelson & Jim Long'),
    ('5:00', 'Gladiator', 'John Colby'),
    ('7:07', None, None),
    ('8:41', None, None),
    ('10:48', None, None),
    ('12:17', 'Eric D.', 'John Colby'),
    ('14:06', None, None),
    ('15:31', 'Arnold', 'John Colby'),
    ('17:15', 'Grid Lock', 'Ray Russell'),
    ('19:25', 'The Event', 'Robin Gurin & Georgia Shapiro'),
    ('21:40', 'Road Hog', 'Trevor Bastow'),
    ('24:48', 'Power Cutter', 'Robin Gurin & Georgia Shapiro'),
    ('26:53', 'Neck And Neck', 'Alan Hawkshaw'),
    ('30:39', 'Crush', 'Mark Matthews & James Griffith'),
    ('32:47', None, None),
    ('33:44', 'Leading Edge', 'Tom Blades'),
    ('35:24', 'Bad Company', 'Robert J. Walsh'),
    ('37:39', 'NFL Primetime Title Theme (1994-97)', None),
    ('38:54', 'Showdown', 'Robert J. Walsh'),
    ('43:12', 'Out Front', 'Rick Baker'),
    ('46:14', 'Total News', 'Tom Blades'),
    ('47:14', 'Power Plant', 'Rick DiFonzo'),
    ('49:27', 'Theighs Mon', 'John Colby'),
]

BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]  # MPEG-1 Layer III
RATES = [44100, 48000, 32000]


def frames(d):
    """(offset, length) of every MPEG-1 Layer III frame after the ID3 tag"""
    i = 0
    if d[:3] == b'ID3':
        i = 10 + (((d[6] & 0x7f) << 21) | ((d[7] & 0x7f) << 14) | ((d[8] & 0x7f) << 7) | (d[9] & 0x7f))
    out = []
    while i + 4 <= len(d):
        if d[i] == 0xFF and (d[i + 1] & 0xFE) == 0xFA:  # sync + MPEG-1 + Layer III
            br, sr, pad = d[i + 2] >> 4, (d[i + 2] >> 2) & 3, (d[i + 2] >> 1) & 1
            if 0 < br < 15 and sr < 3:
                n = 144000 * BITRATES[br] // RATES[sr] + pad
                if n > 4:
                    out.append((i, n, RATES[sr]))
                    i += n
                    continue
        i += 1  # lost sync: step until the next frame header
    return out


def secs(t):
    m, s = t.split(':')
    return int(m) * 60 + int(s)


def main(src):
    d = open(src, 'rb').read()
    fr = frames(d)
    per = 1152 / fr[0][2]
    total = len(fr) * per
    print(f'{len(fr)} frames, {total / 60:.1f} min')
    os.makedirs(OUT, exist_ok=True)
    meta = []
    unknown = 0
    for k, (start, title, by) in enumerate(TRACKS):
        a = int(secs(start) / per)
        b = int(secs(TRACKS[k + 1][0]) / per) if k + 1 < len(TRACKS) else len(fr)
        if title is None:
            unknown += 1
            title = f'Primetime Cut {unknown}'
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        name = f'{k + 1:02d}-{slug}.mp3'
        chunk = b''.join(d[o:o + n] for o, n, _ in fr[a:b])
        open(os.path.join(OUT, name), 'wb').write(chunk)
        meta.append({'id': f'{k + 1:02d}', 'title': title, 'by': by, 'file': f'music/{name}', 'len': round((b - a) * per, 1)})
        print(f'{name}: {(b - a) * per:.0f}s, {len(chunk) / 1e6:.1f} MB')
    json.dump(meta, open(DATA, 'w', encoding='utf8'), indent=1)
    print('wrote', DATA)


if __name__ == '__main__':
    main(sys.argv[1])
