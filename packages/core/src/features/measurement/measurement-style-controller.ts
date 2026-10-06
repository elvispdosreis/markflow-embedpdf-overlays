import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {LineEndings, PdfAnnotationObject} from '@embedpdf/models';
import type {MeasurementStyleBridge, MeasurementStyleSnapshot} from './measurement-style-bridge';
import {MEASURE_COMMANDS, type MeasureCommandDefinition} from './measurement-command-definitions';
import {isMeasurementAnnotation, measurementKindFromAnnotation} from './measurement-tools';
import {isShapeMeasurementAnnotation} from './shape-measurement-label';
import {measurementFillColor, measurementFillPattern, measurementFillStylePatch} from './measurement-fill';
import {measurementStrokeStylePatch, type MeasurementStyleProperty} from './measurement-style.models';

export interface MeasurementStyleControllerOptions {
  getAnnotation(): AnnotationCapability | undefined;
  translate(documentId: string, key: string, fallback: string): string;
}

/** Selection/default resolution and edits, with no renderer or Angular dependencies. */
export class MeasurementStyleController {
  constructor(private readonly options: MeasurementStyleControllerOptions) {}
  createBridge(): MeasurementStyleBridge {
    return {
      snapshot: documentId => this.snapshot(documentId),
      update: (documentId, property, value) => this.update(documentId, property, value),
      colorPresets: () => this.options.getAnnotation()?.getColorPresets() ?? [],
      translate: (documentId, key, fallback) => this.options.translate(documentId, key, fallback)
    };
  }
  snapshot(documentId: string): MeasurementStyleSnapshot | null {
    const scope = this.options.getAnnotation()?.forDocument(documentId);
    if (!scope) return null;
    const selected = scope.getSelectedAnnotations();
    let definition: MeasureCommandDefinition | undefined;
    let source: Partial<PdfAnnotationObject> & Record<string, unknown>;
    let mode: MeasurementStyleSnapshot['mode'];

    if (selected.length) {
      if (selected.length !== 1) return null;
      const kind = measurementKindFromAnnotation(selected[0].object);
      definition = MEASURE_COMMANDS.find(command => command.kind === kind);
      if (!definition) return null;
      source = selected[0].object as Partial<PdfAnnotationObject> & Record<string, unknown>;
      mode = 'selection';
    } else {
      const activeTool = scope.getActiveTool();
      definition = MEASURE_COMMANDS.find(command => command.toolId === activeTool?.id);
      if (!definition || !activeTool) return null;
      source = activeTool.defaults as Partial<PdfAnnotationObject> & Record<string, unknown>;
      mode = 'defaults';
    }

    const translatedLabel = this.options.translate(documentId, definition.labelKey, definition.label);
    return {
      kind: definition.kind,
      label: translatedLabel && translatedLabel !== definition.labelKey ? translatedLabel : definition.label,
      mode,
      values: {
        color: measurementFillColor(source),
        fillPattern: measurementFillPattern(source),
        opacity: typeof source['opacity'] === 'number' ? source['opacity'] : 1,
        strokeColor: typeof source['strokeColor'] === 'string' ? source['strokeColor'] : '#E44234',
        strokeStyle: typeof source['strokeStyle'] === 'number' ? source['strokeStyle'] : 1,
        strokeWidth: typeof source['strokeWidth'] === 'number' ? source['strokeWidth'] : 1,
        lineEndings: source['lineEndings'] as LineEndings | undefined,
        rotation: typeof source['rotation'] === 'number' ? source['rotation'] : 0
      }
    };
  }

  update(
    documentId: string,
    property: MeasurementStyleProperty,
    value: unknown
  ): void {
    const scope = this.options.getAnnotation()?.forDocument(documentId);
    if (!scope) return;
    const selected = scope.getSelectedAnnotations();
    if (selected.length === 1 && isMeasurementAnnotation(selected[0].object)) {
      const source = selected[0].object;
      const fillProperty = property === 'fillPattern' || (property === 'color' && isShapeMeasurementAnnotation(source));
      if (property === 'fillPattern' && !isShapeMeasurementAnnotation(source)) return;
      scope.updateAnnotation(selected[0].object.pageIndex, selected[0].object.id, {
        ...(fillProperty ? measurementFillStylePatch(source, property as 'fillPattern' | 'color', value)
          : property === 'strokeStyle' ? measurementStrokeStylePatch(value) : {[property]: value})
      } as Partial<PdfAnnotationObject>);
      return;
    }
    if (selected.length) return;
    const activeTool = scope.getActiveTool();
    if (activeTool && MEASURE_COMMANDS.some(command => command.toolId === activeTool.id)) {
      const kind = MEASURE_COMMANDS.find(command => command.toolId === activeTool.id)?.kind;
      const shape = kind === 'area' || kind === 'rectangle-area' || kind === 'ellipse';
      if (property === 'fillPattern' && !shape) return;
      this.options.getAnnotation()?.setToolDefaults(activeTool.id, shape && (property === 'fillPattern' || property === 'color')
        ? measurementFillStylePatch(activeTool.defaults, property, value)
        : property === 'strokeStyle' ? measurementStrokeStylePatch(value) : {[property]: value});
    }
  }

}
