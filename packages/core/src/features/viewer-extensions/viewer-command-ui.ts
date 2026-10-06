import type {CommandsCapability} from '@embedpdf/plugin-commands';
import type {ToolbarSchema, ToolbarItem} from '@embedpdf/plugin-ui';

export function firstAvailableShortcut(
  commands: Pick<CommandsCapability, 'getCommandByShortcut'>,
  candidates: readonly string[]
): string | undefined {
  return candidates.find(shortcut => !commands.getCommandByShortcut(shortcut));
}

export function shortcutLabel(shortcut: string | undefined): string | undefined {
  return shortcut?.split('+').map(part => part.length === 1 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`).join('+');
}

export function withViewerToolButtons(toolbar: ToolbarSchema, includeGuides: boolean, includeCrosshair: boolean): ToolbarSchema {
  const customIds = new Set(['crosshair-toggle-button', 'crosshair-menu-button', 'guides-menu-button']);
  const buttons: ToolbarItem[] = [];
  if (includeCrosshair) {
    buttons.push({type: 'command-button', id: 'crosshair-menu-button', commandId: 'crosshair:menu', variant: 'icon'});
  }
  if (includeGuides) {
    buttons.push({type: 'command-button', id: 'guides-menu-button', commandId: 'guides:menu', variant: 'icon'});
  }

  const items = toolbar.items
    .filter(item => !customIds.has(item.id))
    .map(item => item.type === 'group'
      ? {...item, items: item.items.filter(child => !customIds.has(child.id))}
      : item);
  const pointerIndex = items.findIndex(item => item.id === 'pointer-button');
  if (pointerIndex >= 0) {
    items.splice(pointerIndex + 1, 0, ...buttons);
    return {...toolbar, items};
  }

  let inserted = false;
  const nestedItems = items.map(item => {
    if (item.type !== 'group') return item;
    const nestedPointerIndex = item.items.findIndex(child => child.id === 'pointer-button');
    if (nestedPointerIndex < 0) return item;
    const groupItems = [...item.items];
    groupItems.splice(nestedPointerIndex + 1, 0, ...buttons);
    inserted = true;
    return {...item, items: groupItems};
  });
  return {...toolbar, items: inserted ? nestedItems : [...nestedItems, ...buttons]};
}
