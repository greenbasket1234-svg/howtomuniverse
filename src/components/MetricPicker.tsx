import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export function MetricPicker({
  options,
  selected,
  onChange,
}: {
  options: { key: number; label: string }[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(key: number) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <div className="dr-picker" ref={rootRef}>
      <button className="dr-trigger" onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal size={14} />
        지표 선택 ({selected.size}/{options.length})
      </button>
      {open && (
        <div className="metric-popover">
          <div className="metric-popover-actions">
            <button onClick={() => onChange(new Set(options.map((o) => o.key)))}>전체 선택</button>
            <button onClick={() => onChange(new Set())}>전체 해제</button>
          </div>
          {options.map((o) => (
            <label className="metric-check-row" key={o.key}>
              <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
