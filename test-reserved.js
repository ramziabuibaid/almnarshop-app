import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testReserved() {
    const { data: qData, error: qError } = await supabase
        .from('quotations')
        .select('quotation_id, status')
        .eq('status', 'مدفوع كلي أو جزئي تم الحجز');

    console.log('qError:', qError);
    console.log('qData:', qData);

    if (qData && qData.length > 0) {
        const quotationIds = qData.map(q => q.quotation_id);
        const { data: qdData, error: qdError } = await supabase
            .from('quotation_details')
            .select('product_id, quantity')
            .in('quotation_id', quotationIds);
        console.log('qdError:', qdError);
        console.log('qdData:', qdData);
    }
}

testReserved();
