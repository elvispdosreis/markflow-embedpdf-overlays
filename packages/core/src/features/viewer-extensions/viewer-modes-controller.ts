import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {Command} from '@embedpdf/snippet';
import type {CrosshairStyle} from '../crosshair/crosshair-context';
import type {GuidesState, GuideOrientation} from '../guides/guides-state';
import type {GuideDragActivity} from '../guides/guides-interaction';
import {setDistanceAngleConstraintActive, type DistanceMeasurementDetails} from '../measurement/distance-measurement';
import type {ArcMeasurementDetails} from '../measurement/arc-measurement';
import type {LiveDistancePreview} from '../measurement/measurement-interaction';
import type {MeasurementDetailSelection} from '../measurement/measurement-highlight-controller';
import type {MeasureCommandDefinition} from '../measurement/measurement-command-definitions';
import type {MeasurementKind} from '../measurement/measurement.models';
const CROSSHAIR_STYLE_KEY = 'markflow.crosshair.style';
const CROSSHAIR_ENABLED_KEY = 'markflow.crosshair.enabled';
export interface ViewerModesOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getDetail(): MeasurementDetailSelection | null;
  guides: GuidesState;
  isBlocked(): boolean;
  store(key: string, value: string): void;
  onCancelInteraction(): void;
  onCloseCalibration(): void;
  onCreating(orientation: GuideOrientation | null): void;
  onTool(kind: MeasurementKind | 'select'): void;
  onDistance(details: DistanceMeasurementDetails | null): void;
  onArc(details: ArcMeasurementDetails | null): void;
  onPreview(preview: LiveDistancePreview | null): void;
  onCrosshairStyle(style: CrosshairStyle): void;
  onCrosshairEnabled(enabled: boolean): void;
  onGuideActivity(activity: GuideDragActivity | null): void;
  onStatus(message: string): void;
  onDeleteVertex(documentId: string, annotationId: string, index: number): void;
  onDeleteSegment(documentId: string, annotationId: string, index: number): void;
}
/** Keyboard/mode coordination. The host supplies listeners, UI state and persistence. */
export class ViewerModesController {
  constructor(private readonly options: ViewerModesOptions) {}
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      setDistanceAngleConstraintActive(true);
      return;
    }
    if (event.key === 'Escape') {
      this.options.onCancelInteraction();
      this.options.onCreating(null);
      event.preventDefault();
      this.options.onCloseCalibration();
      this.options.getAnnotation()?.setActiveTool(null);
      this.options.getAnnotation()?.deselectAnnotation();
      this.options.onTool('select');
      this.options.onDistance(null);
      this.options.onArc(null);
      this.options.onPreview(null);
      this.options.onStatus('Seleção cancelada.');
      return;
    }

    if ((event.key !== 'Delete' && event.key !== 'Backspace') || this.isEditingText(event)) {
      return;
    }

    if (this.options.getDetail()?.kind === 'vertex' || this.options.getDetail()?.kind === 'segment') {
      event.preventDefault();
      event.stopPropagation();
      const selection = this.options.getDetail()!;
      if (selection.kind === 'vertex') this.options.onDeleteVertex(selection.documentId, selection.annotationId, selection.index);
      else this.options.onDeleteSegment(selection.documentId, selection.annotationId, selection.index);
      return;
    }

    const api = this.options.getAnnotation();
    const selected = api?.getSelectedAnnotations() ?? [];
    if (selected.length === 0 || !api) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    api.deleteAnnotations(selected.map(({object}) => ({
      pageIndex: object.pageIndex,
      id: object.id
    })));
    this.options.onDistance(null);
    this.options.onArc(null);
    this.options.onStatus(selected.length === 1 ? 'Elemento excluído.' : `${selected.length} elementos excluídos.`);
  }
  handleKeyboardShortcutRelease(event: KeyboardEvent): void {
    if (event.key === 'Shift') setDistanceAngleConstraintActive(false);
  }
  resetDistanceAngleConstraint(): void {
    setDistanceAngleConstraintActive(false);
  }
  isEditingText(event: Event): boolean {
    return event.composedPath().some(target => (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable)
    ));
  }
  setCrosshairEnabled(enabled: boolean, style: CrosshairStyle = 'full'): void {
    if (enabled) {
      this.options.onCrosshairStyle(style);
      this.options.store(CROSSHAIR_STYLE_KEY, style);
    }
    this.options.onCrosshairEnabled(enabled);
    this.options.store(CROSSHAIR_ENABLED_KEY, String(enabled));
    this.options.onStatus(enabled ? 'Mira ativada.' : 'Mira desativada.');
  }
  beginGuide(orientation: GuideOrientation): void {
    this.options.guides.setEnabled(true);
    this.options.getAnnotation()?.setActiveTool(null);
    this.options.getAnnotation()?.deselectAnnotation();
    this.options.onTool('select');
    this.options.onCreating(orientation);
    this.options.onStatus(`Guide ${orientation === 'horizontal' ? 'horizontal' : 'vertical'}: clique na página. Escape cancela.`);
  }
  setGuidesEnabled(enabled: boolean): void {
    this.options.guides.setEnabled(enabled);
    this.options.onCreating(null);
    this.options.onGuideActivity(null);
    this.options.onStatus(enabled
      ? 'Réguas ativas · arraste de uma régua até a página para criar uma Guide.'
      : 'Réguas e Guides desativadas; posições preservadas.');
  }
  finishRulerGuideCreation(): void {
    this.options.onStatus('Guide criada · arraste para mover ou devolva à régua para excluir.');
  }
  finishGuideCreation(): void {
    this.options.onCreating(null);
    this.options.onStatus('Guides: arraste para mover; selecione e pressione Delete para excluir.');
  }
  selectGuide(): void {
    this.options.getAnnotation()?.deselectAnnotation();
    this.options.onStatus('Guide selecionada · Delete para excluir · Escape para desmarcar.');
  }
  shortcutsBlocked(): boolean {
    if (this.options.isBlocked()) return true;
    let active: Element | null = document.activeElement;
    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active instanceof HTMLInputElement
      || active instanceof HTMLTextAreaElement
      || active instanceof HTMLSelectElement
      || (active instanceof HTMLElement && (active.isContentEditable
        || !!active.closest('[contenteditable="true"], [role="textbox"], [role="dialog"], [popover]:popover-open')));
  }
  createMeasureCommand(definition: MeasureCommandDefinition): Command {
    return {
      id: definition.id,
      label: definition.label,
      labelKey: definition.labelKey,
      icon: definition.icon,
      categories: ['annotation', 'measure', `measure-${definition.kind}`],
      action: ({documentId}) => {
        const scope = this.options.getAnnotation()?.forDocument(documentId);
        this.options.onCreating(null);
        const activeToolId = scope?.getActiveTool()?.id;
        scope?.setActiveTool(activeToolId === definition.toolId ? null : definition.toolId);
        this.options.onTool(activeToolId === definition.toolId ? 'select' : definition.kind);
        this.options.onStatus(definition.kind === 'arc'
          ? 'Arco: marque o início, o fim e depois um ponto da curvatura.'
          : definition.kind === 'distance'
            ? 'Distância: desenhe sobre a planta · segure Shift para ângulos de 22,5°.'
            : definition.kind === 'perimeter' || definition.kind === 'area'
              ? `${definition.label}: clique para criar os segmentos · segure Shift para ângulos de 22,5°.`
            : definition.kind === 'rectangle-area'
              ? 'Área retangular: segure Shift para desenhar um quadrado.'
              : definition.kind === 'ellipse'
                ? 'Elipse: segure Shift para desenhar um círculo.'
            : `${definition.label}: desenhe sobre a planta.`);
      },
      active: ({documentId}) => this.options.getAnnotation()?.forDocument(documentId).getActiveTool()?.id === definition.toolId
    };
  }
}