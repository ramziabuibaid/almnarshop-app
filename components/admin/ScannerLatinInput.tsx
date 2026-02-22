'use client';

import { forwardRef, useCallback, useEffect, useRef } from 'react';
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
  // We keep a synchronous ref of what we consider the "true" value
  // to avoid stale closures during rapid scanner typing.
  const internalValue = useRef(typeof value === 'string' ? value : '');

  // Sync prop to ref if parent changes it
  useEffect(() => {
    internalValue.current = typeof value === 'string' ? value : '';
  }, [value]);

  const updateValueAndNotify = useCallback(
    (inputElement: HTMLInputElement, nativeEvent: Event, newValue: string, cursor: number) => {
      internalValue.current = newValue;
      inputElement.value = newValue; // Force native DOM update
      inputElement.setSelectionRange(cursor, cursor);

      // Since React expects a ChangeEvent, we construct a synthetic event
      // that looks just like what React would produce natively.
      const syntheticEvent = {
        ...nativeEvent,
        nativeEvent,
        target: inputElement,
        currentTarget: inputElement,
        type: 'change',
        bubbles: true,
        cancelable: false,
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => { },
        preventDefault: () => { },
        stopPropagation: () => { },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      onChange?.(syntheticEvent);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const ch = getLatinCharFromKeyEvent(e.nativeEvent);
      if (ch === null) {
        onKeyDown?.(e);
        return;
      }

      if (ch === SCANNER_KEY.ENTER) {
        onKeyDown?.(e);
        return;
      }

      e.preventDefault();

      const el = e.currentTarget;
      const currentVal = internalValue.current;
      const start = el.selectionStart ?? currentVal.length;
      const end = el.selectionEnd ?? currentVal.length;

      if (ch === SCANNER_KEY.BACKSPACE) {
        if (start === end) {
          if (start === 0) {
            onKeyDown?.(e);
            return;
          }
          const newVal = currentVal.slice(0, start - 1) + currentVal.slice(end);
          updateValueAndNotify(el, e.nativeEvent, newVal, start - 1);
        } else {
          const newVal = currentVal.slice(0, start) + currentVal.slice(end);
          updateValueAndNotify(el, e.nativeEvent, newVal, start);
        }
      } else {
        const newVal = currentVal.slice(0, start) + ch + currentVal.slice(end);
        updateValueAndNotify(el, e.nativeEvent, newVal, start + ch.length);
      }

      onKeyDown?.(e);
    },
    [onKeyDown, updateValueAndNotify]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') ?? '').trim();
      const normalized = normalizeBarcodeInput(pasted);
      const el = e.currentTarget;

      const currentVal = internalValue.current;
      const start = el.selectionStart ?? currentVal.length;
      const end = el.selectionEnd ?? currentVal.length;

      const newVal = currentVal.slice(0, start) + normalized + currentVal.slice(end);
      updateValueAndNotify(el, e.nativeEvent as unknown as Event, newVal, start + normalized.length);

      onPaste?.(e);
    },
    [onPaste, updateValueAndNotify]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // If the browser (via IME/dead keys like 'لأ') bypassed e.preventDefault()
      // in keydown, or inserted Arabic junk natively, e.target.value will NOT
      // match our internalValue. In that case, we REVERT it.
      // We do not normalize here because handleKeyDown already handled the physical key.

      if (e.target.value !== internalValue.current) {
        e.target.value = internalValue.current;
        const cursor = e.target.selectionStart || internalValue.current.length;
        e.target.setSelectionRange(cursor, cursor);
        // Do NOT call onChange! The garbage was suppressed.
      } else {
        onChange?.(e);
      }
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
