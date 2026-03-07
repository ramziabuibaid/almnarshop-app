import { getGroomOfferFromSupabase, getGroomOffers } from './lib/api';

async function main() {
  const all = await getGroomOffers();
  console.log("ALL OFFERS:", all);
  
  if (all.length > 0) {
    const id = all[0].QuotationID;
    console.log("FIRST ID:", id);
    try {
      const offer = await getGroomOfferFromSupabase(id);
      console.log("FETCHED OFFER:", offer);
    } catch(e) {
      console.log("ERROR FETCHING OFFER:", e.message);
    }
  }
}

main();
