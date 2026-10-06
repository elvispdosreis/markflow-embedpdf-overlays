import {describe, expect, it, vi} from 'vitest';
import {mountTechnicalCommentMarkers} from './technical-comment-marker';
import type {TechnicalComment} from './technical-comment.models';

describe('technical comment marker', () => {
  it('replaces only the viewer appearance with a numbered pin and optional legend', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({mode: 'open'});
    const annotation = document.createElement('div');
    annotation.setAttribute('data-no-interaction', 'true');
    annotation.innerHTML = '<div style="position:absolute;left:10px;top:20px;width:24px;height:24px"><div style="position:absolute;width:24px;height:24px"><div><svg viewBox="0 0 20 20"></svg></div></div></div>';
    root.append(annotation);
    const item: TechnicalComment = {
      id: 'comment-3', pageIndex: 0, rect: {origin: {x: 10, y: 20}, size: {width: 24, height: 24}},
      number: 3, kind: 'error', color: '#dc2626', body: 'Revisar cota'
    };
    let legendVisible = true;
    const onUpdate = vi.fn();
    const onSelect = vi.fn();
    const mounted = mountTechnicalCommentMarkers(root, () => ({items: [item], legendVisible}), {onUpdate, onSelect});
    const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    try {
      await settle();
      expect(annotation.querySelector('.markflow-comment-pin text')?.textContent).toBe('3');
      expect(annotation.querySelector('.markflow-comment-pin path')?.getAttribute('d')).toContain('M 12 12 L 105 12');
      expect(annotation.querySelector('.markflow-comment-label')?.textContent).toBe('Revisar cota');
      const layer = annotation.firstElementChild as HTMLElement;
      layer.style.width = '192px';
      layer.style.height = '192px';
      layer.style.left = '80px';
      layer.style.top = '160px';
      await settle();
      expect((annotation.querySelector('.markflow-comment-marker') as HTMLElement).style.width).toBe('192px');
      expect((annotation.querySelector('.markflow-comment-marker') as HTMLElement).style.getPropertyValue('--markflow-comment-zoom')).toBe('8');
      expect(annotation.querySelector<SVGElement>('svg[viewBox]')?.style.visibility).toBe('hidden');
      annotation.querySelector('.markflow-comment-pin')!.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
      expect(onSelect).toHaveBeenCalledWith('comment-3', 0);
      legendVisible = false; mounted.refresh(); await settle();
      expect(annotation.querySelector('.markflow-comment-label')).toBeNull();
      expect(annotation.querySelector('.markflow-comment-pin text')?.textContent).toBe('3');
      annotation.querySelector('.markflow-comment-pin')!.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
      const form = annotation.querySelector<HTMLFormElement>('.markflow-comment-editor')!;
      expect(form).not.toBeNull();
      const kind = form.querySelector('select')!;
      expect([...kind.options].map(option => option.textContent)).toContain('Resolvido');
      kind.value = 'resolved'; kind.dispatchEvent(new Event('change', {bubbles: true}));
      const body = form.querySelector('textarea')!;
      body.value = 'A cota está correta?'; body.dispatchEvent(new Event('input', {bubbles: true}));
      form.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      expect(onUpdate).toHaveBeenCalledWith('comment-3', {kind: 'resolved', body: 'A cota está correta?'});
    } finally {
      mounted.destroy(); host.remove();
    }
    expect(annotation.querySelector<SVGElement>('svg[viewBox]')?.style.visibility).toBe('');
  });
});
