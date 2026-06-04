import { useKeyboard } from '@opentui/react';
import { useCallback } from 'react';

export function useAutocompleteKeys(options: {
  menuOpen: boolean;
  itemCount: number;
  selectedIndex: number;
  setSelectedIndex: (fn: (i: number) => number) => void;
  onApply: () => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const { menuOpen, itemCount, setSelectedIndex, onApply, onClose, disabled } = options;

  const move = useCallback(
    (delta: number) => {
      if (itemCount === 0) return;
      setSelectedIndex((i) => (i + delta + itemCount) % itemCount);
    },
    [itemCount, setSelectedIndex],
  );

  useKeyboard((key) => {
    if (disabled || !menuOpen) return;

    if (key.name === 'escape') {
      onClose();
      return;
    }

    if (key.name === 'up') {
      move(-1);
      return;
    }

    if (key.name === 'down') {
      move(1);
      return;
    }

    if (key.name === 'tab' || key.name === 'return') {
      onApply();
    }
  });
}
