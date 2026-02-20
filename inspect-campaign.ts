import { getProducts, getActiveCampaignWithProducts } from './lib/api.ts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkIdMatch() {
    console.log("Fetching fetchedProducts...");
    const fetchedProducts = await getProducts({ forStore: true });
    console.log("Fetching activeCampaign...");
    const activeCampaign = await getActiveCampaignWithProducts();

    if (activeCampaign && activeCampaign.products && activeCampaign.products.length > 0) {
        console.log("Found active campaign with products:", activeCampaign.products.length);
        let matchCount = 0;

        for (const product of fetchedProducts) {
            const campaignProduct = activeCampaign.products.find(
                (cp: any) => cp.product_id === product.id || cp.id === product.id
            );
            if (campaignProduct && campaignProduct.offer_price) {
                matchCount++;
            }
        }
        console.log(`Matched ${matchCount} products out of ${activeCampaign.products.length} campaign items against ${fetchedProducts.length} total store items.`);

        if (matchCount === 0) {
            console.log("OH NO! 0 matches found! Let's examine the IDs...");
            console.log("Sample Campaign Product ID (`product_id`):", activeCampaign.products[0].product_id);
            console.log("Sample Campaign Product ID (`id`):", activeCampaign.products[0].id);
            console.log("Sample Store Product ID (`id`):", fetchedProducts[0].id);
            console.log("Sample Store Product ID (`product_id`):", fetchedProducts[0].product_id);
        }
    } else {
        console.log("No active campaign found.");
    }
}

checkIdMatch();
