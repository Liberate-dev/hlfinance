import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import {
  formatNumberInput,
  isAllowedNominalKey,
  parseNumberInput,
  sanitizeToDigits,
} from '../../lib/numberInput';

interface NominalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number;
  onChange: (value: number) => void;
}

export default function NominalInput({
  value,
  onChange,
  onKeyDown,
  onPaste,
  onDrop,
  onBeforeInput,
  onFocus,
  onBlur,
  onWheel,
  className,
  ...rest
}: NominalInputProps) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(formatNumberInput(value));
    }
  }, [value]);

  const applyDigits = (raw: string) => {
    const digits = sanitizeToDigits(raw);
    const num = parseNumberInput(digits);
    setText(digits === '' ? '' : formatNumberInput(num));
    onChange(num);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className={['nominal-input', className].filter(Boolean).join(' ')}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(formatNumberInput(value));
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (!isAllowedNominalKey(e)) {
          e.preventDefault();
          return;
        }
        onKeyDown?.(e);
      }}
      onBeforeInput={(e) => {
        const data = (e.nativeEvent as InputEvent).data;
        if (data != null && !/^\d$/.test(data)) {
          e.preventDefault();
          return;
        }
        onBeforeInput?.(e);
      }}
      onPaste={(e) => {
        e.preventDefault();
        applyDigits(e.clipboardData.getData('text'));
        onPaste?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        applyDigits(e.dataTransfer.getData('text'));
      }}
      onWheel={(e) => {
        if (document.activeElement === e.currentTarget) {
          e.preventDefault();
        }
        onWheel?.(e);
      }}
      onChange={(e) => applyDigits(e.target.value)}
    />
  );
}