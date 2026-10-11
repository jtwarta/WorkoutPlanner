"""LiftScript render harness (Phase 0 audit / Phase 1 parity).

record: load the app against live Hevy + live health-data.json, saving every
        GET response as a fixture and freezing the clock at record time.
render: replay fixtures (no network to Hevy), same frozen clock, iPhone
        viewport, America/Los_Angeles timezone. Writes tab sheets + key states.
Safety: any non-GET request to api.hevyapp.com is aborted (never writes routines).

usage: python3 render.py record <served_dir>
       python3 render.py render <served_dir> <out_dir>
"""
import asyncio, json, os, sys, hashlib, subprocess, time, datetime, socket
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

FIX = '/home/claude/fixtures'
UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 '
      '(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
VIEW = {'width': 393, 'height': 852}
DPR = 2
PT = ZoneInfo('America/Los_Angeles')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS'}
TABS = [('today', 'Today'), ('muscles', 'Muscles'), ('history', 'History'), ('weight', 'Body')]
blocked = []


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def serve(d):
    port = free_port()
    proc = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1',
                             '--directory', d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    return proc, f'http://127.0.0.1:{port}/index.html'


def fkey(url):
    u = urlparse(url)
    if u.path.endswith('health-data.json'):
        return 'health'
    return 'hevy_' + hashlib.sha1((u.path + '?' + u.query).encode()).hexdigest()[:16]


async def make_page(browser, mode, frozen, delay_ms=0):
    ctx = await browser.new_context(viewport=VIEW, device_scale_factor=DPR, is_mobile=True,
                                    has_touch=True, user_agent=UA, locale='en-US',
                                    timezone_id='America/Los_Angeles')
    await ctx.clock.install(time=frozen)

    async def handler(route, request):
        if request.method == 'OPTIONS':
            return await route.fulfill(status=204, headers=CORS)
        if 'api.hevyapp.com' in request.url and request.method != 'GET':
            blocked.append(request.method + ' ' + request.url)
            return await route.abort()
        k = fkey(request.url)
        path = os.path.join(FIX, k + '.json')
        if mode == 'record':
            resp = await route.fetch()
            body = await resp.body()
            with open(path, 'wb') as f:
                f.write(body)
            with open(path + '.meta', 'w') as f:
                json.dump({'url': request.url, 'status': resp.status}, f)
            return await route.fulfill(status=resp.status, body=body,
                                       headers={**CORS, 'content-type': 'application/json'})
        if not os.path.exists(path):
            print('  MISSING FIXTURE', request.url)
            return await route.fulfill(status=404, body='{}', headers=CORS)
        if delay_ms:
            await asyncio.sleep(delay_ms / 1000)
        meta = json.load(open(path + '.meta'))
        return await route.fulfill(status=meta['status'], body=open(path, 'rb').read(),
                                   headers={**CORS, 'content-type': 'application/json'})

    await ctx.route('**/api.hevyapp.com/**', handler)
    await ctx.route('**/health-data.json*', handler)
    page = await ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, page, errs


async def boot(page, url, timeout=90000):
    await page.goto(url)
    await page.wait_for_selector('#dashboard:not(.hidden)', timeout=timeout)
    await page.wait_for_timeout(1500)


async def record(served):
    os.makedirs(FIX, exist_ok=True)
    frozen = datetime.datetime.now(PT).replace(microsecond=0)
    proc, url = serve(served)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx, page, errs = await make_page(b, 'record', frozen)
        await boot(page, url)
        await b.close()
    proc.terminate()
    json.dump({'frozen': frozen.isoformat()}, open(os.path.join(FIX, 'meta.json'), 'w'))
    n = len([f for f in os.listdir(FIX) if f.endswith('.json') and f != 'meta.json'])
    print('recorded', n, 'fixtures; frozen at', frozen.isoformat(), '; page errors:', errs)


async def render(served, out):
    os.makedirs(out, exist_ok=True)
    frozen = datetime.datetime.fromisoformat(json.load(open(os.path.join(FIX, 'meta.json')))['frozen'])
    proc, url = serve(served)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1) Boot sequence frames (responses delayed so the loading screen is visible)
        ctx, page, errs = await make_page(b, 'replay', frozen, delay_ms=2500)
        t0 = time.time()
        await page.goto(url)
        for i, t in enumerate([0.15, 0.6, 1.2, 2.0]):
            await asyncio.sleep(max(0, t - (time.time() - t0)))
            await page.screenshot(path=f'{out}/boot_{i}.png')
        await page.wait_for_selector('#dashboard:not(.hidden)', timeout=90000)
        for i, t in enumerate([0.05, 0.25, 0.6]):
            await page.wait_for_timeout(int(t * 1000) if i == 0 else 200 if i == 1 else 350)
            await page.screenshot(path=f'{out}/reveal_{i}.png')
        await ctx.close()

        # 2) Full tabs + key states
        ctx, page, errs = await make_page(b, 'replay', frozen)
        await boot(page, url)
        for key, label in TABS:
            await page.evaluate(f"switchTab('{key}')")
            await page.wait_for_timeout(900)
            await page.evaluate('window.scrollTo(0,0)')
            await page.wait_for_timeout(200)
            await page.screenshot(path=f'{out}/tab_{key}.png', full_page=True)

        # Key state: Why this? (Today, first group)
        await page.evaluate("switchTab('today')"); await page.wait_for_timeout(700)
        g = page.locator('#suggested-exercises .ex-group-title').first
        await g.scroll_into_view_if_needed(); await g.click(); await page.wait_for_timeout(600)
        await page.evaluate("document.querySelector('#suggested-exercises .ex-group-title').scrollIntoView({block:'start'}); window.scrollBy(0,-90)")
        await page.wait_for_timeout(250)
        await page.screenshot(path=f'{out}/state_why.png')

        # Key state: Power Score detail (header ring)
        await page.evaluate('window.scrollTo(0,0)'); await page.wait_for_timeout(200)
        await page.evaluate('togglePowerScoreDetail()'); await page.wait_for_timeout(700)
        await page.screenshot(path=f'{out}/state_power.png')
        await page.evaluate('togglePowerScoreDetail()'); await page.wait_for_timeout(400)

        # Key state: muscle detail
        await page.evaluate("switchTab('muscles')"); await page.wait_for_timeout(800)
        m = page.locator('.muscle-cell').first
        await m.scroll_into_view_if_needed(); await m.click(); await page.wait_for_timeout(900)
        await page.screenshot(path=f'{out}/state_muscle.png')

        # Key state: chart tooltip
        await page.evaluate("switchTab('weight')"); await page.wait_for_timeout(900)
        c = page.locator('#weight-canvas')
        await page.evaluate("document.getElementById('weight-canvas').scrollIntoView({block:'center'})")
        await page.wait_for_timeout(300)
        bb = await c.bounding_box()
        await page.mouse.click(bb['x'] + bb['width'] * 0.72, bb['y'] + bb['height'] * 0.45)
        await page.wait_for_timeout(350)
        await page.screenshot(path=f'{out}/state_tooltip.png')

        # Numeric snapshot (for parity later): all visible text per tab
        snap = {}
        for key, _ in TABS:
            await page.evaluate(f"switchTab('{key}')"); await page.wait_for_timeout(700)
            snap[key] = await page.evaluate(f"document.getElementById('tab-{key}').innerText")
        snap['header'] = await page.evaluate("document.querySelector('.header') ? document.querySelector('.header').innerText : ''")
        json.dump(snap, open(f'{out}/text_snapshot.json', 'w'), indent=1)
        await b.close()
    proc.terminate()
    print('rendered to', out, '| page errors:', errs, '| blocked writes:', blocked)


if __name__ == '__main__':
    if sys.argv[1] == 'record':
        asyncio.run(record(sys.argv[2]))
    else:
        asyncio.run(render(sys.argv[2], sys.argv[3]))
