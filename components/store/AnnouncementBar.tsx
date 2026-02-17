'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function AnnouncementBar() {
    const [active, setActive] = useState(false);
    const [text, setText] = useState('');
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.announcement_active !== undefined) {
                    setActive(data.announcement_active);
                }
                if (data.announcement_text) {
                    setText(data.announcement_text);
                }
            })
            .catch(err => console.error('Failed to fetch settings:', err));
    }, []);

    if (!active || !visible || !text) return null;

    return (
        <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-white text-sm font-medium py-2.5 px-4 relative z-50 shadow-md">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex-1 text-center truncate">
                    {text}
                </div>
                <button
                    onClick={() => setVisible(false)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
