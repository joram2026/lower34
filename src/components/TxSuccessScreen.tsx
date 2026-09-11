import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, Check, Sparkles, PartyPopper, Zap, Clock } from 'lucide-react';

interface TxSuccessScreenProps {
  message?: string;
  onBack: () => void;
}

export const TxSuccessScreen: React.FC<TxSuccessScreenProps> = ({ message, onBack }) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; delay: number }>>([]);

  useEffect(() => {
    // Generate celebratory confetti/sparkle particles around the checkmark
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#fbbf24'];
    const newParticles = Array.from({ length: 18 }).map((_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const distance = 60 + Math.random() * 70;
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color: colors[i % colors.length],
        size: 6 + Math.random() * 6,
        delay: 0.1 + Math.random() * 0.2,
      };
    });
    setParticles(newParticles);
  }, []);

  return (
    <div id="success-screen-container" className="min-h-screen max-w-md mx-auto flex flex-col items-center justify-center p-6 bg-[#EBF9F0] text-center font-sans relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-tr from-[#008B47]/20 via-[#F4E100]/20 to-emerald-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Lottie-style Animated Success Icon Badge with Particles */}
      <div className="relative flex items-center justify-center my-6">
        {/* Outer Pulsing Aura Rings */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.8, 1.4, 1.2], opacity: [0, 0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          className="absolute w-32 h-32 rounded-full bg-emerald-500/20 border border-emerald-500/40 pointer-events-none"
        />

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.8, 1.6, 1.3], opacity: [0, 0.25, 0] }}
          transition={{ duration: 2.2, delay: 0.4, repeat: Infinity, ease: 'easeOut' }}
          className="absolute w-36 h-36 rounded-full bg-amber-500/20 border border-amber-500/30 pointer-events-none"
        />

        {/* Bursting Confetti / Sparkle Particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.2, 0.8, 0],
              opacity: [0, 1, 0.9, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 1.2,
              delay: p.delay,
              ease: [0.175, 0.885, 0.32, 1.275],
            }}
            style={{
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
            }}
            className="absolute rounded-full shadow-xs pointer-events-none z-10"
          />
        ))}

        {/* Central Success Circle Container */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 18,
            delay: 0.05,
          }}
          className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-amber-400 p-1 shadow-xl shadow-emerald-500/20 flex items-center justify-center z-20"
        >
          {/* Inner ring */}
          <div className="w-full h-full rounded-full bg-emerald-950/20 border border-white/40 backdrop-blur-xs flex items-center justify-center relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12"
            />

            {/* Scale-in Checkmark */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: 'backOut' }}
              className="text-white drop-shadow-md flex items-center justify-center"
            >
              <Check className="w-12 h-12 stroke-[3.5]" />
            </motion.div>
          </div>

          {/* Floating Sparkle Accent */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1], rotate: [0, 15, 0] }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-1.5 rounded-full border-2 border-white shadow-md z-30"
          >
            <Sparkles size={14} className="fill-amber-950" />
          </motion.div>
        </motion.div>
      </div>

      {/* Main Heading with Staggered Entrance */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="space-y-2 mt-2 z-10"
      >
        <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 border border-emerald-300/60 px-3 py-1 rounded-full w-fit mx-auto">
          <PartyPopper size={13} className="text-emerald-600" />
          <span>Success Confirmed</span>
        </div>

        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
          Request Submitted!
        </h2>
        
        <p className="text-xs font-medium text-zinc-600 max-w-xs mx-auto leading-relaxed">
          {message || 'Your transaction request has been successfully created and queued for automated processing.'}
        </p>
      </motion.div>

      {/* Transaction Details & Security Escrow Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full bg-white/90 backdrop-blur-md border border-amber-200/80 p-4 rounded-2xl text-left space-y-3 mt-6 shadow-sm z-10"
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-700">Live Status</span>
          </div>
          <span className="text-[11px] font-bold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            In Escrow Queue
          </span>
        </div>

        <div className="flex items-start gap-2.5 text-[11px] text-zinc-600 leading-normal">
          <ShieldCheck size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong>Escrow Protection:</strong> Your funds remain fully protected. Standard verification takes between <strong>1 to 5 minutes</strong> during trading windows.
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500 pt-1 font-mono">
          <Clock size={12} className="text-amber-600" />
          <span>Track progress in your Wallet history tab anytime</span>
        </div>
      </motion.div>

      {/* Primary Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="w-full mt-7 z-10"
      >
        <button
          id="back-to-wallet-dashboard"
          onClick={onBack}
          className="w-full relative group overflow-hidden flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
        >
          {/* Shimmer animation on button hover */}
          <div className="absolute inset-0 w-1/2 h-full bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out" />
          
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span>Back to Wallet Dashboard</span>
        </button>
      </motion.div>

    </div>
  );
};

export default TxSuccessScreen;
