import React, { useState } from 'react';
import { InAppAd, AdPlacement, AdActionType } from '../types';
import { 
  Megaphone, Plus, Edit, Trash2, Check, X, Sparkles, TrendingUp, Gift, Zap, 
  Flame, Award, Bot, DollarSign, Eye, MousePointer, ShieldCheck, Tag, ArrowRight,
  ChevronUp, ChevronDown
} from 'lucide-react';

interface AdminAdsManagerProps {
  adsList: InAppAd[];
  onSaveAd: (adData: Partial<InAppAd>, adId?: string) => Promise<void>;
  onDeleteAd: (ad: InAppAd) => Promise<void>;
  onToggleAd: (ad: InAppAd) => Promise<void>;
  isSaving: boolean;
}

const GRADIENT_PRESETS = [
  { label: 'Amber Gold (VIP / Alpha)', value: 'from-amber-600 via-amber-700 to-yellow-800' },
  { label: 'Emerald Mint (Referrals / Bonus)', value: 'from-emerald-600 via-teal-700 to-slate-900' },
  { label: 'Electric Blue (Deposit / Capital)', value: 'from-blue-600 via-indigo-700 to-slate-950' },
  { label: 'Purple Violet (AI Bots / Alpha)', value: 'from-purple-600 via-indigo-800 to-slate-950' },
  { label: 'Rose Ruby (Special Flash Offer)', value: 'from-rose-600 via-pink-700 to-slate-950' },
  { label: 'Dark Slate (Minimalist High Contrast)', value: 'from-slate-800 via-zinc-900 to-black' },
];

const ICON_OPTIONS = [
  { label: 'Trending Up (Yield / Alpha)', value: 'TrendingUp', icon: TrendingUp },
  { label: 'Gift (Referral / Rewards)', value: 'Gift', icon: Gift },
  { label: 'Zap (Instant Boost)', value: 'Zap', icon: Zap },
  { label: 'Sparkles (VIP / Promo)', value: 'Sparkles', icon: Sparkles },
  { label: 'Flame (Hot Alpha)', value: 'Flame', icon: Flame },
  { label: 'Award (Top Performer)', value: 'Award', icon: Award },
  { label: 'Bot (AI Pipeline)', value: 'Bot', icon: Bot },
  { label: 'DollarSign (Capital / Payout)', value: 'DollarSign', icon: DollarSign },
];

export const AdminAdsManager: React.FC<AdminAdsManagerProps> = ({
  adsList,
  onSaveAd,
  onDeleteAd,
  onToggleAd,
  isSaving
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<InAppAd | null>(null);

  const [form, setForm] = useState<{
    title: string;
    subtitle: string;
    description: string;
    badgeText: string;
    badgeColor: string;
    bgGradient: string;
    iconName: string;
    actionType: AdActionType;
    actionUrl?: string;
    ctaText: string;
    placement: AdPlacement;
    priority: number;
    isActive: boolean;
    targetAudience: 'ALL' | 'NO_ACTIVE_CONTRACT' | 'WITH_ACTIVE_CONTRACT' | 'NEW_USER';
  }>({
    title: '',
    subtitle: '',
    description: '',
    badgeText: 'SPECIAL OFFER',
    badgeColor: 'amber',
    bgGradient: 'from-amber-600 via-amber-700 to-yellow-800',
    iconName: 'Sparkles',
    actionType: 'EARN',
    actionUrl: '',
    ctaText: 'Explore Now',
    placement: 'CAROUSEL',
    priority: 1,
    isActive: true,
    targetAudience: 'ALL'
  });

  const handleOpenAdd = (adToEdit?: InAppAd) => {
    if (adToEdit) {
      setEditingAd(adToEdit);
      setForm({
        title: adToEdit.title,
        subtitle: adToEdit.subtitle || '',
        description: adToEdit.description || '',
        badgeText: adToEdit.badgeText || 'SPECIAL OFFER',
        badgeColor: adToEdit.badgeColor || 'amber',
        bgGradient: adToEdit.bgGradient || 'from-amber-600 via-amber-700 to-yellow-800',
        iconName: adToEdit.iconName || 'Sparkles',
        actionType: adToEdit.actionType,
        actionUrl: adToEdit.actionUrl || '',
        ctaText: adToEdit.ctaText || 'Explore Now',
        placement: adToEdit.placement,
        priority: adToEdit.priority || 1,
        isActive: adToEdit.isActive ?? true,
        targetAudience: adToEdit.targetAudience || 'ALL'
      });
    } else {
      setEditingAd(null);
      setForm({
        title: '',
        subtitle: '',
        description: '',
        badgeText: 'HOT ALPHA 🔥',
        badgeColor: 'amber',
        bgGradient: 'from-amber-600 via-amber-700 to-yellow-800',
        iconName: 'TrendingUp',
        actionType: 'EARN',
        actionUrl: '',
        ctaText: 'Claim Now',
        placement: 'CAROUSEL',
        priority: (adsList.length || 0) + 1,
        isActive: true,
        targetAudience: 'ALL'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveAd(form, editingAd?.id);
    setIsModalOpen(false);
  };

  return (
    <div id="admin-ads-manager" className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Megaphone size={22} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              In-App Ads & Earning Promos Manager
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                {adsList.length} Promos
              </span>
            </h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              Manage promotional modal popups and track view impressions, clicks, and conversions in real time.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAdd()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer shrink-0 uppercase tracking-wider"
        >
          <Plus size={14} strokeWidth={3} />
          <span>Create New Promo Ad</span>
        </button>
      </div>

      {/* Analytics KPI Overview for Admin */}
      {adsList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Eye size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total Views</span>
              <span className="text-base sm:text-lg font-black text-white font-mono">
                {adsList.reduce((sum, ad) => sum + (ad.viewCount || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MousePointer size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total Clicks</span>
              <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                {adsList.reduce((sum, ad) => sum + (ad.clickCount || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Average CTR</span>
              <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                {(() => {
                  const totalViews = adsList.reduce((sum, ad) => sum + (ad.viewCount || 0), 0);
                  const totalClicks = adsList.reduce((sum, ad) => sum + (ad.clickCount || 0), 0);
                  if (!totalViews) return '0.0%';
                  return `${((totalClicks / totalViews) * 100).toFixed(1)}%`;
                })()}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Active Promos</span>
              <span className="text-base sm:text-lg font-black text-purple-300 font-mono">
                {adsList.filter(a => a.isActive).length} / {adsList.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ads List Grid */}
      {adsList.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/60 rounded-3xl border border-zinc-800 space-y-3">
          <Megaphone size={36} className="text-amber-500 mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-zinc-300">No In-App Promotional Ads Configured</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Create promotional banners or modal popups to announce new VIP lead traders, deposit bonuses, or extra signal pass rewards.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAdd()}
            className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            + Create First Ad
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adsList.map((ad) => {
            const views = ad.viewCount || 0;
            const clicks = ad.clickCount || 0;
            const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={ad.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                  !ad.isActive 
                    ? 'bg-zinc-950/50 border-zinc-800/60 opacity-60' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/40'
                }`}
              >
                {/* Visual Preview Header */}
                <div className={`p-4 rounded-2xl ${ad.bgGradient ? `bg-gradient-to-r ${ad.bgGradient}` : 'bg-gradient-to-r from-amber-600 to-yellow-800'} text-white relative overflow-hidden shadow-inner`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-950 text-amber-300 border border-white/20">
                      <Sparkles size={10} />
                      <span>{ad.badgeText || 'PROMO'}</span>
                    </span>

                    <span className="text-[9px] px-2 py-0.5 rounded bg-black/40 text-white font-mono font-bold uppercase">
                      {ad.placement} • P{ad.priority || 1}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-white leading-tight line-clamp-1">
                    {ad.title}
                  </h3>
                  {ad.subtitle && (
                    <p className="text-[11px] text-white/90 font-medium mt-1 line-clamp-1">
                      {ad.subtitle}
                    </p>
                  )}
                </div>

                {/* Body Details */}
                <div className="space-y-3 text-xs">
                  {ad.description && (
                    <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                      {ad.description}
                    </p>
                  )}

                  {/* Real-time View & Click Metrics */}
                  <div className="bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800/80 grid grid-cols-3 gap-2 text-center">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 font-bold uppercase">
                        <Eye size={11} className="text-cyan-400" />
                        <span>Views</span>
                      </div>
                      <span className="text-xs font-black text-white font-mono block">
                        {views.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5 border-x border-zinc-850">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 font-bold uppercase">
                        <MousePointer size={11} className="text-amber-400" />
                        <span>Clicks</span>
                      </div>
                      <span className="text-xs font-black text-amber-400 font-mono block">
                        {clicks.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 font-bold uppercase">
                        <TrendingUp size={11} className="text-emerald-400" />
                        <span>CTR</span>
                      </div>
                      <span className="text-xs font-black text-emerald-400 font-mono block">
                        {ctr}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-mono pt-1">
                    <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-850">
                      <span className="text-zinc-500 block uppercase text-[9px]">Action Flow</span>
                      <span className="text-amber-400 font-bold font-sans uppercase truncate block">{ad.actionType}</span>
                    </div>

                    <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-850">
                      <span className="text-zinc-500 block uppercase text-[9px]">CTA Label</span>
                      <span className="text-zinc-300 font-bold truncate block">{ad.ctaText || 'Learn More'}</span>
                    </div>

                    <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-850 col-span-2 sm:col-span-1">
                      <span className="text-zinc-500 block uppercase text-[9px]">Audience</span>
                      <span className="text-emerald-400 font-bold truncate block">{ad.targetAudience || 'ALL'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleAd(ad)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      ad.isActive 
                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {ad.isActive ? 'Deactivate' : 'Activate Ad'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenAdd(ad)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors cursor-pointer"
                      title="Edit Promotional Ad"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAd(ad)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors cursor-pointer"
                      title="Delete Promotional Ad"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Ad Modal */}
      {isModalOpen && (
        <div id="admin-ad-edit-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {editingAd ? 'Edit Promotional Ad' : 'Create New Promotional Ad'}
                  </h3>
                  <p className="text-[10px] text-zinc-400">Set ad copy, placement, visual color theme, and user action flow.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editingAd && (
              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Views / Impressions</span>
                  <span className="font-mono font-black text-white text-sm">{(editingAd.viewCount || 0).toLocaleString()}</span>
                </div>
                <div className="border-x border-zinc-850">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Clicks</span>
                  <span className="font-mono font-black text-amber-400 text-sm">{(editingAd.clickCount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Conversion Rate</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {editingAd.viewCount && editingAd.viewCount > 0 
                      ? `${(((editingAd.clickCount || 0) / editingAd.viewCount) * 100).toFixed(1)}%` 
                      : '0.0%'}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title & Placement */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Headline / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VIP Alpha: Don Wilson +6.4% Daily"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Placement *</label>
                  <select
                    value={form.placement}
                    onChange={(e) => setForm({ ...form, placement: e.target.value as AdPlacement })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="CAROUSEL">In-App Carousel (Top)</option>
                    <option value="POPUP">Modal Popup (On Launch)</option>
                    <option value="BANNER">Static Banner</option>
                  </select>
                </div>
              </div>

              {/* Subtitle / Short Pitch */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Subtitle / Short Hook</label>
                <input
                  type="text"
                  placeholder="e.g. Automate high-frequency crypto momentum trading."
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Full Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Full Promo Body Description</label>
                <textarea
                  rows={2}
                  placeholder="Provide details of the opportunity (shown in popups and extended cards)..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Action Type & CTA Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Action Destination *</label>
                  <select
                    value={form.actionType}
                    onChange={(e) => setForm({ ...form, actionType: e.target.value as AdActionType })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="EARN">📈 Earn / Copy Trading Tab</option>
                    <option value="DEPOSIT">💳 Deposit / Add Funds Modal</option>
                    <option value="REFERRALS">🎁 Referrals & Signal Passes Tab</option>
                    <option value="BOTS">🤖 AI Trading Bots Tab</option>
                    <option value="UPGRADE">⚡ Contract Upgrade Modal</option>
                    <option value="EXTERNAL_LINK">🔗 External Link (Enter URL below)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Button CTA Text *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Explore VIP Experts"
                    value={form.ctaText}
                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>

              {form.actionType === 'EXTERNAL_LINK' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">External URL *</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.actionUrl}
                    onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Badge & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Badge Text</label>
                  <input
                    type="text"
                    placeholder="HOT ALPHA 🔥"
                    value={form.badgeText}
                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-amber-400 focus:outline-none focus:border-amber-500 font-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Icon</label>
                  <select
                    value={form.iconName}
                    onChange={(e) => setForm({ ...form, iconName: e.target.value })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {ICON_OPTIONS.map((ico) => (
                      <option key={ico.value} value={ico.value}>{ico.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Priority (Order)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Color Gradient Theme Preset */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Background Theme Preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GRADIENT_PRESETS.map((grad) => (
                    <button
                      key={grad.value}
                      type="button"
                      onClick={() => setForm({ ...form, bgGradient: grad.value })}
                      className={`p-2.5 rounded-xl border text-left text-[11px] font-bold transition-all cursor-pointer bg-gradient-to-r ${grad.value} text-white shadow-xs ${
                        form.bgGradient === grad.value ? 'ring-2 ring-amber-400 border-white' : 'border-zinc-800 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {grad.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ad-is-active-check"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="ad-is-active-check" className="text-xs text-zinc-300 font-bold cursor-pointer">
                  Ad Active (Immediately visible in user applications)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} strokeWidth={3} />
                  <span>{editingAd ? 'Save Ad Changes' : 'Create Promotional Ad'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
