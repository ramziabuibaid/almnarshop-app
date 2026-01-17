'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Eye, X, Check, Search } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  enableColumnFilters?: boolean;
  enableGlobalSearch?: boolean;
  globalSearchPlaceholder?: string;
  onGlobalSearchChange?: (value: string) => void;
  globalSearchValue?: string;
  pageSize?: number;
  enableColumnVisibility?: boolean;
  className?: string;
  defaultColumnVisibility?: VisibilityState;
  storageKey?: string; // Key for localStorage to persist column visibility
  hideToolbar?: boolean; // Hide toolbar (search and column visibility) when true
  columnVisibility?: VisibilityState; // External column visibility state
  onColumnVisibilityChange?: (visibility: VisibilityState) => void; // Callback for column visibility changes
  tableRef?: React.MutableRefObject<any>; // Ref to expose table instance
  showStickyPagination?: boolean; // Show pagination as sticky when near bottom
  stickyHeaderOffset?: number; // Offset for sticky header (when page header is hidden)
}

export function DataTable<TData, TValue>({
  columns,
  data,
  enableColumnFilters = true,
  enableGlobalSearch = false,
  globalSearchPlaceholder = 'Search...',
  onGlobalSearchChange,
  globalSearchValue = '',
  pageSize = 20,
  enableColumnVisibility = true,
  className = '',
  defaultColumnVisibility = {},
  storageKey,
  hideToolbar = false,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange,
  tableRef,
  showStickyPagination = false,
  stickyHeaderOffset = 0,
}: DataTableProps<TData, TValue>) {
  // Load column visibility from localStorage on mount
  const getInitialColumnVisibility = (): VisibilityState => {
    if (typeof window === 'undefined' || !storageKey) {
      return defaultColumnVisibility;
    }
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaultColumnVisibility to include any new columns
        return { ...defaultColumnVisibility, ...parsed };
      }
    } catch (error) {
      console.error('[DataTable] Error loading column visibility from localStorage:', error);
    }
    
    return defaultColumnVisibility;
  };

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>(getInitialColumnVisibility);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  
  // Use external column visibility if provided, otherwise use internal state
  const columnVisibility = externalColumnVisibility ?? internalColumnVisibility;
  const setColumnVisibility = (visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    const newVisibility = typeof visibility === 'function' ? visibility(columnVisibility) : visibility;
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(newVisibility);
    } else {
      setInternalColumnVisibility(newVisibility);
    }
  };

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error('[DataTable] Error saving column visibility to localStorage:', error);
    }
  }, [columnVisibility, storageKey]);

  // Expose table instance via ref (need to define table first)

  // Global search filter (client-side)
  const filteredData = useMemo(() => {
    if (!enableGlobalSearch || !globalSearchValue?.trim()) {
      return data;
    }

    const searchWords = globalSearchValue
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    return data.filter((row) => {
      const rowString = JSON.stringify(row).toLowerCase();
      return searchWords.every((word) => rowString.includes(word));
    });
  }, [data, globalSearchValue, enableGlobalSearch]);

  // Apply global search to table data
  const tableData = enableGlobalSearch ? filteredData : data;

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const handleGlobalSearchChange = useCallback(
    (value: string) => {
      if (onGlobalSearchChange) {
        onGlobalSearchChange(value);
      }
    },
    [onGlobalSearchChange]
  );

  // Reset to first page when global search changes
  useEffect(() => {
    if (enableGlobalSearch) {
      table.setPageIndex(0);
    }
  }, [globalSearchValue, enableGlobalSearch, table]);

  // Expose table instance via ref
  useEffect(() => {
    if (tableRef) {
      tableRef.current = table;
    }
  }, [table, tableRef]);

  return (
    <div className={`space-y-4 ${className}`} dir="rtl">
      {/* Toolbar */}
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Global Search */}
        {enableGlobalSearch && (
          <input
            type="text"
            placeholder={globalSearchPlaceholder}
            value={globalSearchValue}
            onChange={(e) => handleGlobalSearchChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500 text-sm flex-1 min-w-[200px]"
            dir="rtl"
          />
        )}

        {/* Column Visibility Toggle */}
        {enableColumnVisibility && (
          <div className="relative">
            <button
              onClick={() => setIsColumnVisibilityOpen(!isColumnVisibilityOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <Eye size={16} />
              <span>الأعمدة / Columns</span>
              {Object.values(columnVisibility).some((v) => !v) && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                  {Object.values(columnVisibility).filter((v) => !v).length}
                </span>
              )}
            </button>

            {isColumnVisibilityOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsColumnVisibilityOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-20 p-3 max-h-96 overflow-y-auto" dir="rtl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-sm">إظهار/إخفاء الأعمدة</h3>
                    <button
                      onClick={() => setIsColumnVisibilityOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => {
                        const headerText = typeof column.columnDef.header === 'string'
                          ? column.columnDef.header
                          : column.id;
                        return (
                          <label
                            key={column.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={column.getIsVisible()}
                              onChange={(e) => column.toggleVisibility(e.target.checked)}
                              className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                            />
                            <span className="text-sm text-gray-700 flex-1">
                              {headerText}
                            </span>
                            {column.getIsVisible() && <Check size={14} className="text-gray-600" />}
                          </label>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </div>
      )}

      {/* Table Container with Sticky Header */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <React.Fragment key={headerGroup.id}>
                  {/* Header Row */}
                  <tr>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={`px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 ${
                          header.column.getCanSort()
                            ? 'cursor-pointer hover:bg-gray-100 select-none'
                            : ''
                        }`}
                        style={{ minWidth: header.column.columnDef.minSize || '100px' }}
                        onClick={(e) => {
                          // Only sort if not clicking on search icon
                          if (!(e.target as HTMLElement).closest('.search-icon-button')) {
                            header.column.getToggleSortingHandler()?.(e);
                          }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="flex flex-col">
                              {{
                                asc: <ArrowUp size={12} className="text-gray-600" />,
                                desc: <ArrowDown size={12} className="text-gray-600" />,
                              }[header.column.getIsSorted() as string] ?? (
                                <ArrowUpDown size={12} className="text-gray-400 opacity-50" />
                              )}
                            </span>
                          )}
                          {enableColumnFilters && header.column.getCanFilter() && (
                            <button
                              className="search-icon-button p-1 hover:bg-gray-200 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilterColumn(activeFilterColumn === header.id ? null : header.id);
                              }}
                              title="بحث"
                            >
                              <Search size={14} className={`text-gray-600 ${activeFilterColumn === header.id ? 'text-gray-900' : ''}`} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                  {/* Filter Row - Show only for active column */}
                  {enableColumnFilters && activeFilterColumn && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {headerGroup.headers.map((header) => (
                        <th key={`filter-${header.id}`} className="px-3 py-2 bg-gray-50">
                          {header.column.getCanFilter() && activeFilterColumn === header.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder={`بحث في ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}...`}
                                value={(header.column.getFilterValue() as string) ?? ''}
                                onChange={(e) => header.column.setFilterValue(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
                                dir="rtl"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFilterColumn(null);
                                  header.column.setFilterValue('');
                                }}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="إغلاق"
                              >
                                <X size={14} className="text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <div className="h-8" />
                          )}
                        </th>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-gray-500 text-sm"
                  >
                    لا توجد بيانات / No data
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 text-sm text-gray-900"
                        style={{ minWidth: cell.column.columnDef.minSize || '100px' }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Show sticky only when near bottom */}
        <div className={`border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between flex-wrap gap-4 ${showStickyPagination ? 'sticky bottom-0 z-10 shadow-lg' : ''}`} dir="rtl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm text-gray-900 font-medium"
            >
              <ChevronRight size={16} className="text-gray-900" />
              السابق
            </button>

            <div className="flex items-center gap-1">
              {Array.from(
                { length: Math.min(5, table.getPageCount()) },
                (_, i) => {
                  let pageNum;
                  const totalPages = table.getPageCount();
                  const currentPage = table.getState().pagination.pageIndex + 1;

                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => table.setPageIndex(pageNum - 1)}
                      className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                        currentPage === pageNum
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-300 hover:bg-gray-100 text-gray-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
            </div>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm text-gray-900 font-medium"
            >
              التالي
              <ChevronLeft size={16} className="text-gray-900" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-900 font-medium">
            <span>
              صفحة {table.getState().pagination.pageIndex + 1} من{' '}
              {table.getPageCount() || 1}
            </span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900 text-sm text-gray-900 font-medium bg-white"
              dir="rtl"
            >
              {[10, 20, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size} لكل صفحة
                </option>
              ))}
            </select>
            <span>
              إجمالي: {table.getFilteredRowModel().rows.length} صف
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}