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
  const field = (label: string) => host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const choose = (label: string, value: string) => {
    field(label).click();
    host.querySelector<HTMLButtonElement>(`[role="listbox"][aria-label="${label}"] [data-value="${value}"]`)!.click();
  };
  return {host, model, apply, cancel, mounted, field, choose};
}
describe('visual calibration extension', () => {
  it('starts at an applied 1:100 scale and preserves imported calibration', () => {
    const {model, field, mounted} = setup();
    expect(model.appliedDraft.preset).toBe(100);
    expect(field('Escala do projeto').textContent).toBe('1:100');
    model.draft.preset = 50; model.apply();
    const imported = {...model.calibration};
    model.import(imported); mounted.refresh();
    expect(field('Escala do projeto').textContent).toBe('1:50');
  });
  it('keeps scale edits pending until Apply and resets them on Cancel', () => {
    const {host, model, choose, apply, cancel} = setup();
    choose('Escala do projeto', '200');
    expect(model.draft.preset).toBe(200); expect(model.appliedDraft.preset).toBe(100);
    host.querySelector<HTMLButtonElement>('[data-apply]')!.click(); expect(apply).toHaveBeenCalledOnce();
    expect(model.appliedDraft.preset).toBe(200);
    choose('Escala do projeto', '50');
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
    const {field, choose} = setup();
    choose('Escala do projeto', '200');
    expect(document.activeElement).toBe(field('Escala do projeto'));
    expect(field('Escala do projeto').textContent).toBe('1:200');
  });
  it('opens themed listboxes, navigates options and closes with Escape or outside clicks', () => {
    const {host, field, model} = setup();
    const trigger = field('Escala do projeto');
    trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toBe('1:100');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    expect(document.activeElement?.textContent).toBe('1:200');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(trigger.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(trigger);
    expect(model.draft.preset).toBe(100);
    trigger.click(); document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('select')).toBeNull();
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
