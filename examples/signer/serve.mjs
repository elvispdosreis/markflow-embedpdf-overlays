import {build} from 'esbuild';
import {PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFString} from 'pdf-lib';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, extname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, '.verification/signer-demo'); await mkdir(output, {recursive: true});
await build({absWorkingDir: root, entryPoints: ['examples/signer/demo.ts'], outdir: output,
  entryNames: 'demo', bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  external: ['@embedpdf/snippet']});
// The official snippet is already a browser bundle. Keep its worker/assets intact.
const html = (await readFile(resolve(root, 'examples/signer/index.html'), 'utf8')).replace('<script type="module"',
  '<script type="importmap">{"imports":{"@embedpdf/snippet":"/node_modules/@embedpdf/snippet/dist/embedpdf.js"}}</script><script type="module"');
await writeFile(resolve(output, 'index.html'), html);
const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
for (let index = 0; index < 2; index++) {
  const page = pdf.addPage([595, 842]);
  if (index === 1) page.setRotation(degrees(90));
  page.drawText('DOCUMENTO DE DEMONSTRACAO', {x: 52, y: 755, size: 20, font, color: rgb(.08,.18,.3)});
  page.drawText(`Pagina ${index + 1} - Posicionamento de assinatura digital`, {x: 52, y: 710, size: 12, font});
  for (let line = 0; line < 8; line++) page.drawText('Este PDF e uma amostra publica para testar a area de assinatura.', {x: 52, y: 655 - line * 30, size: 12, font});
  page.drawLine({start: {x: 52, y: 200}, end: {x: 540, y: 200}, thickness: 1, color: rgb(.6,.6,.6)});
  page.drawText('Espaco livre para a assinatura', {x: 190, y: 178, size: 12, font});
  if (index === 1) {
    page.drawRectangle({x: 300, y: 90, width: 220, height: 60, borderWidth: 1, borderColor: rgb(.08,.18,.3)});
    page.drawText('Area reservada: elvisreis', {x: 300, y: 158, size: 11, font});
    const field = pdf.context.obj({Type: 'Annot', Subtype: 'Widget', FT: 'Sig',
      T: PDFString.of('elvisreis'), Rect: [300, 90, 520, 150], P: page.ref, F: 4});
    const ref = pdf.context.register(field);
    page.node.addAnnot(ref);
    pdf.catalog.set(PDFName.of('AcroForm'), pdf.context.obj({Fields: [ref], SigFlags: 3}));
  }
}
await writeFile(resolve(output, 'sample.pdf'), await pdf.save());
if (process.argv[2] === '--build-only') process.exit(0);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.pdf':'application/pdf','.css':'text/css'};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname.startsWith('/node_modules/') ? resolve(root, '.' + decodeURIComponent(url.pathname))
      : resolve(output, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    const base = url.pathname.startsWith('/node_modules/') ? resolve(root, 'node_modules') : output;
    const child = relative(base, path); if (child.startsWith('..') || resolve(base, child) !== path) throw new Error('Invalid path');
    const content = await readFile(path);
    response.writeHead(200, {'Content-Type': types[extname(path)] ?? 'application/octet-stream'}); response.end(content);
  } catch {response.writeHead(404); response.end('Not found');}
});
const port = Number(process.argv[2] ?? 4317);
server.listen(port, '127.0.0.1', () => console.log(`MarkFlow Signer: http://127.0.0.1:${port}`));
