import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export type DateRange = { from: string; to: string };

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => new Date(s + 'T00:00:00');
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function presets(): { key: string; label: string; range: () => DateRange }[] {
  const today = new Date();
  return [
    { key: 'today', label: '오늘', range: () => ({ from: toISO(today), to: toISO(today) }) },
    { key: 'yesterday', label: '어제', range: () => { const y = addDays(today, -1); return { from: toISO(y), to: toISO(y) }; } },
    { key: '7d', label: '최근 7일', range: () => ({ from: toISO(addDays(today, -6)), to: toISO(today) }) },
    { key: '30d', label: '최근 30일', range: () => ({ from: toISO(addDays(today, -29)), to: toISO(today) }) },
    { key: 'this_month', label: '이번 달', range: () => ({ from: toISO(startOfMonth(today)), to: toISO(today) }) },
  ];
}

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [pickingFrom, setPickingFrom] = useState(true);
  const [viewDate, setViewDate] = useState(() => fromISO(value.to || value.from));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function openPicker() {
    setDraft(value);
    setPickingFrom(true);
    setViewDate(fromISO(value.to || value.from));
    setOpen(true);
  }

  function pickDay(iso: string) {
    if (pickingFrom) {
      setDraft({ from: iso, to: iso });
      setPickingFrom(false);
    } else if (iso < draft.from) {
      setDraft({ from: iso, to: draft.from });
      setPickingFrom(true);
    } else {
      setDraft({ ...draft, to: iso });
      setPickingFrom(true);
    }
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(year, month, i + 1)))];

  const label = value.from === value.to ? value.from : `${value.from} ~ ${value.to}`;

  return (
    <div className="dr-picker" ref={rootRef}>
      <button className="dr-trigger" onClick={openPicker}>
        <CalendarIcon size={14} />
        {label}
      </button>
      {open && (
        <div className="dr-popover">
          <div className="dr-presets">
            {presets().map((p) => (
              <button key={p.key} onClick={() => { const r = p.range(); setDraft(r); onChange(r); setOpen(false); }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="dr-cal">
            <div className="dr-cal-head">
              <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={14} /></button>
              <span>{year}년 {month + 1}월</span>
              <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={14} /></button>
            </div>
            <div className="dr-cal-grid">
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div className="dr-cal-dow" key={w}>{w}</div>
              ))}
              {cells.map((iso, i) => {
                if (!iso) return <div key={i} />;
                const isStart = iso === draft.from;
                const isEnd = iso === draft.to;
                const inRange = iso > draft.from && iso < draft.to;
                const single = isStart && isEnd;
                let cls = 'dr-cal-day';
                if (single) cls += ' single';
                else if (isStart) cls += ' range-start';
                else if (isEnd) cls += ' range-end';
                else if (inRange) cls += ' in-range';
                return (
                  <button key={iso} className={cls} onClick={() => pickDay(iso)}>
                    {Number(iso.slice(8, 10))}
                  </button>
                );
              })}
            </div>
            <div className="dr-footer">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>취소</button>
              <button className="btn btn-primary" onClick={apply}>적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
