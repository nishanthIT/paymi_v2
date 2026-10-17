#!/usr/bin/env python3
"""Record a completed `eas build:view ID --json` result without publishing signed log URLs."""
import hashlib
import json
import pathlib
import sys
import urllib.parse
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
job = json.loads(pathlib.Path(sys.argv[1]).read_text())
if job['status'] != 'FINISHED':
    raise SystemExit(f"Build {job['id']} is {job['status']}; no completed artifact recorded")
platform = job['platform'].lower()
version = job['appBuildVersion']
directory = root / 'release-artifacts' / f'{platform}-{version}'
directory.mkdir(parents=True, exist_ok=True, mode=0o700)
url = job['artifacts']['applicationArchiveUrl']
if urllib.parse.urlparse(url).scheme != 'https':
    raise SystemExit('Refusing non-HTTPS artifact')
artifact = directory / f'paymi-{job["appVersion"]}-{version}.{ "ipa" if platform == "ios" else "aab" }'
with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=120) as response, artifact.open('wb') as output:
    while chunk := response.read(1024 * 1024):
        output.write(chunk)
log_paths = []
for index, log_url in enumerate(job.get('logFiles', [])):
    dest = directory / f'build-{index}.log'
    try:
        with urllib.request.urlopen(urllib.request.Request(log_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as response:
            dest.write_bytes(response.read())
        log_paths.append(str(dest.relative_to(root)))
    except Exception:
        log_paths.append(f'log {index}: download unavailable; refresh build:view to renew URL')
record = {key: job.get(key) for key in ['id', 'status', 'platform', 'appIdentifier', 'appVersion', 'appBuildVersion', 'gitCommitHash', 'createdAt', 'completedAt', 'fingerprint']}
record.update(artifactPath=str(artifact.relative_to(root)), sha256=hashlib.file_digest(artifact.open('rb'), 'sha256').hexdigest(),
              bytes=artifact.stat().st_size, logs=log_paths, buildUrl=f'https://expo.dev/accounts/n1sh/projects/my-app/builds/{job["id"]}',
              storeUpload='NOT PERFORMED', deviceValidation='NOT TESTED')
evidence = root / 'docs/release/evidence' / f'{platform}-{version}-artifact.json'
evidence.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
