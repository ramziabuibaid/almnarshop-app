import { notFound } from 'next/navigation';
import { getProductById, getProducts } from '@/lib/api';
import ProductDetailsClient from '@/components/product/ProductDetailsClient';
import RelatedProducts from '@/components/product/RelatedProducts';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductById(id);
  
  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  return {
    title: `${product.name || product.Name || 'Product'} - My Shop`,
    description: product.description || `${product.name || product.Name} - ${product.brand || product.Brand || ''}`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  
  if (!id) {
    notFound();
  }

  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  // Fetch all products for related products (we'll filter client-side)
  const allProducts = await getProducts();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <ProductDetailsClient product={product} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <RelatedProducts currentProductId={product.id || product.ProductID || id} currentProductType={product.type || product.Type || ''} allProducts={allProducts} />
      </div>
    </div>
  );
}
