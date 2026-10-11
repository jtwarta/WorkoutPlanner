import asyncio, json, datetime, sys
sys.path.insert(0, '/home/claude/harness'); import render as R
from PIL import Image, ImageDraw, ImageFont
async def main(served, tab, out_png, title, t_end=1300, step=100):
    frozen = datetime.datetime.fromisoformat(json.load(open(R.FIX + '/meta.json'))['frozen'])
    proc, url = R.serve(served); frames = []
    async with R.async_playwright() as p:
        b = await p.chromium.launch()
        ctx, page, errs = await R.make_page(b, 'replay', frozen)
        await R.boot(page, url); await page.wait_for_timeout(1500)
        await page.evaluate(f"switchTab('{tab}')")
        await page.wait_for_function(f"!document.getElementById('tab-{tab}').classList.contains('hidden') && document.getAnimations().length > 5", polling='raf')
        n = await page.evaluate("(()=>{ window.__A = document.getAnimations(); __A.forEach(a=>a.pause()); return __A.length; })()")
        for t in range(0, t_end, step):
            await page.evaluate(f"(()=>{{ __A.forEach(a=>{{ try {{ a.currentTime = {t}; }} catch(e) {{}} }}); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); }})()")
            await page.wait_for_timeout(50)
            f = f'/tmp/st_{tab}_{t}.png'; await page.screenshot(path=f); frames.append((f, f'{t} ms'))
        print(tab, 'animations seeked:', n, '| errors:', errs); await b.close()
    proc.terminate()
    s = 0.36; ims = [(Image.open(f).convert('RGB'), l) for f, l in frames]
    w, h = int(ims[0][0].width * s), int(ims[0][0].height * s); cols = 7; G = 14
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (G + cols * (w + G), 70 + rows * (h + 40)), (226, 225, 221)); d = ImageDraw.Draw(sheet)
    d.text((G, 18), title, fill=(28, 28, 30), font=ImageFont.truetype('/root/.fonts/InterDisplay-SemiBold.ttf', 22))
    fs = ImageFont.truetype('/root/.fonts/InterDisplay-Regular.ttf', 16)
    for i, (im, l) in enumerate(ims):
        r, c = divmod(i, cols); x = G + c * (w + G); y = 60 + r * (h + 40)
        sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y)); d.text((x, y + h + 8), l, fill=(60, 60, 64), font=fs)
    sheet.save(out_png, optimize=True); print('strip', sheet.size)
asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]))
