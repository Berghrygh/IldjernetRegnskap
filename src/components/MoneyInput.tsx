import { useEffect, useState } from "react";
import { formatNum, parseKr } from "../domain/money";

interface Props {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

/** Text input that accepts Norwegian money input and emits a number. */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
  id,
  className,
}: Props) {
  const [text, setText] = useState(value ? formatNum(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value ? formatNum(value) : "");
  }, [value, focused]);

  return (
    <input
      id={id}
      inputMode="decimal"
      className={`input text-right num ${className ?? ""}`}
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseKr(e.target.value);
        onChange(Number.isNaN(n) ? 0 : n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseKr(text);
        if (!Number.isNaN(n)) setText(n ? formatNum(n) : "");
        else setText("");
      }}
    />
  );
}
