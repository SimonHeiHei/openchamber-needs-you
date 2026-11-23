// Ship checklist: what the host checks on install, checked here so a broken
// package never leaves this folder. Run by `npm run check`.
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

const fail = (message) => failures.push(message);
const ok = (message) => notes.push(`ok   ${message}`);
const exists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) fail('package.json: version is not semver');
else ok(`version ${pkg.version}`);

const manifest = pkg.openchamber;
if (!manifest) fail('package.json: openchamber block missing');
else {
  if (manifest.apiVersion !== 1) fail('openchamber.apiVersion must be 1');
  else ok('apiVersion 1');

  const engine = manifest.engines?.openchamber;
  if (engine !== '>=2.3.3') fail(`engines.openchamber is ${JSON.stringify(engine)}, expected ">=2.3.3"`);
  else ok('engines.openchamber >=2.3.3');

  const contributes = manifest.contributes ?? {};
  const allowed = new Set(['panel', 'page', 'statusSection', 'capabilities', 'attach']);
  for (const key of Object.keys(contributes)) {
    if (!allowed.has(key)) fail(`contributes.${key} is not part of this package`);
  }
  for (const forbidden of ['service', 'integration', 'filesystem', 'origins']) {
    if (forbidden in contributes || forbidden in manifest) fail(`manifest declares ${forbidden}; v1 must not`);
  }
  const capabilities = contributes.capabilities;
  if (!Array.isArray(capabilities) || capabilities.length !== 1 || capabilities[0] !== 'sessions') {
    fail(`capabilities is ${JSON.stringify(capabilities)}, expected ["sessions"]`);
  } else ok('capabilities ["sessions"] only');

  const panel = contributes.panel ?? {};
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.id ?? '')) fail('openchamber.id is not kebab-case');
  else ok(`openchamber.id ${manifest.id}`);
  if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) fail('openchamber.name is empty');
  else ok(`openchamber.name ${manifest.name}`);
  if (typeof manifest.icon !== 'string' || !/^[a-z0-9-]+$/.test(manifest.icon)) fail('openchamber.icon must be a Remixicon kebab name');
  else ok(`openchamber.icon ${manifest.icon} (Remixicon name, no file needed)`);
  if (manifest.icon?.endsWith('.svg')) fail('openchamber.icon is an .svg path, but no icon file ships');

  const entries = [
    ['panel.entry', panel.entry],
    ['page.entry', contributes.page?.entry],
    ['statusSection.entry', contributes.statusSection?.entry],
  ];
  for (const [name, entry] of entries) {
    if (typeof entry !== 'string') {
      fail(`${name} missing`);
      continue;
    }
    if (entry.includes('..') || entry.startsWith('/') || /^[a-z]+:/i.test(entry)) fail(`${name} is not a package-relative path`);
    const absolute = join(root, entry);
    if (!(await exists(absolute))) fail(`${name} ${entry} does not exist`);
    else {
      ok(`${name} ${entry}`);
      const html = await readFile(absolute, 'utf8');
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
      if (scripts.length === 0) fail(`${entry} loads no script`);
      for (const source of scripts) {
        if (/^https?:|^\/\//.test(source)) {
          fail(`${entry} loads an external script ${source}`);
          continue;
        }
        const scriptPath = join(dirname(absolute), source);
        if (!(await exists(scriptPath))) fail(`${entry} references missing ${source}`);
        else ok(`${entry} -> ${source}`);
      }
    }
  }

  const height = contributes.statusSection?.height;
  if (height !== 76) fail(`statusSection.height is ${height}, expected 76`);
  else ok('statusSection.height 76');
}

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL ${message}`);
  process.exit(1);
}
for (const note of notes) console.log(note);
console.log('manifest ok');
