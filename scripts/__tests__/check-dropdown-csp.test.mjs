import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'vitest';

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'check-dropdown-csp.mjs');
const fixtureRoots = new Set();

afterEach(async () => {
  await Promise.all([...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })));
  fixtureRoots.clear();
});

async function createFixture(bundleSource, source = 'export {};\n', packageJson = '{}\n') {
  const root = await mkdtemp(resolve(tmpdir(), 'dropdown-csp-gate-'));
  fixtureRoots.add(root);
  await mkdir(resolve(root, 'dist', 'assets'), { recursive: true });
  await mkdir(resolve(root, 'src'));
  await writeFile(resolve(root, 'dist', 'assets', 'index.js'), bundleSource);
  await writeFile(resolve(root, 'src', 'index.ts'), source);
  await writeFile(resolve(root, 'package.json'), packageJson);
  await writeFile(resolve(root, 'package-lock.json'), '{}\n');
  return root;
}

test('fails closed and reports every known dropdown blocker in a text asset', async () => {
  const root = await createFixture(`
    tag.styleSheet.cssText = css;
    tag.appendChild(document.createTextNode(css));
    const radix = 'data-radix-menu-content';
    const scrollLock = '--removed-body-scroll-bar-size';
  `);
  const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /dist\/assets\/index\.js: styleSheet\.cssText stylesheet injection/);
  assert.match(result.stderr, /style-singleton text-node stylesheet injection/);
  assert.match(result.stderr, /bundled Radix menu marker/);
  assert.match(result.stderr, /bundled react-remove-scroll marker/);
});

test('passes a clean emitted bundle and repository metadata', async () => {
  const root = await createFixture('console.log("clean bundle");\n');

  const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Dropdown CSP gate passed/);
});

test('fails when production source or package metadata reintroduces the dependency', async () => {
  const dependency = '@radix-ui/react-dropdown-menu';
  const root = await createFixture(
    'console.log("clean bundle");\n',
    `import ${JSON.stringify(dependency)};\n`,
    `${JSON.stringify({ dependencies: { [dependency]: '2.1.16' } })}\n`,
  );
  const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /package\.json: package metadata includes/);
  assert.match(result.stderr, /src\/index\.ts: production source imports/);
});

test('fails closed when the required dist directory is missing', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'dropdown-csp-gate-'));
  fixtureRoots.add(root);

  const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dropdown CSP gate failed closed/);
});
