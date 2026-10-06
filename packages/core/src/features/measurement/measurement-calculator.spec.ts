import {describe, expect, it} from 'vitest';
import {MeasurementCalculator} from './measurement-calculator';

const calibration = {linearFactor: 1, unit: 'm' as const, precision: 2};
const calculator = new MeasurementCalculator();

describe('MeasurementCalculator', () => {
  it('calcula distância e perímetro', () => {
    expect(calculator.distance({x: 0, y: 0}, {x: 3, y: 4}, calibration)).toBe(5);
    expect(calculator.perimeter([{x: 0, y: 0}, {x: 3, y: 4}, {x: 6, y: 4}], calibration)).toBe(8);
  });

  it('calcula área de polígono e retângulo', () => {
    expect(calculator.polygonArea([{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 3}], calibration)).toBe(6);
    expect(calculator.rectangleArea({width: 4, height: 3}, calibration)).toBe(12);
  });

  it('aplica o fator de calibração linear e quadrático', () => {
    const scaled = {...calibration, linearFactor: 2};
    expect(calculator.distance({x: 0, y: 0}, {x: 5, y: 0}, scaled)).toBe(10);
    expect(calculator.rectangleArea({width: 5, height: 2}, scaled)).toBe(40);
  });

  it('converte escalas arquitetônicas a partir dos pontos físicos do PDF', () => {
    expect(calculator.scaleFactor(50, 'm')).toBeCloseTo(25.4 / 72 * 50 / 1_000);
    expect(calculator.scaleFactor(100, 'm')).toBeCloseTo(25.4 / 72 * 100 / 1_000);
  });

  it('converte uma escala personalizada para a unidade exibida', () => {
    expect(calculator.customScaleFactor(1, 'cm', 1, 'm', 'm')).toBeCloseTo(25.4 / 72 / 10);
  });
});
