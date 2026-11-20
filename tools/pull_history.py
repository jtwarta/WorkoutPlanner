"""Fetch all Hevy workouts, routines and exercise templates into <data_dir> (keep it outside the repo).
usage: python3 tools/pull_history.py <data_dir>   Read-only: GET requests only."""
import json, os, re, sys, time, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = re.search(r"const apiKey = '([^']+)'", open(os.path.join(HERE, '..', 'index.html')).read()).group(1)
def get(path):
    for a in range(5):
        try:
            req = urllib.request.Request('https://api.hevyapp.com/v1' + path, headers={'api-key': KEY})
            with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(5 * (a + 1)); continue
            raise
    raise SystemExit('rate limited')
def pages(path, key, size):
    out, p, pc = [], 1, 1
    while p <= pc:
        d = get(f'{path}?page={p}&pageSize={size}'); pc = d.get('page_count', 1); out += d.get(key, []); p += 1; time.sleep(0.25)
    return out
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for name, path, key, size in [('workouts', '/workouts', 'workouts', 10), ('routines', '/routines', 'routines', 10), ('templates', '/exercise_templates', 'exercise_templates', 100)]:
    data = pages(path, key, size); json.dump(data, open(os.path.join(out, name + '.json'), 'w')); print(name, len(data))
