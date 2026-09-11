import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InAppAd } from '../types';
import { 
  TrendingUp, Gift, Zap, Sparkles, ArrowRight, ChevronLeft, ChevronRight,
  Flame, Award, Bot, DollarSign, ExternalLink, ShieldCheck, Tag, X
} from 'lucide-react';

interface InAppAdsCarouselProps {
  ads: InAppAd[];
  isLightTheme?: boolean;
  onAdAction: (ad: InAppAd) => void;
}

export const InAppAdsCarousel: React.FC<InAppAdsCarouselProps> = ({
  ads,
  isLightTheme = false,
  onAdAction
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const activeAds = ads
    .filter(a => a.isActive && (a.placement === 'CAROUSEL' || a.placement === 'BANNER'))
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  useEffect(() => {
    if (activeAds.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeAds.length);
    }, 6000); // 6 seconds auto-slide

    return () => clearInterval(timer);
  }, [activeAds.length, isPaused]);

  if (activeAds.length === 0) return null;

  const currentAd = activeAds[currentIndex] || activeAds[0];

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'TrendingUp': return <TrendingUp size={16} />;
      case 'Gift': return <Gift size={16} />;
      case 'Zap': return <Zap size={16} />;
      case 'Sparkles': return <Sparkles size={16} />;
      case 'Flame': return <Flame size={16} />;
      case 'Award': return <Award size={16} />;
      case 'Bot': return <Bot size={16} />;
      case 'DollarSign': return <DollarSign size={16} />;
      default: return <Sparkles size={16} />;
    }
  };

  const getBadgeBg = (badgeColor?: string) => {
    switch (badgeColor) {
      case 'amber': return 'bg-amber-400 text-slate-950';
      case 'emerald': return 'bg-emerald-400 text-slate-950';
      case 'blue': return 'bg-blue-400 text-slate-950';
      case 'purple': return 'bg-purple-300 text-slate-950';
      case 'rose': return 'bg-rose-400 text-slate-950';
      default: return 'bg-amber-400 text-slate-950';
    }
  };

  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % activeAds.length);
  };

  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + activeAds.length) % activeAds.length);
  };

  return (
    <div 
      id="in-app-promotional-carousel"
      className="relative w-full rounded-2xl overflow-hidden select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentAd.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={() => onAdAction(currentAd)}
          className={`relative w-full p-4 sm:p-5 rounded-2xl cursor-pointer overflow-hidden border shadow-sm transition-all active:scale-[0.99] ${
            currentAd.bgGradient 
              ? `bg-gradient-to-r ${currentAd.bgGradient}` 
              : 'bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-800'
          } border-white/10 text-white`}
        >
          {/* Subtle Light Flare Background */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-8 w-28 h-28 bg-black/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            
            {/* Left Content */}
            <div className="space-y-1.5 flex-1 min-w-0 pr-6 sm:pr-0">
              {/* Badge & Tag */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-xs ${getBadgeBg(currentAd.badgeColor)}`}>
                  {getIcon(currentAd.iconName)}
                  <span>{currentAd.badgeText || 'SPECIAL OFFER'}</span>
                </span>

                <span className="text-[9px] text-white/70 font-semibold uppercase tracking-wider hidden xs:inline-block">
                  Earn More
                </span>
              </div>

              {/* Headline */}
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white line-clamp-1">
                {currentAd.title}
              </h3>

              {/* Subtitle / Description */}
              <p className="text-[11px] sm:text-xs text-white/90 leading-relaxed line-clamp-2 max-w-xl font-medium">
                {currentAd.subtitle || currentAd.description}
              </p>
            </div>

            {/* Right Action CTA Button */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 shrink-0">
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-black shadow-md border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider group-hover:border-amber-400"
              >
                <span>{currentAd.ctaText || 'Learn More'}</span>
                <ArrowRight size={13} strokeWidth={3} className="text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide Navigation Dots & Arrows (if multiple ads) */}
      {activeAds.length > 1 && (
        <div className="absolute bottom-2 right-3 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/10">
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous promo"
            className="text-white/70 hover:text-white transition-colors cursor-pointer p-0.5"
          >
            <ChevronLeft size={12} />
          </button>

          <div className="flex items-center gap-1 px-1">
            {activeAds.map((_, idx) => (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next promo"
            className="text-white/70 hover:text-white transition-colors cursor-pointer p-0.5"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
