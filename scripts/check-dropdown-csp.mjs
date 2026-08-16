import console from 'node:console';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/*
 * The repository Playwright harness under e2e/ loads the real production-smoke frontend and
 * intercepts exact Session Gateway and scenario API requests. Keep this narrow static regression
 * gate until npm run test:e2e:csp has explicit desktop and mobile dropdown coverage for real
 * popover placement, viewport fallback, top-layer clipping escape, runtime style
 * elements/attributes, and CSP violations. The current basic transaction selection audit does not
 * prove that equivalence, so it does not replace this check.
 */

const directDependency = '@radix-ui/react-dropdown-menu';
const defaultRepositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const bundleBlockers = [
  {
    name: 'styleSheet.cssText stylesheet injection',
    matches: (text) => text.includes('styleSheet.cssText'),
  },
  {
    name: 'style-singleton text-node stylesheet injection',
    matches: (text) => /appendChild\s*\(\s*document\.createTextNode\s*\(/.test(text),
  },
  {
    name: 'bundled Radix menu marker',
    matches: (text) =>
      text.includes('data-radix-menu-content') ||
      text.includes('@radix-ui/react-menu') ||
      text.includes(directDependency),
  },
  {
    name: 'bundled react-remove-scroll marker',
    matches: (text) =>
      [
        'react-remove-scroll',
        'react-remove-scroll-bar',
        'react-style-singleton',
        'data-scroll-locked',
        '--removed-body-scroll-bar-size',
        'with-scroll-bars-hidden',
        'right-scroll-bar-position',
        'width-before-scroll-bar',
      ].some((marker) => text.includes(marker)),
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function readTextFile(path) {
  const contents = await readFile(path);
  return contents.includes(0) ? null : contents.toString('utf8');
}

function displayPath(repositoryRoot, path) {
  return relative(repositoryRoot, path).split('\\').join('/');
}

async function scanFiles(repositoryRoot, directory, blockers) {
  const findings = [];
  for (const path of await collectFiles(directory)) {
    const text = await readTextFile(path);
    if (text === null) continue;

    for (const blocker of blockers) {
      if (blocker.matches(text)) {
        findings.push({ blocker: blocker.name, file: displayPath(repositoryRoot, path) });
      }
    }
  }
  return findings;
}

export async function scanRepository(repositoryRoot = defaultRepositoryRoot) {
  const root = resolve(repositoryRoot);
  const distDirectory = resolve(root, 'dist');
  const sourceDirectory = resolve(root, 'src');
  const packageFiles = [resolve(root, 'package.json'), resolve(root, 'package-lock.json')];

  const findings = await scanFiles(root, distDirectory, bundleBlockers);
  findings.push(
    ...(await scanFiles(root, sourceDirectory, [
      {
        name: `production source imports ${directDependency}`,
        matches: (text) => text.includes(directDependency),
      },
    ])),
  );

  for (const path of packageFiles) {
    const text = await readTextFile(path);
    if (text === null) {
      findings.push({
        blocker: 'package metadata is not readable text',
        file: displayPath(root, path),
      });
    } else if (text.includes(directDependency)) {
      findings.push({
        blocker: `package metadata includes ${directDependency}`,
        file: displayPath(root, path),
      });
    }
  }

  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.blocker.localeCompare(right.blocker),
  );
}

function parseRepositoryRoot(arguments_) {
  if (arguments_.length === 0) return defaultRepositoryRoot;
  if (arguments_.length === 2 && arguments_[0] === '--root') return resolve(arguments_[1]);
  throw new Error('Usage: node scripts/check-dropdown-csp.mjs [--root REPOSITORY_ROOT]');
}

async function main() {
  try {
    const repositoryRoot = parseRepositoryRoot(process.argv.slice(2));
    const findings = await scanRepository(repositoryRoot);
    if (findings.length > 0) {
      console.error('Dropdown CSP gate failed:');
      findings.forEach(({ blocker, file }) => console.error(`- ${file}: ${blocker}`));
      process.exitCode = 1;
      return;
    }
    console.log('Dropdown CSP gate passed: no known Radix dropdown blockers found.');
  } catch (error) {
    console.error(`Dropdown CSP gate failed closed: ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
