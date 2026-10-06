import type {MeasurementToolDefinition} from './measurement-tools';
import {MEASUREMENT_TOOL_IDS} from './measurement-tools';
import {MEASUREMENT_I18N_KEYS} from './measurement-i18n';
import {MEASUREMENT_ICON_NAMES} from './measurement-icons';

export interface MeasureCommandDefinition extends MeasurementToolDefinition {
  id: string;
  labelKey: string;
  icon: string;
}

export const MEASURE_COMMANDS: ReadonlyArray<MeasureCommandDefinition> = [
  {id: 'measure:distance', label: 'Distância', labelKey: MEASUREMENT_I18N_KEYS.distance, icon: MEASUREMENT_ICON_NAMES.distance, toolId: MEASUREMENT_TOOL_IDS.distance, baseToolId: 'line', kind: 'distance'},
  {id: 'measure:perimeter', label: 'Perímetro', labelKey: MEASUREMENT_I18N_KEYS.perimeter, icon: MEASUREMENT_ICON_NAMES.perimeter, toolId: MEASUREMENT_TOOL_IDS.perimeter, baseToolId: 'polyline', kind: 'perimeter'},
  {id: 'measure:area', label: 'Área', labelKey: MEASUREMENT_I18N_KEYS.area, icon: MEASUREMENT_ICON_NAMES.area, toolId: MEASUREMENT_TOOL_IDS.area, baseToolId: 'polygon', kind: 'area'},
  {id: 'measure:rectangle', label: 'Área retangular', labelKey: MEASUREMENT_I18N_KEYS.rectangleArea, icon: MEASUREMENT_ICON_NAMES.rectangleArea, toolId: MEASUREMENT_TOOL_IDS['rectangle-area'], baseToolId: 'square', kind: 'rectangle-area'},
  {id: 'measure:ellipse', label: 'Elipse', labelKey: MEASUREMENT_I18N_KEYS.ellipse, icon: MEASUREMENT_ICON_NAMES.ellipse, toolId: MEASUREMENT_TOOL_IDS.ellipse, baseToolId: 'circle', kind: 'ellipse'},
  {id: 'measure:arc', label: 'Arco', labelKey: MEASUREMENT_I18N_KEYS.arc, icon: MEASUREMENT_ICON_NAMES.arc, toolId: MEASUREMENT_TOOL_IDS.arc, baseToolId: 'polyline', kind: 'arc'}
];

