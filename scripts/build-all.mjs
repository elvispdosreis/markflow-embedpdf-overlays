import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const packages = ['core', ...readdirSync(new URL('../packages/', import.meta.url)).filter(name => name !== 'core').sort()];
for (const name of packages) execFileSync(process.execPath, ['packages/' + name + '/scripts/build.mjs'], {cwd: root, stdio: 'inherit'});
