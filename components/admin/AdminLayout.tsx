'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useShop } from '@/context/ShopContext';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Store,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Wrench,
  Wallet,
  Shield,
  Tag,
  Megaphone
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';

interface AdminLayoutProps {
  children: ReactNode;
}

/** Sidebar accent: thin border + subtle active bg for compact professional look */
/** Light sidebar — active: blue bg, hover: subtle gray (ResearchCollab-inspired) */
const ACCENT_STYLES: Record<string, { border: string; borderMuted: string; activeBg: string; activeText?: string }> = {
  slate:   { border: 'border-s-slate-500',   borderMuted: 'border-s-transparent',   activeBg: 'bg-slate-100' },
  indigo:  { border: 'border-s-indigo-500',  borderMuted: 'border-s-transparent',  activeBg: 'bg-indigo-50', activeText: 'text-indigo-700' },
  violet:  { border: 'border-s-violet-500',  borderMuted: 'border-s-transparent',  activeBg: 'bg-violet-50' },
  emerald: { border: 'border-s-emerald-500', borderMuted: 'border-s-transparent', activeBg: 'bg-emerald-50' },
  teal:    { border: 'border-s-teal-500',    borderMuted: 'border-s-transparent',   activeBg: 'bg-teal-50' },
  cyan:    { border: 'border-s-cyan-500',    borderMuted: 'border-s-transparent',   activeBg: 'bg-cyan-50' },
  blue:    { border: 'border-s-blue-500',    borderMuted: 'border-s-transparent',   activeBg: 'bg-blue-50', activeText: 'text-blue-700' },
  amber:   { border: 'border-s-amber-500',   borderMuted: 'border-s-transparent',   activeBg: 'bg-amber-50' },
  rose:    { border: 'border-s-rose-500',   borderMuted: 'border-s-transparent',    activeBg: 'bg-rose-50' },
  green:   { border: 'border-s-green-500',   borderMuted: 'border-s-transparent',   activeBg: 'bg-green-50' },
  orange:  { border: 'border-s-orange-500',  borderMuted: 'border-s-transparent',  activeBg: 'bg-orange-50' },
  fuchsia: { border: 'border-s-fuchsia-500', borderMuted: 'border-s-transparent', activeBg: 'bg-fuchsia-50' },
  sky:     { border: 'border-s-sky-500',     borderMuted: 'border-s-transparent',   activeBg: 'bg-sky-50' },
  neutral: { border: 'border-s-gray-500',    borderMuted: 'border-s-transparent',   activeBg: 'bg-gray-100' },
  red:     { border: 'border-s-red-500',    borderMuted: 'border-s-transparent',   activeBg: 'bg-red-50' },
};

/** Submenu shown on hover under "المنتجات" */
const productsSubmenu = [
  { href: '/admin/marketing/campaigns', label: 'العروض الترويجية', icon: Megaphone },
  { href: '/admin/labels', label: 'طباعة الملصقات', icon: Tag },
  { href: '/admin/serial-numbers', label: 'الأرقام التسلسلية', icon: Package },
];

/** Submenu under "نقطة البيع" - items may require permission */
const posSubmenu = [
  { href: '/admin/invoices', label: 'قائمة الفواتير النقدية', icon: FileText, permission: 'viewCashInvoices' as const },
];

/** Submenu under "الفواتير": فواتير المحل، فواتير المخزن، عرض سعر، طلبيات اون لاين */
const invoicesSubmenu = [
  { href: '/admin/shop-sales', label: 'فواتير المحل', icon: FileText, permission: 'accessShopInvoices' as const },
  { href: '/admin/warehouse-sales', label: 'فواتير المخزن', icon: FileText, permission: 'accessWarehouseInvoices' as const },
  { href: '/admin/quotations', label: 'عرض سعر', icon: FileText, permission: 'accessQuotations' as const },
  { href: '/admin/orders', label: 'طلبيات اون لاين', icon: ShoppingBag },
];

/** Submenu under "الزبائن": المهام والمتابعات، الشيكات الراجعة */
const customersSubmenu = [
  { href: '/admin/tasks', label: 'المهام والمتابعات', icon: ClipboardList, permission: 'viewTasks' as const },
  { href: '/admin/checks', label: 'الشيكات الراجعة', icon: FileText, permission: 'accessChecks' as const },
];

const sidebarLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, accent: 'indigo' as const, section: 'main' as const },
  { href: '/admin/products', label: 'المنتجات', icon: Package, accent: 'emerald' as const, hasSubmenu: true as const, section: 'ops' as const },
  { href: '/admin/pos', label: 'نقطة البيع (POS)', icon: CreditCard, accent: 'green' as const, hasSubmenu: true as const, section: 'ops' as const },
  { href: '/admin/shop-sales', label: 'الفواتير', icon: FileText, accent: 'blue' as const, hasSubmenu: true as const, section: 'ops' as const },
  { href: '/admin/shop-finance/cash-box', label: 'صندوق المحل', icon: Wallet, accent: 'green' as const, section: 'finance' as const },
  { href: '/admin/warehouse-finance/cash-box', label: 'صندوق المستودع', icon: Wallet, accent: 'teal' as const, section: 'finance' as const },
  { href: '/admin/maintenance', label: 'الصيانة', icon: Wrench, accent: 'amber' as const, section: 'admin' as const },
  { href: '/admin/customers', label: 'الزبائن', icon: Users, accent: 'indigo' as const, hasSubmenu: true as const, section: 'admin' as const },
];

const SECTION_LABELS: Record<string, string> = {
  main: 'الرئيسية',
  ops: 'المبيعات والمخزون',
  finance: 'المالية',
  admin: 'الإدارة',
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { logout } = useShop();
  const { admin, loading: adminLoading, logoutAdmin } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productsSubmenuOpen, setProductsSubmenuOpen] = useState(false);
  const [posSubmenuOpen, setPosSubmenuOpen] = useState(false);
  const [invoicesSubmenuOpen, setInvoicesSubmenuOpen] = useState(false);
  const [customersSubmenuOpen, setCustomersSubmenuOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!admin && !adminLoading) {
      router.push('/admin/login');
    }
  }, [admin, adminLoading, router]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-700">Checking admin session...</div>
      </div>
    );
  }

  if (!admin) return null;

  const handleLogout = async () => {
    await logoutAdmin();
    logout();
    router.push('/admin/login');
  };

  // Swipe gesture handlers for mobile
  const minSwipeDistance = 50;
  const edgeThreshold = 30; // Distance from edge to trigger swipe

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // In RTL mode, sidebar is on the right side (visually on the left)
    // Swipe from right edge to left (opening sidebar)
    // clientX: 0 is left edge, window.innerWidth is right edge
    // So right edge = high clientX value
    if (isLeftSwipe && !sidebarOpen) {
      // Check if swipe started from the right edge (where sidebar is)
      if (touchStartX.current > window.innerWidth - edgeThreshold) {
        setSidebarOpen(true);
      }
    }
    
    // Swipe from left to right (closing sidebar) - swipe anywhere on the sidebar
    if (isRightSwipe && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 bg-black/50 z-[60] ${pathname === '/admin/pos' ? 'lg:block' : 'md:hidden'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — light, professional (Almnar System / ResearchCollab-inspired) */}
      <aside
        className={`fixed top-0 right-0 h-full w-56 bg-white text-gray-800 z-[70] transform transition-transform duration-300 shadow-xl border-l border-gray-200 ${
          pathname === '/admin/pos' 
            ? (sidebarOpen ? 'translate-x-0' : 'translate-x-full')
            : (sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0')
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header — Almnar System */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0 bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Store size={18} className="text-white" />
              </div>
              <h1 className="text-base font-bold text-indigo-600 tracking-tight font-cairo">Almnar System</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-700 transition-colors ${pathname === '/admin/pos' ? 'lg:block' : 'md:hidden'}`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation — section headers + links */}
          <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden flex flex-col" dir="rtl">
            <div className="flex-1 space-y-0.5">
              {sidebarLinks.map((link, idx) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                const showSection = link.section && (idx === 0 || sidebarLinks[idx - 1]?.section !== link.section);
                const sectionHeader = showSection && link.section ? (
                  <div className="pt-2 pb-1 first:pt-0" key={`sec-${link.section}`}>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{SECTION_LABELS[link.section]}</span>
                  </div>
                ) : null;
                const isProductsWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/products';
                const isPosWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/pos';
                const isInvoicesWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/shop-sales';
                const isCustomersWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/customers';

                // صلاحيات الروابط الرئيسية (نفس السلوك قبل دمج القوائم المنسدلة)
                // POS: createPOS | صندوق المحل: accessShopCashBox | صندوق المستودع: accessWarehouseCashBox
                // الفواتير: يظهر إذا كان لديه وصول لواحد على الأقل من (فواتير المحل/المخزن/عرض سعر/طلبيات)
                // الزبائن: يظهر للجميع؛ العناصر الفرعية (المهام، الشيكات) تُصفّى حسب viewTasks و accessChecks
                // المنتجات: يظهر للجميع؛ لا صلاحيات للعناصر الفرعية (عروض ترويجية، ملصقات، أرقام تسلسلية)
                if (link.href === '/admin/pos') {
                  const canCreatePOS = admin.is_super_admin || admin.permissions?.createPOS === true;
                  if (!canCreatePOS) {
                    return null;
                  }
                }
                
                if (link.href === '/admin/receipts') {
                  const canAccessReceipts = admin.is_super_admin || admin.permissions?.accessReceipts === true;
                  if (!canAccessReceipts) {
                    return null;
                  }
                }
                
                if (link.href === '/admin/payments') {
                  const canAccessPayPage = admin.is_super_admin || admin.permissions?.accessPayPage === true;
                  if (!canAccessPayPage) {
                    return null;
                  }
                }
                
                if (link.href === '/admin/shop-finance/cash-box') {
                  const canAccessShopCashBox = admin.is_super_admin || admin.permissions?.accessShopCashBox === true;
                  if (!canAccessShopCashBox) {
                    return null;
                  }
                }
                
                if (link.href === '/admin/warehouse-finance/cash-box') {
                  const canAccessWarehouseCashBox = admin.is_super_admin || admin.permissions?.accessWarehouseCashBox === true;
                  if (!canAccessWarehouseCashBox) {
                    return null;
                  }
                }
                
                const styles = ACCENT_STYLES[link.accent] ?? ACCENT_STYLES.neutral;
                const borderClass = isActive ? styles.border : styles.borderMuted;

                // Products: قائمة منبثقة واضحة — سهم يدل على التبعيات، تبعيات مضمنة مع خط ربط
                if (isProductsWithSubmenu) {
                  const submenuActive = pathname?.startsWith('/admin/marketing') || pathname?.startsWith('/admin/labels') || pathname?.startsWith('/admin/serial-numbers');
                  const styles = ACCENT_STYLES[link.accent] ?? ACCENT_STYLES.neutral;
                  const borderClass = (isActive || submenuActive) ? styles.border : styles.borderMuted;
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${borderClass} ${
                            isActive || submenuActive
                              ? `${styles.activeBg} ${styles.activeText || 'text-gray-900'} font-medium`
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProductsSubmenuOpen((v) => !v);
                          }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label={productsSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${productsSubmenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {productsSubmenuOpen && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
                          {productsSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setProductsSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                  subActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // نقطة البيع: قائمة منبثقة مع سهم وتبعيات مضمنة
                if (isPosWithSubmenu) {
                  const canViewCashInvoices = admin.is_super_admin || admin.permissions?.viewCashInvoices === true;
                  const filteredPosSubmenu = posSubmenu.filter((s) => (s.permission ? (s.permission === 'viewCashInvoices' && canViewCashInvoices) : true));
                  const submenuActive = pathname?.startsWith('/admin/invoices');
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${(isActive || submenuActive) ? styles.border : styles.borderMuted} ${
                            isActive || submenuActive
                              ? `${styles.activeBg} ${styles.activeText || 'text-gray-900'} font-medium`
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        {filteredPosSubmenu.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPosSubmenuOpen((v) => !v);
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label={posSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                          >
                            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${posSubmenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {posSubmenuOpen && filteredPosSubmenu.length > 0 && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
                          {filteredPosSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setPosSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                  subActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // الفواتير: قائمة منبثقة مع سهم وتبعيات مضمنة
                if (isInvoicesWithSubmenu) {
                  const hasPerm = (p: string) => admin.is_super_admin || (admin.permissions as Record<string, boolean>)?.[p] === true;
                  const filteredInvoicesSubmenu = invoicesSubmenu.filter((s) => !('permission' in s && s.permission) || hasPerm(s.permission));
                  if (filteredInvoicesSubmenu.length === 0) return null;
                  const invoicesSubmenuActive = pathname?.startsWith('/admin/shop-sales') || pathname?.startsWith('/admin/warehouse-sales') || pathname?.startsWith('/admin/quotations') || pathname?.startsWith('/admin/orders');
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${(isActive || invoicesSubmenuActive) ? styles.border : styles.borderMuted} ${
                            isActive || invoicesSubmenuActive
                              ? `${styles.activeBg} ${styles.activeText || 'text-gray-900'} font-medium`
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setInvoicesSubmenuOpen((v) => !v);
                          }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label={invoicesSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${invoicesSubmenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {invoicesSubmenuOpen && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
                          {filteredInvoicesSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setInvoicesSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                  subActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // الزبائن: قائمة منبثقة مع سهم وتبعيات مضمنة
                if (isCustomersWithSubmenu) {
                  const hasPerm = (p: string) => admin.is_super_admin || (admin.permissions as Record<string, boolean>)?.[p] === true;
                  const filteredCustomersSubmenu = customersSubmenu.filter((s) => !('permission' in s && s.permission) || hasPerm(s.permission));
                  const customersSubmenuActive = pathname?.startsWith('/admin/tasks') || pathname?.startsWith('/admin/checks');
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${(isActive || customersSubmenuActive) ? styles.border : styles.borderMuted} ${
                            isActive || customersSubmenuActive
                              ? `${styles.activeBg} ${styles.activeText || 'text-gray-900'} font-medium`
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        {filteredCustomersSubmenu.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCustomersSubmenuOpen((v) => !v);
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label={customersSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                          >
                            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${customersSubmenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {customersSubmenuOpen && filteredCustomersSubmenu.length > 0 && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
                          {filteredCustomersSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setCustomersSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                  subActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={link.href} className="space-y-0.5">
                    {sectionHeader}
                  <a
                    href={link.href}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) return;
                      e.preventDefault();
                      router.push(link.href);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${isActive ? styles.border : styles.borderMuted} ${
                      isActive
                        ? `${styles.activeBg} ${styles.activeText || 'text-gray-900'} font-medium`
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="font-cairo truncate">{link.label}</span>
                  </a>
                  </div>
                );
              })}
              {admin.is_super_admin && (() => {
                const styles = ACCENT_STYLES.amber;
                const isActive = pathname === '/admin/admin-users';
                const borderClass = isActive ? styles.border : styles.borderMuted;
                return (
                  <div className="space-y-0.5">
                    <div className="pt-2 pb-1">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">النظام</span>
                    </div>
                  <a
                    href="/admin/admin-users"
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) return;
                      e.preventDefault();
                      router.push('/admin/admin-users');
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${borderClass} ${
                      isActive ? `${styles.activeBg} ${styles.activeText || 'text-gray-900'} font-medium` : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Shield size={18} className="shrink-0" />
                    <span className="font-cairo truncate">Admin Users</span>
                  </a>
                  </div>
                );
              })()}
            </div>

            {/* Footer: الذهاب الى المتجر + Logout — مفصولان عن القائمة */}
            <div className="mt-auto pt-3 border-t border-gray-200 space-y-0.5">
              {(() => {
                const styles = ACCENT_STYLES.neutral;
                return (
                  <a
                    href="/"
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        window.open('/', '_blank', 'noopener,noreferrer');
                        setSidebarOpen(false);
                        return;
                      }
                      e.preventDefault();
                      router.push('/');
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${styles.borderMuted} text-gray-700 hover:bg-gray-100 text-right`}
                  >
                    <Store size={18} className="shrink-0" />
                    <span className="font-cairo truncate">الذهاب الى المتجر</span>
                  </a>
                );
              })()}
              {(() => {
                const styles = ACCENT_STYLES.red;
                return (
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${styles.borderMuted} text-gray-700 hover:bg-red-50 hover:text-red-700 text-right`}
                  >
                    <LogOut size={18} className="shrink-0" />
                    <span className="font-cairo truncate">Logout</span>
                  </button>
                );
              })()}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className={pathname === '/admin/pos' ? '' : 'md:mr-56'}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm ${pathname === '/admin/pos' ? '' : ''}`} dir="rtl">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Right side (visually left in RTL): Notifications and Menu button on Mobile, Notifications on Desktop */}
            <div className="flex items-center gap-3">
              {/* Mobile: Notifications and Menu */}
              <div className="flex items-center gap-2 md:hidden">
                <NotificationCenter />
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu size={24} className="text-gray-700" />
                </button>
              </div>
              
              {/* Desktop: Notifications and Menu (for POS page) */}
              {pathname === '/admin/pos' ? (
                <div className="hidden lg:flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700 font-cairo">نظام نقطة البيع POS</span>
                  <NotificationCenter />
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Menu size={24} className="text-gray-700" />
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <NotificationCenter />
                </div>
              )}
            </div>
            
            {/* Desktop: Admin name in center */}
            <div className="hidden md:flex items-center gap-3 flex-1">
              <span className="text-sm text-gray-600">
                {admin.username}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {admin.is_super_admin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            
            <div className="flex-1 md:hidden" />
            
            {/* Left side (visually right in RTL): Admin Name on Mobile */}
            <div className="flex items-center gap-3 md:hidden">
              <span className="text-sm font-medium text-gray-900">
                {admin.username}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {admin.is_super_admin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={pathname === '/admin/pos' ? 'p-0' : 'p-4 md:p-6'} dir="rtl">{children}</main>
      </div>
    </div>
  );
}

