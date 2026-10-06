import {describe, expect, it, vi} from 'vitest';
import {TechnicalCommentSidebar, adjacentTechnicalComment, navigateToTechnicalComment} from './technical-comment-sidebar';
import {registerTechnicalCommentSidebarBridge} from './technical-comment-sidebar-bridge';
import type {TechnicalComment} from './technical-comment.models';

const item = (id: string, number: number, kind: TechnicalComment['kind'] = 'note'): TechnicalComment => ({
  id, number, kind, pageIndex: 1, rect: {origin: {x: 20, y: 30}, size: {width: 170, height: 30}},
  body: 'Conferir camada de corte', color: '#0369a1'
});

describe('technical comment sidebar', () => {
  it('centers and selects a selected comment while next/previous follow its number', () => {
    const annotation = {selectAnnotation: vi.fn()};
    const scroll = {scrollToPage: vi.fn()};
    const entries = [item('a', 1), item('b', 3), item('c', 5)];

    navigateToTechnicalComment(entries[1], annotation, scroll);

    expect(scroll.scrollToPage).toHaveBeenCalledWith({
      pageNumber: 2, pageCoordinates: {x: 105, y: 45},
      behavior: 'smooth', alignX: 50, alignY: 50
    });
    expect(annotation.selectAnnotation).toHaveBeenCalledWith(1, 'b');
    expect(adjacentTechnicalComment(entries, 'b', -1)?.id).toBe('a');
    expect(adjacentTechnicalComment(entries, 'b', 1)?.id).toBe('c');
    expect(adjacentTechnicalComment(entries, 'c', 1)).toBeNull();
  });

  it('edits type and text and deletes only the chosen comment', () => {
    const update = vi.fn();
    const navigate = vi.fn();
    const remove = vi.fn();
    const setCreationKind = vi.fn();
    const startCreating = vi.fn();
    const setLegendVisible = vi.fn();
    const dispose = registerTechnicalCommentSidebarBridge({
      snapshot: () => ({items: [item('a', 1), item('b', 2)], selectedId: 'a', creationKind: 'note', creating: false, legendVisible: true}),
      navigate, update, remove, setCreationKind, startCreating, setLegendVisible,
      translate: (_doc, _key, fallback) => fallback
    });
    TechnicalCommentSidebar({documentId: 'doc'});
    const view = Object.assign(document.createElement('markflow-technical-comments-sidebar-view'), {documentId: 'doc'});
    document.body.append(view);
    try {
      const card = view.querySelector<HTMLElement>('[data-comment-id="a"]')!;
      const kind = card.querySelector<HTMLSelectElement>('[data-comment-kind]')!;
      expect([...kind.options].map(option => option.textContent)).toContain('Resolvido');
      kind.value = 'resolved'; kind.dispatchEvent(new Event('change', {bubbles: true}));
      const creationKind = view.querySelector<HTMLSelectElement>('[data-focus-key="creation-kind"]')!;
      creationKind.value = 'resolved'; creationKind.dispatchEvent(new Event('change', {bubbles: true}));
      const body = card.querySelector<HTMLTextAreaElement>('textarea')!;
      body.focus();
      expect(navigate).not.toHaveBeenCalled();
      body.value = 'Nova descrição'; body.dispatchEvent(new Event('change', {bubbles: true}));
      card.querySelector<HTMLElement>('.tc-page')!.click();
      card.querySelector<HTMLButtonElement>('[data-comment-action="delete"]')!.click();
      const legend = view.querySelector<HTMLInputElement>('.tc-legend input')!;
      expect(legend.checked).toBe(true);
      legend.checked = false; legend.dispatchEvent(new Event('change', {bubbles: true}));

      expect(update).toHaveBeenNthCalledWith(1, 'doc', 'a', {kind: 'resolved'});
      expect(update).toHaveBeenNthCalledWith(2, 'doc', 'a', {body: 'Nova descrição'});
      expect(setCreationKind).toHaveBeenCalledWith('doc', 'resolved');
      expect(remove).toHaveBeenCalledWith('doc', 'a');
      expect(navigate).toHaveBeenCalledWith('doc', expect.objectContaining({id: 'a'}));
      expect(setLegendVisible).toHaveBeenCalledWith('doc', false);
      expect(view.textContent).toContain('Comentários técnicos');
      expect(view.textContent).toContain('2');
    } finally {
      view.remove(); dispose();
    }
  });
});
