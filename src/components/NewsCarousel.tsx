import React, { useState, useEffect, useMemo } from 'react';
import { CryptoPrice, ReferralDepositConfig } from '../types';
import { ChevronLeft, ChevronRight, Gift, Users } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const FALLBACK_CRYPTO = [
  { name: 'Bitcoin', symbol: 'BTC', price: 94250.30, change24h: 3.45 },
  { name: 'Ethereum', symbol: 'ETH', price: 3480.12, change24h: 1.82 },
  { name: 'Solana', symbol: 'SOL', price: 184.45, change24h: -2.15 },
  { name: 'Binance Coin', symbol: 'BNB', price: 592.20, change24h: 0.95 },
  { name: 'XRP', symbol: 'XRP', price: 2.54, change24h: 4.12 }
];

interface NewsCarouselProps {
  cryptoPrices?: CryptoPrice[];
}

export default function NewsCarousel({ cryptoPrices = FALLBACK_CRYPTO }: NewsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [refConfig, setRefConfig] = useState<ReferralDepositConfig | null>(null);

  // Subscribe to live referral deposit config from Firestore backend
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'referral_deposit_config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ReferralDepositConfig;
        if (data.tiers && data.tiers.length > 0) {
          setRefConfig(data);
        }
      }
    }, (err) => {
      console.error('Error subscribing to referral config in NewsCarousel:', err);
    });
    return () => unsub();
  }, []);

  const tiers = useMemo(() => {
    if (refConfig && refConfig.tiers && refConfig.tiers.length > 0) {
      return refConfig.tiers;
    }
    // Default fallback bonus tiers if not yet set in backend settings
    return [
      { id: 't1', minAmount: 10, maxAmount: 99.99, refereePercent: 4, referrerPercent: 4 },
      { id: 't2', minAmount: 100, maxAmount: 499.99, refereePercent: 5, referrerPercent: 5 },
      { id: 't3', minAmount: 500, maxAmount: 10000, refereePercent: 6, referrerPercent: 6 }
    ];
  }, [refConfig]);

  const [brandImgSrc, setBrandImgSrc] = useState<string>('/morexpage.png');

  // Generate 5 dynamic slides
  const slides = useMemo(() => {
    const today = new Date();
    const daySeed = today.getFullYear() * 372 + today.getMonth() * 31 + today.getDate();

    return [
      {
        id: `slide-brand-${daySeed}`,
        type: 'brand',
        title: '',
        subtitle: '',
        source: 'CME Global Command Center',
        time: 'Live View',
        image: brandImgSrc,
        fallbackImage: '/morex_slide_brand.svg',
        badgeTag: 'CME Brand'
      },
      {
        id: `slide-deposit-bonus-${daySeed}`,
        type: 'deposit_bonus',
        title: 'First Deposit Welcome Bonus Badges',
        subtitle: 'Fund your wallet to unlock instant cash rewards credited upon deposit.',
        source: 'CME Deposit Promotion',
        time: 'Active Offer',
        image: '/morex_slide_deposit_bonus.svg',
        badgeTag: '1st Deposit Bonus'
      },
      {
        id: `slide-referral-bonus-${daySeed}`,
        type: 'referral_bonus',
        title: 'Referee First Deposit Commission Badges',
        subtitle: 'Invite friends to CME and receive direct cash commissions.',
        source: 'CME Partner Program',
        time: 'Referral Rewards',
        image: '/morex_slide_referral_bonus.svg',
        badgeTag: 'Referral Commission'
      },
      {
        id: `slide-bot-logic-${daySeed}`,
        type: 'bot_logic',
        title: '',
        subtitle: '',
        source: 'CME Quant Bot Engine',
        time: '24/7 Active',
        image: '/morex_slide_bot_logic.svg',
        badgeTag: 'Bot Trading Logic'
      },
      {
        id: `slide-copy-trading-${daySeed}`,
        type: 'copy_trading',
        title: 'Verified Copy Trader Lead Experts',
        subtitle: 'Follow top expert traders and automatically copy high-accuracy market signals.',
        source: 'CME Copy Trading Engine',
        time: 'Live Copy Trading',
        image: '/morex_slide_signals_logic.svg',
        badgeTag: 'Copy Trading'
      }
    ];
  }, [brandImgSrc]);

  // Slideshow auto advance interval
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  const activeSlide = slides[activeIndex] || slides[0];
  const isBadgeOverlaySlide = activeSlide.type === 'deposit_bonus' || activeSlide.type === 'referral_bonus';

  return (
    <div id="news-carousel-container" className="relative w-full max-w-xl mx-auto overflow-hidden rounded-2xl bg-zinc-950 border border-emerald-500/30 text-white shadow-2xl aspect-[3/1] min-h-[140px] xs:min-h-[160px] sm:min-h-[180px] flex flex-col justify-center">
      {/* Image Banner Background */}
      <img
        key={activeSlide.id}
        src={activeSlide.image}
        alt={activeSlide.badgeTag || 'CME Slide'}
        onError={(e) => {
          if (activeSlide.type === 'brand' && brandImgSrc !== '/morex_slide_brand.svg') {
            setBrandImgSrc('/morex_slide_brand.svg');
          } else if (activeSlide.fallbackImage) {
            e.currentTarget.src = activeSlide.fallbackImage;
          }
        }}
        className="absolute inset-0 w-full h-full object-contain sm:object-cover object-center transition-all duration-700 ease-in-out"
        style={{ 
          filter: isBadgeOverlaySlide ? 'brightness(0.32) contrast(1.15)' : 'brightness(1.0) contrast(1.05)'
        }}
      />

      {/* Dark gradient backdrop overlay for text/badge readability */}
      {isBadgeOverlaySlide && (
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/80 to-zinc-950/60 pointer-events-none" />
      )}

      {/* FLOATING SIDE NAVIGATION ARROWS */}
      <button 
        id="carousel-prev"
        onClick={handlePrev}
        className="absolute left-1.5 sm:left-2.5 top-1/2 -translate-y-1/2 z-20 p-1 sm:p-1.5 rounded-full bg-zinc-950/80 border border-emerald-500/35 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900/90 hover:scale-105 active:scale-95 transition-all backdrop-blur-md shadow-lg cursor-pointer"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      <button 
        id="carousel-next"
        onClick={handleNext}
        className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 z-20 p-1 sm:p-1.5 rounded-full bg-zinc-950/80 border border-emerald-500/35 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900/90 hover:scale-105 active:scale-95 transition-all backdrop-blur-md shadow-lg cursor-pointer"
        aria-label="Next slide"
      >
        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* DYNAMIC BADGES OVERLAY (FOR DEPOSIT BONUS & REFERRAL COMMISSION SLIDES) */}
      {activeSlide.type === 'deposit_bonus' && (
        <div className="relative z-10 px-6 xs:px-8 sm:px-12 py-2 sm:py-3 pb-5 sm:pb-6 select-none flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
            <Gift className="text-[#80D824] shrink-0 w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold text-[#80D824] uppercase tracking-widest truncate">
              FIRST DEPOSIT REWARDS
            </span>
          </div>
          <h3 className="text-[11px] xs:text-xs sm:text-sm font-extrabold text-white tracking-tight leading-snug truncate">
            {activeSlide.title}
          </h3>
          <p className="text-[9px] xs:text-[10px] sm:text-xs text-zinc-300/90 font-medium mb-1.5 sm:mb-2.5 line-clamp-1 sm:line-clamp-2">
            {activeSlide.subtitle}
          </p>

          {/* Dynamic Badges from Backend */}
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {tiers.map((t, idx) => (
              <div key={t.id || idx} className="bg-zinc-900/90 border border-emerald-500/40 rounded-lg sm:rounded-xl p-1 sm:p-2 text-center backdrop-blur-md shadow-lg flex flex-col justify-between hover:border-emerald-400/70 transition-colors min-w-0">
                <span className="block text-[7px] xs:text-[8px] sm:text-[9px] text-zinc-300 font-bold uppercase tracking-wider truncate">
                  DEP ${t.minAmount} – {t.maxAmount >= 9999 ? 'MAX' : `$${t.maxAmount}`}
                </span>
                <span className="block text-[10px] xs:text-xs sm:text-sm font-black text-[#80D824] font-mono mt-0.5 leading-none">
                  +{t.refereePercent}% Cash
                </span>
                <span className="block text-[7px] xs:text-[8px] text-emerald-300/80 font-semibold mt-0.5 truncate">
                  Welcome Bonus
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSlide.type === 'referral_bonus' && (
        <div className="relative z-10 px-6 xs:px-8 sm:px-12 py-2 sm:py-3 pb-5 sm:pb-6 select-none flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
            <Users className="text-[#80D824] shrink-0 w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold text-[#80D824] uppercase tracking-widest truncate">
              PARTNER PROGRAM
            </span>
          </div>
          <h3 className="text-[11px] xs:text-xs sm:text-sm font-extrabold text-white tracking-tight leading-snug truncate">
            {activeSlide.title}
          </h3>
          <p className="text-[9px] xs:text-[10px] sm:text-xs text-zinc-300/90 font-medium mb-1.5 sm:mb-2.5 line-clamp-1 sm:line-clamp-2">
            {activeSlide.subtitle}
          </p>

          {/* Dynamic Badges from Backend */}
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {tiers.map((t, idx) => (
              <div key={t.id || idx} className="bg-zinc-900/90 border border-emerald-500/40 rounded-lg sm:rounded-xl p-1 sm:p-2 text-center backdrop-blur-md shadow-lg flex flex-col justify-between hover:border-emerald-400/70 transition-colors min-w-0">
                <span className="block text-[7px] xs:text-[8px] sm:text-[9px] text-zinc-300 font-bold uppercase tracking-wider truncate">
                  REF DEP ${t.minAmount} – {t.maxAmount >= 9999 ? 'MAX' : `$${t.maxAmount}`}
                </span>
                <span className="block text-[10px] xs:text-xs sm:text-sm font-black text-[#80D824] font-mono mt-0.5 leading-none">
                  +{t.referrerPercent}% Commission
                </span>
                <span className="block text-[7px] xs:text-[8px] text-emerald-300/80 font-semibold mt-0.5 truncate">
                  Direct Cash
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLOATING SUBTLE DOTS OVERLAY */}
      <div className="absolute bottom-1.5 sm:bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full bg-zinc-950/70 border border-emerald-500/20 backdrop-blur-sm">
        {slides.map((_, idx) => (
          <button
            key={idx}
            id={`carousel-dot-${idx}`}
            onClick={() => setActiveIndex(idx)}
            className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              idx === activeIndex 
                ? 'w-4 sm:w-5 bg-gradient-to-r from-[#80D824] to-[#008B47] shadow-sm shadow-emerald-500/50' 
                : 'w-1 sm:w-1.5 bg-zinc-600/80 hover:bg-zinc-400'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
