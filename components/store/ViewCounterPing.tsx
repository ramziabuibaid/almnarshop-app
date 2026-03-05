'use client';
import { useEffect } from 'react';
import { incrementArticleView } from '@/lib/api';

export default function ViewCounterPing({ articleId }: { articleId: string }) {
    useEffect(() => {
        // Only count once per session
        const viewedKey = `article_viewed_${articleId}`;
        if (!sessionStorage.getItem(viewedKey)) {
            incrementArticleView(articleId).catch(console.error);
            sessionStorage.setItem(viewedKey, 'true');
        }
    }, [articleId]);

    return null;
}
