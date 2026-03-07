'use client';

import React, { useRef, useEffect } from 'react';
import { Bold, Palette, Type, Heading1, Heading2, Underline as UnderlineIcon } from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minimal?: boolean;
}

export default function RichTextEditor({ value, onChange, placeholder, minimal = false }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);

    // Initialize content only once or when external value changes drastically (not during typing)
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        handleInput();
        editorRef.current?.focus();
    };

    const colors = ['#000000', '#dc2626', '#16a34a', '#2563eb', '#ca8a04', '#9333ea'];
    const sizes = [
        { label: 'صغير جداً', value: '1' },
        { label: 'صغير', value: '2' },
        { label: 'عادي', value: '3' },
        { label: 'متوسط', value: '4' },
        { label: 'كبير', value: '5' },
        { label: 'كبير جداً', value: '6' },
        { label: 'ضخم', value: '7' },
    ];

    return (
        <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col ${minimal ? 'shadow-none' : ''}`}>
            {/* Toolbar */}
            <div className={`bg-gray-50 border-b border-gray-200 flex flex-wrap items-center ${minimal ? 'p-1 gap-1' : 'p-2 gap-2'}`}>
                <button
                    type="button"
                    onClick={() => execCommand('bold')}
                    className={`text-gray-700 hover:bg-gray-200 rounded transition-colors ${minimal ? 'p-1' : 'p-1.5'}`}
                    title="عريض (Bold)"
                >
                    <Bold size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('underline')}
                    className={`text-gray-700 hover:bg-gray-200 rounded transition-colors ${minimal ? 'p-1' : 'p-1.5'}`}
                    title="مسطر (Underline)"
                >
                    <UnderlineIcon size={18} />
                </button>

                <div className={`w-px bg-gray-300 ${minimal ? 'h-4 mx-0.5' : 'h-6 mx-1'}`}></div>

                {/* Font Size Dropdown (simple native select) */}
                <div className="flex items-center gap-1">
                    {!minimal && <Type size={16} className="text-gray-500" />}
                    <select
                        onChange={(e) => execCommand('fontSize', e.target.value)}
                        className="text-sm bg-transparent border-none cursor-pointer focus:ring-0 text-gray-700 font-medium"
                        defaultValue="3"
                        title="حجم الخط"
                    >
                        {sizes.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                <div className={`w-px bg-gray-300 ${minimal ? 'h-4 mx-0.5' : 'h-6 mx-1'}`}></div>

                {/* Colors */}
                <div className="flex items-center gap-1 relative group">
                    {!minimal && <Palette size={16} className="text-gray-500" />}
                    <input
                        type="color"
                        onChange={(e) => execCommand('foreColor', e.target.value)}
                        className={`p-0 border-0 rounded cursor-pointer ${minimal ? 'w-5 h-5' : 'w-6 h-6'}`}
                        title="لون النص"
                    />
                    {!minimal && (
                        <div className="flex gap-1 ml-2">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => execCommand('foreColor', c)}
                                    className="w-5 h-5 rounded-full border border-gray-300 transform hover:scale-110 transition-transform"
                                    style={{ backgroundColor: c }}
                                    title="تغيير اللون"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onBlur={handleInput}
                className={`${minimal ? 'p-2 min-h-[60px] text-sm' : 'p-4 min-h-[150px]'} focus:outline-none prose max-w-none text-gray-900`}
                dir="auto"
                data-placeholder={placeholder}
                style={{
                    // Small hack for placeholder in contenteditable
                    emptyCells: 'show'
                }}
            />

            <style jsx global>{`
                [contenteditable][data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                    display: block; // For Firefox
                }
            `}</style>
        </div>
    );
}
