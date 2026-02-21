import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCampaignWithProductsBySlug, getCampaignWithProducts } from '@/lib/api';
import CampaignLandingPage from '@/components/campaign/CampaignLandingPage';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const campaign = await getCampaignWithProductsBySlug(slug);

    if (!campaign) {
      return {
        title: 'Campaign Not Found',
        description: 'The requested campaign could not be found.',
      };
    }

    const title = campaign.title || 'Special Offer';
    const description = `Don't miss out on our amazing ${title}! Limited time offer with great discounts on premium products.`;
    const imageUrl = campaign.banner_image || '/logo.png';

    return {
      title: `${title} | Almnar Home`,
      description,
      openGraph: {
        title: `${title} | Almnar Home`,
        description,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | Almnar Home`,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error('[Metadata] Error generating metadata:', error);
    return {
      title: 'Special Offer | Almnar Home',
      description: 'Check out our amazing special offers and discounts!',
    };
  }
}

export default async function CampaignPage({ params }: PageProps) {
  try {
    const { slug } = await params;
    console.log('[CampaignPage] Fetching campaign with slug/id:', slug);

    // Try to get campaign by slug first
    let campaign = await getCampaignWithProductsBySlug(slug);

    // If not found by slug, try to get by campaign_id (fallback)
    // This handles cases where slug is not set but campaign_id is used in URL
    if (!campaign) {
      console.log('[CampaignPage] Campaign not found by slug, trying campaign_id as fallback...');
      try {
        campaign = await getCampaignWithProducts(slug);
        if (campaign) {
          console.log('[CampaignPage] Campaign found by campaign_id:', campaign?.title);
        }
      } catch (e: any) {
        console.log('[CampaignPage] Campaign not found by campaign_id either:', e?.message);
      }
    } else {
      console.log('[CampaignPage] Campaign found by slug:', campaign?.title);
    }

    if (!campaign) {
      console.log('[CampaignPage] Campaign not found, showing 404');
      notFound();
    }

    return <CampaignLandingPage campaign={campaign} />;
  } catch (error: any) {
    console.error('[CampaignPage] Error:', error);
    // Only call notFound if it's a "not found" error, otherwise let it bubble
    if (error?.message?.includes('not found') || error?.code === 'PGRST116') {
      notFound();
    }
    // For other errors, still show 404 to avoid exposing internal errors
    notFound();
  }
}
