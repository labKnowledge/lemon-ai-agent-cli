import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InteractionMode } from '../../plan/modes.ts';
import { modeLabel } from '../../plan/modes.ts';
import { searchFiles } from '../autocomplete/file-search.ts';
import { buildShellHintItems, filterShellItems } from '../autocomplete/shell-hints.ts';
import {
  AUTOCOMPLETE_MAX_ROWS,
  detectInputTrigger,
  filterSlashCommands,
  getAtQuery,
  getBangQuery,
  getSlashQuery,
  slashCommandsToItems,
  type AutocompleteItem,
  type InputTrigger,
  type SlashCommand,
} from '../commands/registry.ts';
import { useAutocompleteKeys } from '../hooks/useAutocompleteKeys.ts';
import { LEMON_TOKENS } from '../theme/tokens.ts';
import { AutocompleteMenu } from './AutocompleteMenu.tsx';

export function InputAutocomplete({
  mode,
  cwd,
  slashCommands,
  lastBangCommand,
  insertText,
  onInsertConsumed,
  placeholder,
  onSubmit,
  onMenuHeightChange,
}: {
  mode: InteractionMode;
  cwd: string;
  slashCommands: SlashCommand[];
  lastBangCommand: string | null;
  insertText?: string | null;
  onInsertConsumed?: () => void;
  placeholder: string;
  onSubmit: (line: string) => void;
  onMenuHeightChange: (rows: number) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (insertText == null) return;
    setInputValue(insertText);
    setTrigger(null);
    setItems([]);
    onInsertConsumed?.();
  }, [insertText, onInsertConsumed]);
  const [trigger, setTrigger] = useState<InputTrigger | null>(null);
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const menuVisible = trigger !== null;
  const menuNavigable = menuVisible && items.length > 0;

  const refreshItems = useCallback(
    async (value: string, active: InputTrigger | null) => {
      if (!active) {
        setItems([]);
        return;
      }

      if (active === '/') {
        const query = getSlashQuery(value) ?? '/';
        const filtered = filterSlashCommands(slashCommands, query);
        setItems(slashCommandsToItems(filtered).slice(0, AUTOCOMPLETE_MAX_ROWS));
        return;
      }

      if (active === '!') {
        const query = getBangQuery(value) ?? '!';
        const all = buildShellHintItems(lastBangCommand);
        setItems(filterShellItems(all, query).slice(0, AUTOCOMPLETE_MAX_ROWS));
        return;
      }

      if (active === '@') {
        const query = getAtQuery(value) ?? '@';
        setLoadingFiles(true);
        try {
          const found = await searchFiles(cwd, query, AUTOCOMPLETE_MAX_ROWS);
          setItems(found);
        } finally {
          setLoadingFiles(false);
        }
      }
    },
    [cwd, slashCommands, lastBangCommand],
  );

  const handleInput = useCallback(
    (value: string) => {
      setInputValue(value);
      const active = detectInputTrigger(value);
      setTrigger(active);
      setSelectedIndex(0);
      void refreshItems(value, active);
    },
    [refreshItems],
  );

  useEffect(() => {
    if (trigger === '/') {
      void refreshItems(inputValue, trigger);
    }
  }, [slashCommands, trigger, inputValue, refreshItems]);

  const closeMenu = useCallback(() => {
    setTrigger(null);
    setItems([]);
  }, []);

  const applySelection = useCallback(() => {
    const item = items[selectedIndex];
    if (!item) return;

    if (trigger === '/') {
      setInputValue(item.insertText);
      setTrigger(null);
      setItems([]);
      return;
    }

    if (trigger === '!') {
      setInputValue(item.insertText);
      setTrigger(null);
      setItems([]);
      return;
    }

    if (trigger === '@') {
      const atIdx = inputValue.lastIndexOf('@');
      const prefix = atIdx >= 0 ? inputValue.slice(0, atIdx) : '';
      setInputValue(`${prefix}${item.insertText}`);
      setTrigger(null);
      setItems([]);
    }
  }, [items, selectedIndex, trigger, inputValue]);

  useAutocompleteKeys({
    menuOpen: menuNavigable,
    itemCount: items.length,
    selectedIndex,
    setSelectedIndex,
    onApply: applySelection,
    onClose: closeMenu,
  });

  const displayItems =
    loadingFiles && trigger === '@'
      ? [
          {
            id: 'loading',
            display: '@',
            description: 'Searching files...',
            kind: 'file' as const,
            insertText: '',
          },
        ]
      : items;

  const menuEmptyMessage = useMemo(() => {
    if (trigger === '/' && slashCommands.length === 0) return 'Loading commands...';
    return 'No matching items';
  }, [trigger, slashCommands.length]);

  const menuRows = useMemo(() => {
    if (!trigger) return 0;
    const visibleRows = Math.min(
      AUTOCOMPLETE_MAX_ROWS,
      Math.max(displayItems.length, 1),
    );
    return visibleRows + 2;
  }, [trigger, displayItems.length]);

  useEffect(() => {
    onMenuHeightChange(menuRows);
  }, [menuRows, onMenuHeightChange]);

  const handleSubmit = useCallback(
    (value: string) => {
      const text = typeof value === 'string' ? value : inputValue;
      const trimmed = text.trim();
      if (!trimmed) return;

      if (menuNavigable && trigger) {
        applySelection();
        return;
      }

      onSubmit(trimmed);
      setInputValue('');
      closeMenu();
    },
    [inputValue, menuNavigable, trigger, applySelection, onSubmit, closeMenu],
  );

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      {menuVisible && (
        <>
          <AutocompleteMenu
            items={displayItems}
            selectedIndex={selectedIndex}
            emptyMessage={menuEmptyMessage}
          />
          <text
            content="↑↓ navigate · Enter insert · Esc close"
            style={{ fg: LEMON_TOKENS.muted, marginBottom: 1 }}
          />
        </>
      )}
      <box
        title={`Lemon Code [${modeLabel(mode)}]>`}
        style={{ border: true, height: 3, width: '100%' }}
      >
        <input
          placeholder={placeholder}
          value={inputValue}
          focused
          onInput={handleInput}
          onSubmit={() => {
            handleSubmit(inputValue);
          }}
        />
      </box>
    </box>
  );
}
