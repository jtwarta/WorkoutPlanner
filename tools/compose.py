import json, sys
from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[1]          # render dir (2x PNGs)
OUT = sys.argv[2]          # output dir
TITLE = sys.argv[3]
FONT_B = '/root/.fonts/InterDisplay-SemiBold.ttf'
FONT_R = '/root/.fonts/InterDisplay-Regular.ttf'
BG = (226, 225, 221)
INK = (28, 28, 30)
MUTED = (96, 96, 100)
PIN = (255, 61, 110)
GAP, TOP, COLW = 28, 128, 393


def f(path, size):
    return ImageFont.truetype(path, size)


def half(name):
    im = Image.open(f'{SRC}/{name}.png').convert('RGB')
    return im.resize((im.width // 2, im.height // 2), Image.LANCZOS)


def pin(d, x, y, n):
    r = 15
    d.ellipse((x - r, y - r, x + r, y + r), fill=PIN, outline=(255, 255, 255), width=2)
    t = str(n)
    fb = f(FONT_B, 17)
    w = d.textlength(t, font=fb)
    d.text((x - w / 2, y - 11), t, fill=(255, 255, 255), font=fb)


def contact_sheet(callouts=None):
    split = 1735
    body = half('tab_weight')
    cols = [('Today', half('tab_today'), 0, 'today'),
            ('Muscles', half('tab_muscles'), 0, 'muscles'),
            ('History', half('tab_history'), 0, 'history'),
            ('Body (1 of 2)', body.crop((0, 0, body.width, split)), 0, 'weight'),
            ('Body (2 of 2)', body.crop((0, split, body.width, body.height)), split, 'weight')]
    H = max(c[1].height for c in cols)
    W = GAP + len(cols) * (COLW + GAP)
    sheet = Image.new('RGB', (W, TOP + H + GAP), BG)
    d = ImageDraw.Draw(sheet)
    d.text((GAP, 22), TITLE, fill=INK, font=f(FONT_B, 30))
    d.text((GAP, 60), 'Full-page renders, top to bottom. Pins match the numbered critique.', fill=MUTED, font=f(FONT_R, 18))
    for i, (label, im, off, tab) in enumerate(cols):
        x0 = GAP + i * (COLW + GAP)
        sheet.paste(im, (x0, TOP))
        d.text((x0, TOP - 30), label, fill=INK, font=f(FONT_B, 18))
        if not callouts:
            continue
        for n, r in callouts.get(tab, []):
            if not r:
                continue
            x, y, w, h = r
            if not (off <= y < off + im.height):
                continue
            y = y - off
            d.rounded_rectangle((x0 + x - 3, TOP + y - 3, x0 + x + w + 3, TOP + y + h + 3), radius=8, outline=PIN, width=3)
            px = min(max(x0 + x + 4, x0 + 16), x0 + COLW - 16)
            pin(d, px, TOP + max(y, 16) - 2, n)
    return sheet


def states_sheet():
    frames = [('boot_0', 'Boot 0.15 s'), ('boot_1', 'Boot 0.6 s'), ('boot_2', 'Boot 1.2 s'),
              ('reveal_0', 'Dashboard (hard cut)'),
              ('state_why', 'Why this? expanded'), ('state_power', 'Power Score detail'),
              ('state_muscle', 'Muscle detail'), ('state_tooltip', 'Chart tooltip')]
    ims = [(half(n), l) for n, l in frames]
    fw, fh = ims[0][0].size
    W = GAP + 4 * (fw + GAP)
    sheet = Image.new('RGB', (W, TOP + 2 * (fh + 52) + GAP), BG)
    d = ImageDraw.Draw(sheet)
    d.text((GAP, 22), TITLE + ' - key states', fill=INK, font=f(FONT_B, 30))
    d.text((GAP, 60), 'Row 1: boot sequence. Row 2: interaction states.', fill=MUTED, font=f(FONT_R, 18))
    for i, (im, label) in enumerate(ims):
        r, c = divmod(i, 4)
        x = GAP + c * (fw + GAP)
        y = TOP + r * (fh + 52)
        sheet.paste(im, (x, y))
        d.text((x, y + fh + 10), label, fill=INK, font=f(FONT_B, 18))
    return sheet


if __name__ == '__main__':
    co = json.load(open(f'{SRC}/callouts.json')) if len(sys.argv) > 4 and sys.argv[4] == 'pins' else None
    contact_sheet(co).save(f'{OUT}/contact_sheet_before.png', optimize=True)
    states_sheet().save(f'{OUT}/key_states_before.png', optimize=True)
    print('ok')
