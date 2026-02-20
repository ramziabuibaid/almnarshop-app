const fs = require('fs');
const data = JSON.parse(fs.readFileSync('merged_data_with_images.json', 'utf8'));
console.log("Total products:", data.length);
if (data.length > 0) {
  const sample = data[0];
  console.log("Keys in first product:", Object.keys(sample));
  
  // Find products that have size or color
  const withSize = data.filter(p => p.size || p.Size || p.SIZE || Object.keys(p).some(k => k.toLowerCase().includes('size')));
  const withColor = data.filter(p => p.color || p.Color || p.COLOR || Object.keys(p).some(k => k.toLowerCase().includes('color')));
  
  console.log("Products with size:", withSize.length);
  console.log("Products with color:", withColor.length);
  
  if (withSize.length > 0) {
    const p = withSize[0];
    console.log("Sample size data:", {
      size: p.size, Size: p.Size, SIZE: p.SIZE
    });
    console.log("All keys for product with size:", Object.keys(p).filter(k => k.toLowerCase().includes('size')));
  }
}
