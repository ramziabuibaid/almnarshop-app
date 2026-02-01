'use client';

import { forwardRef, useCallback } from 'react';
import { getLatinCharFromKeyEvent, normalizeBarcodeInput, SCANNER_KEY } from '@/lib/barcodeScannerLatin';

type ScannerLatinInputProps = React.ComponentPropsWithoutRef<'input'>;

/**
 * Input that forces Latin (English) output for barcode/serial scanners (e.g. ZKB)
 * when system keyboard is Arabic (Mac/Windows). Uses physical key codes so
 * scanner output is always English.
 */
const ScannerLatinInput = forwardRef<HTMLInputElement, ScannerLatinInputProps>(function ScannerLatinInput({
  value = '',
  onChange,
  onKeyDown,
  onPaste,
  ...rest
}, ref) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const ch = getLatinCharFromKeyEvent(e.nativeEvent);
      if (ch === null) {
        onKeyDown?.(e);
        return;
      }
      if (ch === SCANNER_KEY.ENTER) {
        e.preventDefault();
        onKeyDown?.(e);
        return;
      }
      if (ch === SCANNER_KEY.BACKSPACE) {
        e.preventDefault();
        const str = typeof value === 'string' ? value : '';
        onChange?.({ target: { ...e.currentTarget, value: str.slice(0, -1) } } as React.ChangeEvent<HTMLInputElement>);
        onKeyDown?.(e);
        return;
      }
      e.preventDefault();
      const str = typeof value === 'string' ? value : '';
      onChange?.({ target: { ...e.currentTarget, value: str + ch } } as React.ChangeEvent<HTMLInputElement>);
      onKeyDown?.(e);
    },
    [value, onChange, onKeyDown]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') ?? '').trim();
      const normalized = normalizeBarcodeInput(pasted);
      const str = typeof value === 'string' ? value : '';
      onChange?.({ target: { ...e.currentTarget, value: str + normalized } } as React.ChangeEvent<HTMLInputElement>);
      onPaste?.(e);
    },
    [value, onChange, onPaste]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const normalized = normalizeBarcodeInput(e.target.value);
      if (normalized !== e.target.value) {
        e.target.value = normalized;
      }
      onChange?.(e);
    },
    [onChange]
  );

  return (
    <input
      ref={ref}
      {...rest}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      dir="ltr"
      lang="en"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
});

export default ScannerLatinInput;
