import {build} from 'esbuild';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {resolve, relative} from 'node:path';
import {mkdir, rm} from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = resolve(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: path => path, getNewLine: () => '\n'
  }));
  process.exit(1);
}
const output = resolve(root, 'dist');
if (relative(root, output) !== 'dist') throw new Error('Invalid generated output directory.');
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
const emitted = program.emit();
if (emitted.emitSkipped || emitted.diagnostics.length) throw new Error('Could not emit TypeScript declarations.');
await build({
  absWorkingDir: root, entryPoints: ['src/index.ts', 'src/react.ts', 'src/vue.ts'],
  outdir: 'dist', bundle: true, splitting: true, format: 'esm', platform: 'browser',
  target: 'es2022', sourcemap: true, packages: 'external',
  banner: {js: '"use client";'}
});
console.log('Overlays: ESM bundles and TypeScript declarations built.');
