import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InAppAd } from '../types';
import { 
  X, Sparkles, TrendingUp, Gift, Zap, ArrowRight, ShieldCheck,
  CheckCircle2, DollarSign
} from 'lucide-react';

interface InAppAdPopupModalProps {
  ad: InAppAd | null;
  onClose: (dontShowToday?: boolean) => void;
  onAdAction: (ad: InAppAd) => void;
}

export const InAppAdPopupModal: React.FC<InAppAdPopupModalProps> = ({
  ad,
  onClose,
  onAdAction
}) => {
  const [dontShowAgainToday, setDontShowAgainToday] = React.useState(false);

  if (!ad) return null;

  const handleClose = () => {
    onClose(dontShowAgainToday);
  };

  const handleAction = () => {
    onAdAction(ad);
    onClose(true); // dismiss popup on click
  };

  return (
    <AnimatePresence>
      <div 
        id="in-app-ad-popup-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl space-y-0"
        >
          {/* Top Hero Banner */}
          <div className={`relative p-6 ${ad.bgGradient ? `bg-gradient-to-br ${ad.bgGradient}` : 'bg-gradient-to-br from-amber-600 via-amber-700 to-yellow-800'} text-white overflow-hidden`}>
            {/* Ambient Background Flare */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-black/30 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-all cursor-pointer z-10"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>

            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-white/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-3">
              <Sparkles size={12} className="text-amber-400" />
              <span>{ad.badgeText || 'SPECIAL OPPORTUNITY'}</span>
            </div>

            <h2 className="text-xl font-black tracking-tight leading-tight text-white drop-shadow-xs">
              {ad.title}
            </h2>

            {ad.subtitle && (
              <p className="text-xs text-white/90 font-medium mt-1.5 leading-relaxed">
                {ad.subtitle}
              </p>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4 bg-slate-900 text-zinc-200">
            {ad.description && (
              <p className="text-xs text-zinc-300 leading-relaxed">
                {ad.description}
              </p>
            )}

            {/* Key Opportunity Highlights */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Verified Automated Trading Pipelines</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                <ShieldCheck size={14} className="shrink-0" />
                <span>Capital Protection & Instant 1-Click Execution</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleAction}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>{ad.ctaText || 'Claim Opportunity'}</span>
                <ArrowRight size={14} strokeWidth={3} />
              </button>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-[11px] text-zinc-400 hover:text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontShowAgainToday}
                    onChange={(e) => setDontShowAgainToday(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Don't show this again today</span>
                </label>

                <button
                  type="button"
                  onClick={handleClose}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
