'use client';

import { useMemo, useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Search } from 'lucide-react';
import type { Product } from '@/types';

export type ProductAttributeFilters = {
  type: string | null;
  size: string | null;
  brand: string | null;
  color: string | null;
};

type AttributeKey = keyof ProductAttributeFilters;

const LABELS: Record<AttributeKey, string> = {
  type: 'النوع',
  size: 'الحجم',
  brand: 'العلامة التجارية',
  color: 'اللون',
};

/** ترتيب العرض: النوع ← العلامة ← الحجم ← اللون */
const KEYS_ORDER: AttributeKey[] = ['type', 'brand', 'size', 'color'];

const SEARCHABLE_KEYS = new Set<AttributeKey>(['type', 'brand']);

function getType(p: Product): string {
  return String(p.type || p.Type || '').trim();
}
function getBrand(p: Product): string {
  return String(p.brand || p.Brand || '').trim();
}
function getSize(p: Product): string {
  return String(p.size || p.Size || '').trim();
}
function getColor(p: Product): string {
  return String(p.color || p.Color || '').trim();
}

/**
 * منتجات مطابقة لكل التصفيات المحددة ما عدا الحقل `key` نفسه
 * (كل الفلاتر تؤثر على بعضها: مثلاً النوع يُضيّق بعلامة/حجم/لون محددين إن وُجدوا).
 */
function productsInScopeForKey(all: Product[], key: AttributeKey, f: ProductAttributeFilters): Product[] {
  return all.filter((p) => {
    if (key !== 'type' && f.type && getType(p) !== f.type) return false;
    if (key !== 'brand' && f.brand && getBrand(p) !== f.brand) return false;
    if (key !== 'size' && f.size && getSize(p) !== f.size) return false;
    if (key !== 'color' && f.color && getColor(p) !== f.color) return false;
    return true;
  });
}

function collectUnique(products: Product[], read: (p: Product) => string): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const v = read(p).trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
}

/** يحافظ على القيمة المختارة في القائمة حتى لو أصبحت خارج النطاق بعد تغيير تصفية أعلى */
function collectUniqueScoped(
  scoped: Product[],
  read: (p: Product) => string,
  selectedForThisKey: string | null
): string[] {
  const arr = collectUnique(scoped, read);
  if (selectedForThisKey && !arr.includes(selectedForThisKey)) {
    return [...arr, selectedForThisKey].sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
  }
  return arr;
}

function optionMatchesQuery(option: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return option.toLowerCase().includes(q);
}

type MenuPos = { top: number; right: number; minWidth: number };

type OpenMenuState = { key: AttributeKey; pos: MenuPos };

type Props = {
  products: Product[];
  filters: ProductAttributeFilters;
  onChange: (next: ProductAttributeFilters) => void;
};

function measureTrigger(el: HTMLButtonElement): MenuPos {
  const r = el.getBoundingClientRect();
  return {
    top: r.bottom + 6,
    right: window.innerWidth - r.right,
    minWidth: Math.max(200, r.width),
  };
}

export default function ProductAttributePillFilters({ products, filters, onChange }: Props) {
  const [openMenu, setOpenMenu] = useState<OpenMenuState | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const triggerRefs = useRef<Partial<Record<AttributeKey, HTMLButtonElement | null>>>({});
  const listSearchInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(
    () => ({
      type: collectUniqueScoped(productsInScopeForKey(products, 'type', filters), (p) => String(p.type || p.Type || ''), filters.type),
      brand: collectUniqueScoped(productsInScopeForKey(products, 'brand', filters), (p) => String(p.brand || p.Brand || ''), filters.brand),
      size: collectUniqueScoped(productsInScopeForKey(products, 'size', filters), (p) => String(p.size || p.Size || ''), filters.size),
      color: collectUniqueScoped(productsInScopeForKey(products, 'color', filters), (p) => String(p.color || p.Color || ''), filters.color),
    }),
    [products, filters.type, filters.brand, filters.size, filters.color]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setListSearch('');
  }, [openMenu?.key]);

  const repositionOpenMenu = useCallback(() => {
    setOpenMenu((prev) => {
      if (!prev) return prev;
      const el = triggerRefs.current[prev.key];
      if (!el) return prev;
      return { key: prev.key, pos: measureTrigger(el) };
    });
  }, []);

  useLayoutEffect(() => {
    if (!openMenu) return;
    repositionOpenMenu();
    window.addEventListener('scroll', repositionOpenMenu, true);
    window.addEventListener('resize', repositionOpenMenu);
    return () => {
      window.removeEventListener('scroll', repositionOpenMenu, true);
      window.removeEventListener('resize', repositionOpenMenu);
    };
  }, [openMenu?.key, repositionOpenMenu]);

  useLayoutEffect(() => {
    if (openMenu && SEARCHABLE_KEYS.has(openMenu.key)) {
      listSearchInputRef.current?.focus();
    }
  }, [openMenu?.key]);

  const hasActive = !!(filters.type || filters.brand || filters.size || filters.color);

  const setField = useCallback(
    (key: AttributeKey, value: string | null) => {
      onChange({ ...filters, [key]: value });
      setOpenMenu(null);
    },
    [filters, onChange]
  );

  const clearAll = useCallback(() => {
    onChange({ type: null, size: null, brand: null, color: null });
    setOpenMenu(null);
  }, [onChange]);

  const openOpts = openMenu ? options[openMenu.key] : [];
  const openValue = openMenu ? filters[openMenu.key] : null;
  const isSearchableOpen = openMenu ? SEARCHABLE_KEYS.has(openMenu.key) : false;

  const filteredOpts = useMemo(() => {
    if (!openMenu) return [];
    if (!SEARCHABLE_KEYS.has(openMenu.key)) return openOpts;
    return openOpts.filter((o) => optionMatchesQuery(o, listSearch));
  }, [openMenu, openOpts, listSearch]);

  const portal =
    mounted && openMenu && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[220] bg-transparent" aria-hidden onClick={() => setOpenMenu(null)} />
            <div
              role="listbox"
              dir="rtl"
              className="fixed z-[230] flex max-h-[min(22rem,calc(100vh-6rem))] min-w-[200px] max-w-[min(100vw-1.5rem,320px)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
              style={{
                top: openMenu.pos.top,
                right: openMenu.pos.right,
                minWidth: Math.max(openMenu.pos.minWidth, isSearchableOpen ? 260 : 200),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isSearchableOpen ? (
                <div className="shrink-0 border-b border-gray-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                      strokeWidth={2}
                    />
                    <input
                      ref={listSearchInputRef}
                      type="search"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      placeholder="ابحث في القائمة..."
                      className="w-full rounded-md border border-gray-300 bg-white py-2 pr-9 pl-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-gray-400"
                      dir="rtl"
                      autoComplete="off"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {openOpts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">لا توجد قيم في القائمة</div>
                ) : filteredOpts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">لا توجد نتائج للبحث</div>
                ) : (
                  <ul className="py-0">
                    {filteredOpts.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={openValue === opt}
                          onClick={() => openMenu && setField(openMenu.key, opt)}
                          className={`flex w-full items-center px-3 py-2 text-right text-sm hover:bg-gray-100 dark:hover:bg-slate-700/80 ${
                            openValue === opt
                              ? 'bg-violet-50 font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-100'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <span className="truncate" title={opt}>
                            {opt}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="w-full min-w-0" dir="rtl">
      {portal}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
          {KEYS_ORDER.map((key) => {
            const value = filters[key];
            const isOpen = openMenu?.key === key;
            const label = LABELS[key];

            return (
              <div key={key} className="relative shrink-0">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    value
                      ? 'border-violet-500/55 bg-violet-50 text-violet-900 dark:border-violet-400/45 dark:bg-violet-950/35 dark:text-violet-100'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-slate-600 dark:bg-slate-800/80 dark:text-gray-200 dark:hover:border-slate-500'
                  }`}
                >
                  <button
                    ref={(el) => {
                      triggerRefs.current[key] = el;
                    }}
                    type="button"
                    onClick={() => {
                      if (isOpen) {
                        setOpenMenu(null);
                        return;
                      }
                      if (typeof window === 'undefined') return;
                      const el = triggerRefs.current[key];
                      if (!el) return;
                      setOpenMenu({ key, pos: measureTrigger(el) });
                    }}
                    className="inline-flex max-w-[220px] items-center gap-1.5"
                  >
                    <span className="whitespace-nowrap">{label}</span>
                    {value ? (
                      <>
                        <span className="text-gray-400 dark:text-violet-300/80">|</span>
                        <span className="truncate" title={value}>
                          {value}
                        </span>
                      </>
                    ) : (
                      <Plus className="pointer-events-none h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2.5} />
                    )}
                  </button>
                  {value ? (
                    <button
                      type="button"
                      onClick={() => setField(key, null)}
                      className="shrink-0 rounded-full p-0.5 hover:bg-violet-200/80 dark:hover:bg-violet-800/60"
                      aria-label={`إزالة تصفية ${label}`}
                    >
                      <X className="pointer-events-none h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
                {isOpen ? <span className="sr-only">قائمة {label} مفتوحة</span> : null}
              </div>
            );
          })}
        </div>

        {hasActive ? (
          <button type="button" onClick={clearAll} className="shrink-0 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
            مسح التصفية
          </button>
        ) : null}
      </div>
    </div>
  );
}
