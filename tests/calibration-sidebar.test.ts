import {afterEach, describe, expect, it, vi} from 'vitest';
import {CalibrationController} from '../packages/calibration/src/calibration-controller';
import {mountCalibrationSidebar, notifyCalibrationSidebar, registerCalibrationSidebar,
  registerCalibrationSidebarBridge, type CalibrationSidebarBridge} from '../packages/calibration/src/calibration-sidebar';

afterEach(() => document.body.replaceChildren());
function setup() {
  const model = new CalibrationController();
  const apply = vi.fn(() => model.apply()), cancel = vi.fn(() => model.resetDraft());
  const bridge: CalibrationSidebarBridge = {
    snapshot: () => ({draft: {...model.draft}, valid: model.isValid()}),
    update: (_id, patch) => {model.draft = {...model.draft, ...patch};}, apply, cancel
  };
  const host = document.createElement('div'); document.body.append(host);
  const mounted = mountCalibrationSidebar(host, 'doc', bridge);
  const field = (label: string) => host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
  return {host, model, apply, cancel, mounted, field};
}
describe('visual calibration extension', () => {
  it('starts at an applied 1:100 scale and preserves imported calibration', () => {
    const {model, field, mounted} = setup();
    expect(model.appliedDraft.preset).toBe(100);
    expect(field('Escala do projeto').value).toBe('100');
    model.draft.preset = 50; model.apply();
    const imported = {...model.calibration};
    model.import(imported); mounted.refresh();
    expect(field('Escala do projeto').value).toBe('50');
  });
  it('keeps scale edits pending until Apply and resets them on Cancel', () => {
    const {host, model, field, apply, cancel} = setup();
    field('Escala do projeto').value = '200'; field('Escala do projeto').dispatchEvent(new Event('change'));
    expect(model.draft.preset).toBe(200); expect(model.appliedDraft.preset).toBe(100);
    host.querySelector<HTMLButtonElement>('[data-apply]')!.click(); expect(apply).toHaveBeenCalledOnce();
    expect(model.appliedDraft.preset).toBe(200);
    field('Escala do projeto').value = '50'; field('Escala do projeto').dispatchEvent(new Event('change'));
    [...host.querySelectorAll('button')].find(item => item.textContent === 'Cancelar')!.click();
    expect(cancel).toHaveBeenCalledOnce(); expect(model.draft.preset).toBe(200);
  });
  it('allows typing custom values without replacing the focused input and rejects zero', () => {
    const {host, model, field} = setup();
    [...host.querySelectorAll('button')].find(item => item.textContent === 'Personalizada')!.click();
    const input = field('Medida no papel'); input.focus(); input.value = '0'; input.dispatchEvent(new Event('input'));
    expect(document.activeElement).toBe(input);
    expect(host.querySelector<HTMLButtonElement>('[data-apply]')!.disabled).toBe(true);
    input.value = '2'; input.dispatchEvent(new Event('input'));
    expect(model.draft.paperValue).toBe(2);
    expect(host.querySelector<HTMLButtonElement>('[data-apply]')!.disabled).toBe(false);
  });
  it('keeps the active select usable by keyboard after a value change', () => {
    const {field} = setup();
    field('Escala do projeto').focus(); field('Escala do projeto').value = '200';
    field('Escala do projeto').dispatchEvent(new Event('change'));
    expect(document.activeElement).toBe(field('Escala do projeto'));
    expect(field('Escala do projeto').value).toBe('200');
  });
  it('registers a native sidebar rather than a modal', () => {
    const mergeSchema = vi.fn(); registerCalibrationSidebar({mergeSchema} as never);
    expect(mergeSchema.mock.calls[0][0]).toMatchObject({sidebars: {'markflow-calibration-panel': {
      position: {placement: 'left', slot: 'main'}, content: {componentId: 'markflow-calibration-sidebar'}, defaultOpen: false
    }}});
  });
  it('removes its DOM and subscriptions when disposed', () => {
    const {host, mounted} = setup(); mounted.dispose(); notifyCalibrationSidebar(); expect(host.children).toHaveLength(0);
    const dispose = registerCalibrationSidebarBridge({snapshot: vi.fn(), update: vi.fn(), apply: vi.fn(), cancel: vi.fn()});
    dispose(); expect(() => notifyCalibrationSidebar()).not.toThrow();
  });
});
