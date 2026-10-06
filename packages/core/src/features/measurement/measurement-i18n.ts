import type {I18nCapability} from '@embedpdf/snippet';

export const MEASUREMENT_I18N_KEYS = {
  mode: 'markflow.measurements.mode',
  distance: 'markflow.measurements.distance',
  perimeter: 'markflow.measurements.perimeter',
  area: 'markflow.measurements.area',
  rectangleArea: 'markflow.measurements.rectangleArea',
  ellipse: 'markflow.measurements.ellipse',
  arc: 'markflow.measurements.arc',
  calibrate: 'markflow.measurements.calibrate'
} as const;

export const MEASUREMENT_SIDEBAR_I18N_KEYS = {
  title: 'markflow.measurements.sidebar.title',
  empty: 'markflow.measurements.sidebar.empty',
  emptyHint: 'markflow.measurements.sidebar.emptyHint',
  previous: 'markflow.measurements.sidebar.previous',
  next: 'markflow.measurements.sidebar.next',
  page: 'markflow.measurements.sidebar.page',
  color: 'markflow.measurements.sidebar.color',
  scale: 'markflow.measurements.sidebar.scale',
  unit: 'markflow.measurements.sidebar.unit',
  precision: 'markflow.measurements.sidebar.precision',
  thickness: 'markflow.measurements.sidebar.thickness',
  angle: 'markflow.measurements.sidebar.angle',
  axisX: 'markflow.measurements.sidebar.axisX',
  axisY: 'markflow.measurements.sidebar.axisY',
  segments: 'markflow.measurements.sidebar.segments',
  segment: 'markflow.measurements.sidebar.segment',
  vertices: 'markflow.measurements.sidebar.vertices',
  vertex: 'markflow.measurements.sidebar.vertex',
  deleteVertex: 'markflow.measurements.sidebar.deleteVertex',
  deleteSegment: 'markflow.measurements.sidebar.deleteSegment',
  deleteMeasurement: 'markflow.measurements.sidebar.deleteMeasurement',
  perimeterValue: 'markflow.measurements.sidebar.perimeterValue',
  areaValue: 'markflow.measurements.sidebar.areaValue',
  width: 'markflow.measurements.sidebar.width',
  height: 'markflow.measurements.sidebar.height',
  horizontalAxis: 'markflow.measurements.sidebar.horizontalAxis',
  verticalAxis: 'markflow.measurements.sidebar.verticalAxis',
  radius: 'markflow.measurements.sidebar.radius',
  centralAngle: 'markflow.measurements.sidebar.centralAngle',
  chord: 'markflow.measurements.sidebar.chord'
} as const;

type SidebarTranslations = Record<keyof typeof MEASUREMENT_SIDEBAR_I18N_KEYS, string>;
type MeasurementTranslations = Record<keyof typeof MEASUREMENT_I18N_KEYS, string> & {
  sidebar: SidebarTranslations;
};

const TRANSLATIONS: Record<string, MeasurementTranslations> = {
  en: {
    mode: 'Measurements',
    distance: 'Distance',
    perimeter: 'Perimeter',
    area: 'Area',
    rectangleArea: 'Rectangle area',
    ellipse: 'Ellipse',
    arc: 'Arc',
    calibrate: 'Calibrate',
    sidebar: {
      title: 'Measurements', empty: 'No measurements', emptyHint: 'Choose a measurement tool and draw on the PDF.',
      previous: 'Previous measurement', next: 'Next measurement', page: 'Page', color: 'Color',
      scale: 'Scale', unit: 'Unit', precision: 'Precision', thickness: 'Thickness', angle: 'Angle',
      axisX: 'X axis', axisY: 'Y axis', segments: 'Segments', segment: 'Segment', vertices: 'Vertices', vertex: 'Vertex', deleteVertex: 'Delete vertex', deleteSegment: 'Delete segment', deleteMeasurement: 'Delete measurement',
      perimeterValue: 'Perimeter', areaValue: 'Area', width: 'Width', height: 'Height', horizontalAxis: 'Horizontal axis',
      verticalAxis: 'Vertical axis', radius: 'Radius', centralAngle: 'Central angle', chord: 'Chord'
    }
  },
  'pt-BR': {
    mode: 'Medições',
    distance: 'Distância',
    perimeter: 'Perímetro',
    area: 'Área',
    rectangleArea: 'Área retangular',
    ellipse: 'Elipse',
    arc: 'Arco',
    calibrate: 'Calibrar',
    sidebar: {
      title: 'Medições', empty: 'Nenhuma medição', emptyHint: 'Escolha uma ferramenta de medição e desenhe sobre o PDF.',
      previous: 'Medição anterior', next: 'Próxima medição', page: 'Página', color: 'Cor',
      scale: 'Escala', unit: 'Unidade', precision: 'Precisão', thickness: 'Espessura', angle: 'Ângulo',
      axisX: 'Eixo X', axisY: 'Eixo Y', segments: 'Segmentos', segment: 'Segmento', vertices: 'Vértices', vertex: 'Vértice', deleteVertex: 'Excluir vértice', deleteSegment: 'Excluir segmento', deleteMeasurement: 'Excluir medição',
      perimeterValue: 'Perímetro', areaValue: 'Área', width: 'Largura', height: 'Altura', horizontalAxis: 'Eixo horizontal',
      verticalAxis: 'Eixo vertical', radius: 'Raio', centralAngle: 'Ângulo central', chord: 'Corda'
    }
  }
};

/** Adds application translations without replacing EmbedPDF's native locales. */
export function registerMeasurementTranslations(i18n: I18nCapability): void {
  for (const [code, measurements] of Object.entries(TRANSLATIONS)) {
    const locale = i18n.getLocaleInfo(code);
    if (!locale) continue;
    const existing = locale.translations['markflow'];
    locale.translations['markflow'] = {
      ...(typeof existing === 'object' && existing ? existing : {}),
      measurements
    };
  }
}
