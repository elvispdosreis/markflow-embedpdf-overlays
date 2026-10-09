import EmbedPDF, {ZoomMode} from '@embedpdf/snippet';
import {SignerState, mountSignerViewer, createNativeThumbnailDropTarget} from '../../packages/signer/src/index';
import {findViewerViewport} from '@elvisreis/markflow-core';

const state = new SignerState();
const status = document.querySelector<HTMLElement>('#status')!;
const result = document.querySelector<HTMLElement>('#result')!;
const confirm = document.querySelector<HTMLButtonElement>('#sign')!;
const testPosition = document.querySelector<HTMLButtonElement>('#test-position')!;
const reservedPosition = document.querySelector<HTMLButtonElement>('#reserved-position')!;
const signatureField = document.querySelector<HTMLInputElement>('#signature-field')!;
let findingField = false;
const viewer = EmbedPDF.init({type: 'container', target: document.querySelector('#pdf-viewer')!,
  wasmUrl: '/node_modules/@embedpdf/pdfium/dist/pdfium.wasm', worker: false,
  theme: {preference: 'light'}, tabBar: 'never', fontFallback: null, fonts: {ui: null},
  disabledCategories: ['annotation', 'redaction', 'form', 'mode', 'panel-comment', 'document-menu', 'page-settings'],
  i18n: {defaultLocale: 'pt-BR', fallbackLocale: 'en'}, zoom: {defaultZoomLevel: ZoomMode.FitWidth}});
if (!viewer) throw new Error('Não foi possível inicializar o EmbedPDF.');
const registry = await viewer.registry;
const documents = registry.getPlugin('document-manager')!.provides!() as import('@embedpdf/snippet').DocumentManagerCapability;
const ui = registry.getPlugin('ui')!.provides!() as import('@embedpdf/snippet').UICapability;
const commands = registry.getPlugin('commands')!.provides!() as import('@embedpdf/snippet').CommandsCapability;
// Fullscreen must include our sibling overlay and sidebar, outside the native snippet wrapper.
commands.registerCommand({id: 'document:fullscreen', label: 'Tela cheia', shortcuts: ['F11'],
  icon: () => document.fullscreenElement ? 'fullscreenExit' : 'fullscreen',
  active: () => Boolean(document.fullscreenElement), action: () => {
    const operation = document.fullscreenElement ? document.exitFullscreen()
      : document.querySelector<HTMLElement>('#signer-frame')!.requestFullscreen();
    operation.catch(() => {status.textContent = 'Não foi possível ativar a tela cheia neste navegador.';});
  }});
ui.mergeSchema({toolbars: {'main-toolbar': {id: 'main-toolbar', position: {placement: 'top', slot: 'main'}, permanent: true,
  items: [{type: 'command-button', id: 'sidebar-button', commandId: 'panel:toggle-sidebar', variant: 'icon'},
    {type: 'custom', id: 'zoom-toolbar', componentId: 'zoom-toolbar'},
    {type: 'command-button', id: 'pan-button', commandId: 'pan:toggle', variant: 'icon'},
    {type: 'command-button', id: 'pointer-button', commandId: 'pointer:toggle', variant: 'icon'},
    {type: 'spacer', id: 'signer-spacer', flex: true},
    {type: 'command-button', id: 'signer-fullscreen', commandId: 'document:fullscreen', variant: 'icon'}]}},
  sidebars: {'sidebar-panel': {id: 'sidebar-panel', position: {placement: 'left', slot: 'main'},
    content: {type: 'component', componentId: 'thumbnails-sidebar'}, width: '180px', collapsible: true, defaultOpen: true}}});
const mounted = mountSignerViewer(document.querySelector<HTMLElement>('#signature-overlay')!, {viewer, registry, state, resizable: false,
  initialPosition: {x: 40, y: 60, pageIndex: 0},
  pageDropTarget: createNativeThumbnailDropTarget(viewer, registry)});
let viewportObserver: MutationObserver | undefined;
const nativeSidebarDocuments = new Set<string>();
function initializeViewport(documentId: string): void {
  const element = viewer?.shadowRoot ? findViewerViewport(viewer.shadowRoot) : null;
  if (!element) {
    viewportObserver?.disconnect();
    viewportObserver = new MutationObserver(() => initializeViewport(documentId));
    viewportObserver.observe(viewer!.shadowRoot!, {childList: true, subtree: true});
    return;
  }
  viewportObserver?.disconnect(); viewportObserver = undefined;
  if (!nativeSidebarDocuments.has(documentId)) {
    nativeSidebarDocuments.add(documentId);
    ui.forDocument(documentId).setActiveSidebar('left', 'main', 'sidebar-panel');
  }
  // Initialize a late-activated viewport; the native ResizeObserver owns subsequent updates.
  const plugin = registry.getPlugin('viewport') as import('@embedpdf/snippet').ViewportPlugin;
  plugin.setViewportResizeMetrics(documentId, {
    width: element.offsetWidth, height: element.offsetHeight, clientWidth: element.clientWidth, clientHeight: element.clientHeight,
    scrollTop: element.scrollTop, scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
    clientLeft: element.clientLeft, clientTop: element.clientTop
  });
  mounted.update();
}
const update = () => {
  const request = state.confirm(mounted.context);
  confirm.disabled = !request;
  testPosition.disabled = !state.enabled() || !documents.getActiveDocumentId();
  reservedPosition.disabled = findingField || !state.enabled() || !documents.getActiveDocumentId();
  status.textContent = request ? `Área de assinatura na página ${request.coordinates.page.number}` : 'Clique na página para posicionar a assinatura.';
};
const unsubscribeState = state.subscribe(() => {
  result.textContent = 'Confirme a posição para obter as coordenadas da assinatura.'; update();
}), unsubscribeContext = mounted.context.subscribe(update); update();
const opened = await documents.openDocumentUrl({url: new URL('./sample.pdf', location.href).href}).toPromise();
await opened.task.toPromise();
await new Promise(resolve => setTimeout(resolve, 0));
initializeViewport(opened.documentId);
confirm.addEventListener('click', () => {
  const request = state.confirm(mounted.context);
  if (request) result.textContent = JSON.stringify(request, null, 2);
});
document.querySelector('#clear')!.addEventListener('click', () => state.clear());
reservedPosition.addEventListener('click', async () => {
  findingField = true; update();
  result.textContent = 'Localizando a área reservada…';
  const placement = await mounted.moveToSignatureField(signatureField.value);
  findingField = false; update();
  const messages = {
    'invalid-id': 'Informe o ID da área reservada.',
    unavailable: 'Abra um PDF e ative o posicionamento para usar a área reservada.',
    'not-found': 'Nenhum campo de assinatura com esse ID foi encontrado no PDF.',
    ambiguous: 'Há mais de uma área com esse ID. Use um ID único no PDF.',
    'not-signature': 'O campo encontrado não é um campo de assinatura digital.',
    occupied: 'O campo encontrado está preenchido ou bloqueado.',
    'invalid-area': 'A área reservada não tem um tamanho ou uma posição válida.',
    cancelled: 'A busca foi cancelada porque o documento ou a posição mudou.',
    error: 'Não foi possível ler os campos deste PDF.'
  };
  result.textContent = placement.status === 'placed'
    ? `Assinatura posicionada na área “${placement.fieldName}”, página ${placement.pageIndex + 1}. Confirme a posição para obter as coordenadas.`
    : messages[placement.status];
});
testPosition.addEventListener('click', () => {
  if (mounted.setPosition({x: 40, y: 60, pageIndex: 0})) {
    result.textContent = 'Posição inicial aplicada: X = 40, Y = 60, a partir do canto inferior direito da página 1 (pontos PDF).';
  }
});
document.querySelector('#toggle')!.addEventListener('click', event => {
  state.setEnabled(!state.enabled());
  (event.target as HTMLElement).textContent = state.enabled() ? 'Pausar posicionamento' : 'Ativar posicionamento';
});
document.querySelector<HTMLInputElement>('#file')!.addEventListener('change', async event => {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  const input = event.target as HTMLInputElement; input.disabled = true; status.textContent = 'Carregando documento…';
  const previousId = documents.getActiveDocumentId(), previousSelection = state.getSelection(); let loadingId: string | undefined;
  try {
  // Validate/open first so an invalid upload does not discard the current PDF.
  const opened = await documents.openDocumentBuffer({buffer: await file.arrayBuffer(), name: file.name, autoActivate: false}).toPromise();
  loadingId = opened.documentId;
  await opened.task.toPromise();
  documents.setActiveDocument(opened.documentId);
  if (previousId) {state.clear(previousId); await documents.closeDocument(previousId).toPromise();}
  result.textContent = 'A confirmação exibirá as coordenadas para o serviço de assinatura digital.';
  await new Promise(resolve => setTimeout(resolve, 0));
  initializeViewport(opened.documentId);
  document.querySelector<HTMLElement>('#filename')!.textContent = file.name;
  update();
  } catch {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (loadingId) await documents.closeDocument(loadingId).toPromise().catch(() => {});
    if (previousId) {
      documents.setActiveDocument(previousId);
      if (previousSelection) {
        const page = mounted.context.getPage(previousId, previousSelection.pageIndex);
        if (page) state.select(previousId, page, previousSelection.rect, previousSelection.rotation);
      }
      initializeViewport(previousId);
    }
    status.textContent = 'Não foi possível abrir este PDF. Escolha um arquivo PDF válido.';
  }
  finally {input.disabled = false; input.value = '';}
});
window.addEventListener('pagehide', () => {viewportObserver?.disconnect(); unsubscribeState(); unsubscribeContext(); mounted.destroy(); state.destroy();}, {once: true});
