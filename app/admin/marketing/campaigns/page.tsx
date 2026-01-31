'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Plus, Edit, Trash, Loader2, Calendar, Clock, Tag } from 'lucide-react';
import { getCampaigns, deleteCampaign } from '@/lib/api';

interface Campaign {
  campaign_id: string;
  title: string;
  banner_image: string;
  start_date: string;
  end_date: string;
  created_at?: string;
}

type CampaignStatus = 'active' | 'scheduled' | 'expired';

export default function CampaignsPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useLayoutEffect(() => {
    document.title = 'العروض الترويجية - Campaigns';
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await getCampaigns();
      setCampaigns(data || []);
    } catch (error) {
      console.error('[CampaignsPage] Error loading campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const getCampaignStatus = (campaign: Campaign): CampaignStatus => {
    const now = new Date();
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);

    if (now < startDate) {
      return 'scheduled';
    } else if (now > endDate) {
      return 'expired';
    } else {
      return 'active';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      numberingSystem: 'latn',
    });
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض الترويجي؟')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteCampaign(campaignId);
      await loadCampaigns();
      setDeleteTarget(null);
    } catch (error: any) {
      console.error('[CampaignsPage] Error deleting campaign:', error);
      alert(`فشل في حذف العرض: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    const badges = {
      active: {
        label: 'نشط',
        className: 'bg-green-100 text-green-800 border-green-200',
      },
      scheduled: {
        label: 'مجدول',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
      },
      expired: {
        label: 'منتهي',
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      },
    };

    const badge = badges[status];
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
      >
        {badge.label}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">العروض الترويجية</h1>
            <p className="text-gray-600 mt-1">
              إدارة العروض الترويجية والصفقات المحدودة ({campaigns.length} عرض)
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/marketing/campaigns/new')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <span>إضافة عرض جديد</span>
            <Plus size={20} />
          </button>
        </div>

        {/* Campaigns List */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل العروض...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Tag size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد عروض ترويجية</p>
            <button
              onClick={() => router.push('/admin/marketing/campaigns/new')}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              إضافة عرض جديد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const status = getCampaignStatus(campaign);
              return (
                <div
                  key={campaign.campaign_id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Banner Image */}
                  {campaign.banner_image ? (
                    <div className="w-full h-48 bg-gray-100 overflow-hidden">
                      <img
                        src={campaign.banner_image}
                        alt={campaign.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <Tag size={48} className="text-gray-400" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 flex-1">
                        {campaign.title}
                      </h3>
                      {getStatusBadge(status)}
                    </div>

                    {/* Dates */}
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="font-medium">بداية:</span>
                        <span>{formatDate(campaign.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span className="font-medium">نهاية:</span>
                        <span>{formatDate(campaign.end_date)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() =>
                          router.push(`/admin/marketing/campaigns/${campaign.campaign_id}`)
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium text-sm"
                      >
                        <Edit size={16} />
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(campaign.campaign_id)}
                        disabled={deleting && deleteTarget === campaign.campaign_id}
                        className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting && deleteTarget === campaign.campaign_id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
