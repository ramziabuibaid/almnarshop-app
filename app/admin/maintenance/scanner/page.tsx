'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getMaintenance, updateMaintenance } from '@/lib/api';
import {
    ArrowRightLeft,
    Store,
    Warehouse,
    Building2,
    ScanLine,
    CheckCircle2,
    XCircle,
    Loader2,
    ChevronRight,
    Camera,
    RotateCcw,
    X
} from 'lucide-react';
import { normalizeBarcodeInput, getLatinCharFromKeyEvent, SCANNER_KEY } from '@/lib/barcodeScannerLatin';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

type TransitionAction = {
    id: string;
    label: string;
    icon: React.ReactNode;
    allowedCurrentStatuses: string[];
    getNewStatus: (currentStatus: string) => string;
    colorClass: string;
};

const TRANSITIONS: TransitionAction[] = [
    {
        id: 'store_to_warehouse',
        label: 'ترحيل من المحل إلى المخزن',
        icon: <Warehouse className="w-5 h-5" />,
        allowedCurrentStatuses: ['موجودة في المحل وجاهزة للتسليم', 'جاهزة للتسليم للزبون من المحل'],
        getNewStatus: (current) => current === 'جاهزة للتسليم للزبون من المحل' ? 'جاهزة للتسليم للزبون من المخزن' : 'موجودة في المخزن وجاهزة للتسليم',
        colorClass: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
    },
    {
        id: 'receive_company_store',
        label: 'استلام من الشركة (في المحل)',
        icon: <Store className="w-5 h-5" />,
        allowedCurrentStatuses: ['موجودة في الشركة'],
        getNewStatus: () => 'جاهزة للتسليم للزبون من المحل',
        colorClass: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
    },
    {
        id: 'receive_company_warehouse',
        label: 'استلام من الشركة (في المخزن)',
        icon: <Warehouse className="w-5 h-5" />,
        allowedCurrentStatuses: ['موجودة في الشركة'],
        getNewStatus: () => 'جاهزة للتسليم للزبون من المخزن',
        colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
    },
    {
        id: 'send_to_company',
        label: 'تسليم إلى الشركة',
        icon: <Building2 className="w-5 h-5" />,
        allowedCurrentStatuses: ['موجودة في المحل وجاهزة للتسليم', 'موجودة في المخزن وجاهزة للتسليم'],
        getNewStatus: () => 'موجودة في الشركة',
        colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
    },
    {
        id: 'warehouse_to_store',
        label: 'ترحيل من المخزن إلى المحل',
        icon: <Store className="w-5 h-5" />,
        allowedCurrentStatuses: ['موجودة في المخزن وجاهزة للتسليم', 'جاهزة للتسليم للزبون من المخزن'],
        getNewStatus: (current) => current === 'جاهزة للتسليم للزبون من المخزن' ? 'جاهزة للتسليم للزبون من المحل' : 'موجودة في المحل وجاهزة للتسليم',
        colorClass: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
    },
    {
        id: 'deliver_to_customer',
        label: 'تسليم للزبون',
        icon: <CheckCircle2 className="w-5 h-5" />,
        allowedCurrentStatuses: ['جاهزة للتسليم للزبون من المحل', 'جاهزة للتسليم للزبون من المخزن'],
        getNewStatus: () => 'سلمت للزبون',
        colorClass: 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200'
    }
];

type ScanLog = {
    id: string;
    timestamp: Date;
    maintNo: string;
    success: boolean;
    message: string;
    itemName?: string;
    customerName?: string;
};

export default function MaintenanceScannerPage() {
    const router = useRouter();
    const { admin } = useAdminAuth();

    const [activeTransitionId, setActiveTransitionId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<ScanLog[]>([]);
    const [barcodeInputKey, setBarcodeInputKey] = useState(0);

    // Inquiry specific state
    const [inquiryResult, setInquiryResult] = useState<any>(null); // Type should match MaintenanceRecord
    const [isInquiring, setIsInquiring] = useState(false);
    const [inquiryError, setInquiryError] = useState<string | null>(null);
    const [inquiryInputKey, setInquiryInputKey] = useState(1);

    // Camera Scanner State
    const [isCameraScanning, setIsCameraScanning] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
    const [cameraScanSuccess, setCameraScanSuccess] = useState(false);
    const [isCameraScanProcessing, setIsCameraScanProcessing] = useState(false);

    // Camera Scanner Refs
    const cameraScannerRef = useRef<BrowserMultiFormatReader | null>(null);
    const cameraScanAreaRef = useRef<HTMLVideoElement>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const barcodeBufferRef = useRef('');
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const inquiryInputRef = useRef<HTMLInputElement>(null);
    const inquiryBufferRef = useRef('');
    const inquiryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useLayoutEffect(() => {
        document.title = 'الماسح السريع للصيانة';
    }, []);

    // Keep focus on hidden input if a transition is selected
    useEffect(() => {
        const focusInput = () => {
            // Do not steal focus if the user is currently focused on the Inquiry input
            if (document.activeElement === inquiryInputRef.current) return;

            if (activeTransitionId && inputRef.current && document.activeElement !== inputRef.current) {
                inputRef.current.focus();
            }
        };

        focusInput();
        const intervalId = setInterval(focusInput, 1000);

        // Also focus when user clicks anywhere (except when clicking on the inquiry input)
        const handleClick = (e: MouseEvent) => {
            if (e.target === inquiryInputRef.current) return;
            focusInput();
        };
        document.addEventListener('click', handleClick);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('click', handleClick);
        };
    }, [activeTransitionId]);

    const activeTransition = TRANSITIONS.find(t => t.id === activeTransitionId);

    const addLog = (log: Omit<ScanLog, 'id' | 'timestamp'>) => {
        setLogs(prev => [
            {
                ...log,
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date()
            },
            ...prev
        ].slice(0, 50)); // Keep only last 50 logs
    };

    const processScan = async (scannedValue: string) => {
        if (!scannedValue || !activeTransition || isScanning) return;

        // Clean input
        const cleanScanned = scannedValue.trim();
        if (!cleanScanned) return;

        // Smart logic: Check if it's a URL and extract the ID
        let finalNo = cleanScanned;
        if (cleanScanned.includes('http') || cleanScanned.includes('/maintenance/')) {
            try {
                const urlMatch = cleanScanned.match(/\/maintenance\/([^/?]+)/);
                if (urlMatch && urlMatch[1]) {
                    finalNo = urlMatch[1];
                }
            } catch (e) {
                console.warn('Error parsing URL:', e);
            }
        }

        setIsScanning(true);

        try {
            // 1. Fetch current maintenance record
            const record = await getMaintenance(finalNo);

            if (!record) {
                throw new Error('لم يتم العثور على معاملة بهذا الرقم.');
            }

            // 2. Validate current status
            const currentStatus = record.Status;
            if (!activeTransition.allowedCurrentStatuses.includes(currentStatus)) {
                throw new Error(`حالة القطعة غير متوافقة. (الحالة الحالية: ${currentStatus})`);
            }

            // 3. Update status
            const computedNewStatus = activeTransition.getNewStatus(currentStatus);
            await updateMaintenance(finalNo, {
                status: computedNewStatus as any,
                historyNote: `تم النقل عبر الماسح السريع: ${activeTransition.label}`,
                changedBy: admin?.id,
            });

            // 4. Success log
            addLog({
                maintNo: finalNo,
                success: true,
                message: `تم النقل بنجاح إلى: ${computedNewStatus}`,
                itemName: record.ItemName,
                customerName: record.CustomerName
            });

            // Play success beep
            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            } catch (e) { }

        } catch (err: any) {
            console.error('[Scanner] Process error:', err);
            // Error log
            addLog({
                maintNo: finalNo,
                success: false,
                message: err.message || 'حدث خطأ غير معروف'
            });

            // Play error beep
            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = 400;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            } catch (e) { }
        } finally {
            setIsScanning(false);
            // Ensure focus is returned
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 50);
        }
    };

    const processInquiry = async (scannedValue: string) => {
        if (!scannedValue || isInquiring) return;

        setInquiryError(null);
        setInquiryResult(null);

        const cleanScanned = scannedValue.trim();
        if (!cleanScanned) return;

        let finalNo = cleanScanned;
        if (cleanScanned.includes('http') || cleanScanned.includes('/maintenance/')) {
            try {
                const urlMatch = cleanScanned.match(/\/maintenance\/([^/?]+)/);
                if (urlMatch && urlMatch[1]) {
                    finalNo = urlMatch[1];
                }
            } catch (e) {
                console.warn('Error parsing URL:', e);
            }
        }

        setIsInquiring(true);
        try {
            const record = await getMaintenance(finalNo);
            if (!record) {
                setInquiryError(`لا توجد معاملة بالرقم ${finalNo}`);
            } else {
                setInquiryResult(record);
                // Play notification beep
                try {
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.frequency.value = 600;
                    oscillator.type = 'sine';
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.2);
                } catch (e) { }
            }
        } catch (error: any) {
            setInquiryError(error.message || 'حدث خطأ أثناء الاستعلام');
        } finally {
            setIsInquiring(false);
            setTimeout(() => {
                if (inquiryInputRef.current) inquiryInputRef.current.focus();
            }, 50);
        }
    };

    const submitBarcodeFromRef = () => {
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
        const raw = (inputRef.current?.value ?? barcodeBufferRef.current).trim();
        barcodeBufferRef.current = '';
        if (inputRef.current) inputRef.current.value = '';
        setBarcodeInputKey(k => k + 1);

        if (raw) {
            const scannedValue = normalizeBarcodeInput(raw);
            processScan(scannedValue);
        }
    };

    const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const ch = getLatinCharFromKeyEvent(e.nativeEvent);
        if (ch === null) return;

        if (ch === SCANNER_KEY.ENTER) {
            e.preventDefault();
            submitBarcodeFromRef();
            return;
        }
        if (ch === SCANNER_KEY.BACKSPACE) {
            e.preventDefault();
            barcodeBufferRef.current = barcodeBufferRef.current.slice(0, -1);
            if (inputRef.current) inputRef.current.value = barcodeBufferRef.current;
            return;
        }

        e.preventDefault();
        barcodeBufferRef.current += ch;
        if (inputRef.current) inputRef.current.value = barcodeBufferRef.current;

        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        if (barcodeBufferRef.current.trim().length >= 3) {
            scanTimeoutRef.current = setTimeout(submitBarcodeFromRef, 300);
        }
    };

    const handleBarcodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') ?? '').trim();
        const normalized = normalizeBarcodeInput(pasted);
        barcodeBufferRef.current += normalized;
        if (inputRef.current) inputRef.current.value = barcodeBufferRef.current;
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        if (barcodeBufferRef.current.trim().length >= 3) {
            scanTimeoutRef.current = setTimeout(submitBarcodeFromRef, 80);
        }
    };

    const submitInquiryFromRef = () => {
        if (inquiryTimeoutRef.current) {
            clearTimeout(inquiryTimeoutRef.current);
            inquiryTimeoutRef.current = null;
        }
        const raw = (inquiryInputRef.current?.value ?? inquiryBufferRef.current).trim();
        inquiryBufferRef.current = '';
        if (inquiryInputRef.current) inquiryInputRef.current.value = '';
        setInquiryInputKey(k => k + 1);

        if (raw) {
            const scannedValue = normalizeBarcodeInput(raw);
            processInquiry(scannedValue);
        }
    };

    const handleInquiryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const ch = getLatinCharFromKeyEvent(e.nativeEvent);
        if (ch === null) return;

        if (ch === SCANNER_KEY.ENTER) {
            e.preventDefault();
            submitInquiryFromRef();
            return;
        }
        if (ch === SCANNER_KEY.BACKSPACE) {
            e.preventDefault();
            inquiryBufferRef.current = inquiryBufferRef.current.slice(0, -1);
            if (inquiryInputRef.current) inquiryInputRef.current.value = inquiryBufferRef.current;
            return;
        }

        e.preventDefault();
        inquiryBufferRef.current += ch;
        if (inquiryInputRef.current) inquiryInputRef.current.value = inquiryBufferRef.current;

        if (inquiryTimeoutRef.current) clearTimeout(inquiryTimeoutRef.current);
        if (inquiryBufferRef.current.trim().length >= 3) {
            inquiryTimeoutRef.current = setTimeout(submitInquiryFromRef, 300);
        }
    };

    const handleInquiryPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') ?? '').trim();
        const normalized = normalizeBarcodeInput(pasted);
        inquiryBufferRef.current += normalized;
        if (inquiryInputRef.current) inquiryInputRef.current.value = inquiryBufferRef.current;
        if (inquiryTimeoutRef.current) clearTimeout(inquiryTimeoutRef.current);
        if (inquiryBufferRef.current.trim().length >= 3) {
            inquiryTimeoutRef.current = setTimeout(submitInquiryFromRef, 80);
        }
    };

    // --- Camera Scanner Logic ---
    const startCameraScanning = async () => {
        setIsCameraScanning(true);
        setCameraErrorMessage(null);
        setCameraScanSuccess(false);
        setIsCameraScanProcessing(false);

        try {
            const codeReader = new BrowserMultiFormatReader();
            const videoInputDevices = await codeReader.listVideoInputDevices();
            setAvailableCameras(videoInputDevices);

            if (videoInputDevices.length === 0) {
                setCameraErrorMessage('لم يتم العثور على أجهزة كاميرا');
                return;
            }

            // Find back camera if possible
            let targetCameraIndex = 0;
            const backCameraIndex = videoInputDevices.findIndex(device =>
                device.label.toLowerCase().includes('back') ||
                device.label.toLowerCase().includes('rear') ||
                device.label.toLowerCase().includes('environment')
            );

            if (backCameraIndex !== -1) {
                targetCameraIndex = backCameraIndex;
            }

            setCurrentCameraIndex(targetCameraIndex);

            // Stop any existing scanner
            if (cameraScannerRef.current) {
                try {
                    cameraScannerRef.current.reset();
                } catch (e) {
                    console.warn('[Scanner] Error resetting scanner:', e);
                }
                cameraScannerRef.current = null;
            }

            cameraScannerRef.current = codeReader;

            const selectedDeviceId = videoInputDevices[targetCameraIndex].deviceId;

            await codeReader.decodeFromVideoDevice(
                selectedDeviceId,
                'barcode-scanner',
                (result, err) => {
                    if (result && !isCameraScanProcessing && !cameraScanSuccess) {
                        handleCameraScanResult(result.getText());
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.warn('[Scanner] Decoding error:', err);
                    }
                }
            );
        } catch (err: any) {
            console.error('[Scanner] Failed to start camera:', err);
            setCameraErrorMessage(err.message || 'فشل الوصول للكاميرا. تأكد من إعطاء الصلاحيات اللازمة للمتصفح.');
        }
    };

    const stopCameraScanning = () => {
        setIsCameraScanning(false);
        if (cameraScannerRef.current) {
            try {
                cameraScannerRef.current.reset();
            } catch (err) {
                console.warn('[Scanner] Error resetting scanner:', err);
            }
            cameraScannerRef.current = null;
        }
    };

    const switchCamera = async () => {
        if (!cameraScannerRef.current || availableCameras.length < 2) return;

        const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
        setCurrentCameraIndex(nextIndex);
        setCameraErrorMessage(null);

        // Stop current
        cameraScannerRef.current.reset();

        try {
            const selectedDeviceId = availableCameras[nextIndex].deviceId;
            await cameraScannerRef.current.decodeFromVideoDevice(
                selectedDeviceId,
                'barcode-scanner',
                (result, err) => {
                    if (result && !isCameraScanProcessing && !cameraScanSuccess) {
                        handleCameraScanResult(result.getText());
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.warn('[Scanner] Decoding error:', err);
                    }
                }
            );
        } catch (err: any) {
            console.error('[Scanner] Failed to switch camera:', err);
            setCameraErrorMessage('فشل في التبديل إلى الكاميرا المطلوبة.');
        }
    };

    const handleCameraScanResult = async (scannedValue: string) => {
        setIsCameraScanProcessing(true);
        setCameraScanSuccess(true);

        try {
            // Play success sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn('[Scanner] Audio ignored');
        }

        const normalizedValue = normalizeBarcodeInput(scannedValue);

        // Allow user to see the success checkmark briefly
        setTimeout(() => {
            stopCameraScanning();

            // Route to correct processor based on user state
            if (activeTransitionId) {
                processScan(normalizedValue);
            } else {
                processInquiry(normalizedValue);
            }
        }, 800);
    };

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto space-y-6 font-cairo" dir="rtl">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/admin/maintenance')}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <ScanLine className="w-8 h-8 text-blue-600" />
                            الماسح السريع للصيانة
                        </h1>
                        <p className="text-gray-600 mt-1">
                            اختر الإجراء المطلوب ثم ابدأ بمسح الباركود لتحديث الحالات تلقائياً
                        </p>
                    </div>
                </div>

                {/* Inquiry Section */}
                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-sm mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-1 bg-indigo-500"></div>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 w-full">
                            <h2 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                <ScanLine className="w-6 h-6 text-indigo-600" />
                                الاستعلام السريع
                            </h2>
                            <p className="text-indigo-700 text-sm mb-4">
                                امسح باركود القطعة هنا لمعرفة حالتها الحالية دون تغييرها.
                            </p>
                            <div className="relative">
                                <input
                                    key={`inquiry-${inquiryInputKey}`}
                                    ref={inquiryInputRef}
                                    type="text"
                                    className="w-full px-4 py-3 text-lg font-bold border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 placeholder-indigo-300 transition-all bg-indigo-50/50"
                                    placeholder="امسح الباركود للاستعلام..."
                                    onKeyDown={handleInquiryKeyDown}
                                    onPaste={handleInquiryPaste}
                                    disabled={isInquiring}
                                />
                                {isInquiring && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                                    </div>
                                )}
                            </div>

                            {inquiryError && (
                                <p className="text-red-600 text-sm font-bold mt-2 flex items-center gap-1">
                                    <XCircle className="w-4 h-4" /> {inquiryError}
                                </p>
                            )}
                        </div>

                        {/* Inquiry Result Display */}
                        {inquiryResult && !isInquiring && (
                            <div className="flex-1 w-full bg-indigo-50 border border-indigo-100 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full px-4">
                                        رقم {inquiryResult.MaintenanceNo}
                                    </span>
                                    <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg mb-1">{inquiryResult.ItemName}</h3>
                                <p className="text-gray-600 text-sm mb-3 font-medium">العميل: {inquiryResult.CustomerName}</p>
                                <div className="bg-white px-4 py-3 rounded-lg border border-indigo-100">
                                    <span className="text-gray-500 text-xs block mb-1">الحالة الحالية:</span>
                                    <span className="font-bold text-lg text-indigo-900 block">{inquiryResult.Status}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Actions Column */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="font-bold text-lg text-gray-800 mb-2 border-b pb-2">1. اختر نوع الإجراء:</h2>
                        <div className="space-y-3">
                            {TRANSITIONS.map((transition) => (
                                <button
                                    key={transition.id}
                                    onClick={() => {
                                        setActiveTransitionId(transition.id);
                                        setLogs([]); // Clear logs when changing mode
                                    }}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${activeTransitionId === transition.id
                                        ? `ring-4 ring-opacity-50 ${transition.colorClass.replace('bg-', 'ring-').split(' ')[0]} ${transition.colorClass}`
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 font-bold">
                                        {transition.icon}
                                        <span>{transition.label}</span>
                                    </div>
                                    {activeTransitionId === transition.id && (
                                        <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scanner Area & Logs Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {!activeTransition ? (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center text-gray-500">
                                <ArrowRightLeft className="w-16 h-16 text-gray-300 mb-4" />
                                <h3 className="text-xl font-bold text-gray-700 mb-2">يرجى اختيار إجراء للبدء</h3>
                                <p>اختر أحد الأزرار الجانبية لتحديد مسار نقل القطع قبل المسح</p>
                            </div>
                        ) : (
                            <>
                                {/* Scanner Interface */}
                                <div className="bg-blue-50 border border-blue-200 p-8 rounded-2xl text-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-full h-1 bg-blue-500 animate-pulse"></div>

                                    <ScanLine className={`w-20 h-20 mx-auto text-blue-600 mb-4 ${isScanning ? 'animate-bounce' : 'opacity-70'}`} />

                                    <h2 className="text-2xl font-bold text-blue-900 mb-2">النظام جاهز للمسح</h2>
                                    <p className="text-blue-700 font-medium mb-4">
                                        الإجراء الحالي: <span className="font-bold bg-white px-2 py-1 rounded inline-block mx-1 shadow-sm">{activeTransition.label}</span>
                                    </p>

                                    <p className="text-sm border-2 border-blue-200 border-dashed rounded-lg p-3 inline-block bg-white text-gray-500">
                                        ضع مؤشر الماوس هنا واستخدم الماسح
                                        <br />
                                        أو اكتب رقم الصيانة واضغط مسافة/Enter
                                    </p>

                                    <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3 w-full max-w-md mx-auto">
                                        <div className="relative w-full">
                                            <input
                                                key={barcodeInputKey}
                                                ref={inputRef}
                                                type="text"
                                                className="w-full px-4 py-3 text-center text-xl font-bold border-2 border-blue-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all"
                                                placeholder="امسح الباركود هنا..."
                                                onKeyDown={handleBarcodeKeyDown}
                                                onPaste={handleBarcodePaste}
                                                disabled={isScanning}
                                                autoFocus
                                            />
                                            {isScanning && (
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={startCameraScanning}
                                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-md flex-shrink-0"
                                            title="فتح كاميرا الموبايل للمسح"
                                        >
                                            <Camera size={20} />
                                            عبر الكاميرا
                                        </button>
                                    </div>
                                </div>

                                {/* Scan Logs */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm min-h-[300px]">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between border-b pb-2">
                                        <span>سجل المسح الحديث ({logs.length})</span>
                                        <button
                                            onClick={() => setLogs([])}
                                            className="text-sm text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                                        >
                                            مسح السجل
                                        </button>
                                    </h3>

                                    {logs.length === 0 ? (
                                        <div className="text-center text-gray-400 py-10">
                                            لا يوجد أي سجلات حالياً. امسح باركود ليظهر هنا.
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {logs.map((log) => (
                                                <div
                                                    key={log.id}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border ${log.success ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                                                        }`}
                                                >
                                                    <div className="mt-1 flex-shrink-0">
                                                        {log.success ? (
                                                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                                                        ) : (
                                                            <XCircle className="w-6 h-6 text-red-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-gray-900 tracking-wider">#{log.maintNo}</span>
                                                            <span className="text-xs text-gray-500">
                                                                {log.timestamp.toLocaleTimeString('ar-SA')}
                                                            </span>
                                                        </div>

                                                        {log.itemName && (
                                                            <div className="text-sm text-gray-700 font-medium mb-1">
                                                                {log.itemName} {log.customerName ? `(${log.customerName})` : ''}
                                                            </div>
                                                        )}

                                                        <div className={`text-sm font-semibold ${log.success ? 'text-green-700' : 'text-red-700'}`}>
                                                            {log.message}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Fullscreen Barcode Scanner Camera View */}
                {isCameraScanning && (
                    <div className="fixed inset-0 z-[100] bg-black flex flex-col font-cairo" dir="rtl">
                        {/* Header */}
                        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white text-lg font-bold mb-1">امسح الباركود</p>
                                    <p className="text-gray-300 text-sm">وجه الكاميرا نحو الباركود</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Switch Camera Button */}
                                    {availableCameras.length > 1 && (
                                        <button
                                            onClick={switchCamera}
                                            className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                            aria-label="تبديل الكاميرا"
                                            title="تبديل الكاميرا"
                                        >
                                            <RotateCcw size={24} />
                                        </button>
                                    )}
                                    <button
                                        onClick={stopCameraScanning}
                                        className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                        aria-label="إغلاق"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Video Container */}
                        <div className="flex-1 relative overflow-hidden">
                            <video
                                id="barcode-scanner"
                                ref={cameraScanAreaRef}
                                className="absolute inset-0 w-full h-full object-cover"
                                playsInline
                                muted
                                autoPlay
                            />

                            {/* Viewfinder Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                {/* Scanning Frame */}
                                <div className="relative w-80 h-80 max-w-[85vw] max-h-[85vw]">
                                    {/* Corner indicators */}
                                    <div className="absolute inset-0 border-4 border-white/80 rounded-lg">
                                        <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                                        <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                                        <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                                        <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                                    </div>

                                    {/* Scanning line animation */}
                                    {!cameraScanSuccess && !isCameraScanProcessing && (
                                        <div className="absolute inset-0 overflow-hidden rounded-lg">
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 shadow-lg shadow-green-400/50 animate-scan-line"></div>
                                        </div>
                                    )}

                                    {/* Success Indicator */}
                                    {cameraScanSuccess && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg animate-fade-in">
                                            <div className="bg-green-500 rounded-full p-4 shadow-2xl shadow-green-500/50">
                                                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {cameraErrorMessage && (
                                        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in whitespace-nowrap">
                                            {cameraErrorMessage}
                                        </div>
                                    )}
                                </div>

                                {/* Overlay mask */}
                                <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{
                                    clipPath: `polygon(
                                        0% 0%,
                                        0% 100%,
                                        calc(50% - 40vw) 100%,
                                        calc(50% - 40vw) calc(50% - 40vw),
                                        calc(50% + 40vw) calc(50% - 40vw),
                                        calc(50% + 40vw) calc(50% + 40vw),
                                        calc(50% - 40vw) calc(50% + 40vw),
                                        calc(50% - 40vw) 100%,
                                        100% 100%,
                                        100% 0%
                                    )`
                                }}></div>
                            </div>
                        </div>

                        {/* Footer Instructions */}
                        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 pb-8">
                            <p className="text-white text-center text-sm">
                                {isCameraScanProcessing ? 'جاري المعالجة...' : 'ضع الباركود داخل الإطار'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
