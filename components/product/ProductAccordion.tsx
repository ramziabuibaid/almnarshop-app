'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function AccordionItem({ title, isOpen, onToggle, children }: AccordionItemProps) {
    return (
        <div className="border-b border-gray-100 last:border-0" dir="rtl">
            <button
                onClick={onToggle}
                className="flex w-full items-center justify-between py-4 sm:py-5 text-right transition-colors hover:text-[#D4AF37]"
            >
                <span className="text-base sm:text-lg font-semibold text-gray-900">
                    {title}
                </span>
                <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#D4AF37]' : ''
                        }`}
                />
            </button>
            <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-4' : 'grid-rows-[0fr] opacity-0'
                    }`}
            >
                <div className="overflow-hidden">
                    <div className="text-sm sm:text-base text-gray-600 leading-relaxed">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ProductAccordionProps {
    description?: string;
    specs: { label: string; value: string | number | undefined }[];
}

export default function ProductAccordion({ description, specs }: ProductAccordionProps) {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        desc: true, // Default open
        specs: true,
    });

    const validSpecs = specs.filter((s) => s.value && s.value !== '' && s.value !== 0);

    const toggleSection = (section: string) => {
        setOpenSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8 mt-4">
            <div className="px-4 sm:px-6">
                {description && (
                    <AccordionItem
                        title="وصف المنتج"
                        isOpen={openSections['desc']}
                        onToggle={() => toggleSection('desc')}
                    >
                        <p className="whitespace-pre-line text-right">{description}</p>
                    </AccordionItem>
                )}

                {validSpecs.length > 0 && (
                    <AccordionItem
                        title="المواصفات الفنية"
                        isOpen={openSections['specs']}
                        onToggle={() => toggleSection('specs')}
                    >
                        <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 my-2">
                            <table className="w-full text-right">
                                <tbody>
                                    {validSpecs.map((spec, index) => (
                                        <tr
                                            key={index}
                                            className={index % 2 === 0 ? 'bg-white' : 'bg-transparent'}
                                        >
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-100 last:border-0 w-1/3">
                                                {spec.label}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100 last:border-0 border-r border-r-gray-100">
                                                {spec.value}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </AccordionItem>
                )}
            </div>
        </div>
    );
}
