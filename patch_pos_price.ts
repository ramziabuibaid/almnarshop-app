import * as fs from 'fs';

let content = fs.readFileSync('app/admin/pos/page.tsx', 'utf-8');

// 1. Import getCustomerLastPriceForProduct
if (!content.includes('getCustomerLastPriceForProduct')) {
    content = content.replace(
        "import { saveCashInvoice, getProducts, getActiveCampaignWithProducts, getReservedQuantities, ReservedQuotationsData, getAllCustomers, saveShopPayment, saveShopSalesInvoice } from '@/lib/api';",
        "import { saveCashInvoice, getProducts, getActiveCampaignWithProducts, getReservedQuantities, ReservedQuotationsData, getAllCustomers, saveShopPayment, saveShopSalesInvoice, getCustomerLastPriceForProduct } from '@/lib/api';"
    );
}

// 2. Add effect to fetch last price when customer changes or cart changes
const insertAfter = "const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Visa' | 'Receivable'>('Cash');";
const hookCode = `
  // Effect to fetch last prices when customer is selected in Receivable mode
  useEffect(() => {
    if (paymentMethod === 'Receivable' && selectedCustomerId && cart.length > 0) {
      const fetchLastPrices = async () => {
        let pricesUpdated = false;
        const newCart = [...cart];
        
        for (let i = 0; i < newCart.length; i++) {
          const item = newCart[i];
          // Only fetch if price hasn't been manually heavily changed or just to be safe, fetch for all
          try {
            const lastPrice = await getCustomerLastPriceForProduct(selectedCustomerId, item.productID);
            if (lastPrice && lastPrice > 0 && lastPrice !== item.unitPrice) {
              newCart[i] = {
                ...item,
                unitPrice: lastPrice,
                total: item.quantity * lastPrice
              };
              pricesUpdated = true;
            }
          } catch (error) {
            console.error('[POS] Error fetching last customer price for product:', item.productID, error);
          }
        }
        
        if (pricesUpdated) {
          setCart(newCart);
        }
      };
      
      fetchLastPrices();
    }
  }, [selectedCustomerId, paymentMethod, cart.length]); // depend on cart.length so it runs when new items are added
`;

if (!content.includes('const fetchLastPrices = async () => {')) {
    content = content.replace(insertAfter, insertAfter + '\n' + hookCode);
}

fs.writeFileSync('app/admin/pos/page.tsx', content);
console.log('Done');
