import React from 'react';
import { motion } from 'motion/react';
import { Clock, Pause, CheckCircle2, Zap } from 'lucide-react';
import { TradingPairBadge, getTradingPairConfig } from '../utils/pairUtils';

interface HourglassProgressProps {
  tradingPair?: string;
  progressPercent: number; // 0 to 100
  remainingSeconds: number;
  durationSeconds: number;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'OFFLINE';
  isLightTheme: boolean;
  isOffline?: boolean;
}

/* GLOWING CIRCULAR COUNTDOWN TIMER (MATCHING USER'S IMAGE 1) */
const GlowingCircleTimer: React.FC<{
  remainingSeconds: number;
  durationSeconds: number;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'OFFLINE';
  isOffline?: boolean;
}> = ({ remainingSeconds, durationSeconds, status, isOffline }) => {
  const isOfflineState = isOffline || status === 'OFFLINE';
  const isUrgent = !isOfflineState && remainingSeconds <= 10;
  const isPaused = status === 'PAUSED';
  
  // Progress ratio (1 to 0)
  const ratio = isOfflineState ? 0 : (durationSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / durationSeconds)) : 0);
  
  // SVG Circle math
  const size = 76; // SVG box size
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2; // 33
  const circumference = 2 * Math.PI * radius; // ~207.3
  const strokeDashoffset = circumference * (1 - ratio);

  // Dynamic Glow styling tailored for light and dark themes
  const glowShadow = isOfflineState
    ? '0 0 16px rgba(244, 63, 94, 0.4), inset 0 0 8px rgba(244, 63, 94, 0.2)'
    : isUrgent
      ? '0 0 16px rgba(239, 68, 68, 0.5), inset 0 0 8px rgba(239, 68, 68, 0.3)'
      : isPaused
        ? '0 0 16px rgba(217, 119, 6, 0.45)'
        : '0 0 18px rgba(234, 179, 8, 0.5), inset 0 0 10px rgba(234, 179, 8, 0.3)';

  const activeColor = isOfflineState ? '#f43f5e' : isUrgent ? '#ef4444' : isPaused ? '#d97706' : '#eab308';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0 my-1">
      {/* Outer Glowing Halo Circle with Pitch Black Core */}
      <div 
        className="w-[72px] h-[72px] sm:w-[82px] sm:h-[82px] rounded-full bg-[#050811] relative flex items-center justify-center transition-all duration-300 ring-2 ring-amber-400/40"
        style={{ boxShadow: glowShadow }}
      >
        {/* SVG Circular Ring */}
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full -rotate-90 transform overflow-visible"
        >
          {/* Subtle Ambient Gold Glow Path */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={activeColor}
            strokeWidth={strokeWidth + 2}
            fill="none"
            opacity="0.25"
            className="blur-[2px]"
          />

          {/* Thick Solid White Inner Ring (as in Image 1) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Animated Gold Arc Overlay */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center Number Text (Black background maintained) */}
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <span className={`font-sans font-black text-white select-none tracking-tight ${
            status === 'PAUSED'
              ? 'text-[10px] sm:text-xs text-amber-300 uppercase tracking-widest font-mono'
              : remainingSeconds >= 100
                ? 'text-xl sm:text-2xl'
                : 'text-2xl sm:text-3xl'
          }`}>
            {status === 'PAUSED' ? 'PAUSED' : remainingSeconds}
          </span>
        </div>
      </div>
    </div>
  );
};

export const HourglassProgress: React.FC<HourglassProgressProps> = ({
  tradingPair = 'XAU/USD',
  progressPercent,
  remainingSeconds,
  durationSeconds,
  status,
  isLightTheme,
  isOffline,
}) => {
  const clampProgress = Math.min(100, Math.max(0, progressPercent));
  const isPaused = status === 'PAUSED';
  const isCompleted = clampProgress >= 100 || remainingSeconds <= 0;

  // Calculate top & bottom sand heights
  const topRatio = (100 - clampProgress) / 100;
  const topSandY = 84 - topRatio * 60;

  const bottomRatio = clampProgress / 100;
  const bottomSandY = 156 - bottomRatio * 60;

  return (
    <div className={`w-full rounded-3xl border transition-all duration-300 relative overflow-hidden select-none shadow-xl ${
      isLightTheme
        ? 'bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20 border-amber-200/80 shadow-amber-500/5'
        : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-black/60'
    }`}>
      {/* Top Gold Accent Gradient Line */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${
        isLightTheme ? 'from-amber-400 via-yellow-400 to-amber-500' : 'from-amber-600 via-yellow-400 to-amber-500'
      }`} />

      {/* Main Grid Card Content - 2-Column layout on ALL screen sizes */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-12 gap-2 sm:gap-6 items-center">
          
          {/* LEFT COLUMN: Trade Closes In + Trading Pair */}
          <div className="col-span-7 flex flex-col justify-between space-y-3 sm:space-y-5 pr-1">
            
            {/* TOP BLOCK: Trade Closes In */}
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                {/* Double Ring Circle Icon (from blueprint) */}
                <div className={`relative w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center p-0.5 border-2 shrink-0 shadow-xs ${
                  remainingSeconds <= 10
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500 animate-pulse'
                    : isLightTheme 
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-600' 
                      : 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                }`}>
                  <div className={`w-full h-full rounded-full border border-dashed flex items-center justify-center ${
                    remainingSeconds <= 10
                      ? 'border-rose-400'
                      : 'border-amber-400'
                  }`}>
                    <Clock size={12} className={`sm:hidden ${remainingSeconds <= 10 ? 'animate-bounce' : ''}`} />
                    <Clock size={14} className={`hidden sm:block ${remainingSeconds <= 10 ? 'animate-bounce' : ''}`} />
                  </div>
                </div>

                <span className={`text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider ${
                  isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  Trade Closes In
                </span>
              </div>

              {/* Glowing Neon Countdown Circle (Black center maintained) */}
              <div className="flex items-center gap-2.5 sm:gap-3 py-1">
                <GlowingCircleTimer
                  remainingSeconds={remainingSeconds}
                  durationSeconds={durationSeconds}
                  status={status}
                  isOffline={isOffline}
                />

                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      status === 'OFFLINE' || isOffline
                        ? 'bg-rose-500'
                        : isPaused 
                          ? 'bg-amber-500' 
                          : remainingSeconds <= 10 
                            ? 'bg-rose-500 animate-ping' 
                            : 'bg-amber-400 animate-pulse'
                    }`} />
                    <span className={`text-[10px] sm:text-xs font-mono font-bold uppercase ${
                      status === 'OFFLINE' || isOffline ? 'text-rose-500 font-black' : isLightTheme ? 'text-zinc-700' : 'text-zinc-200'
                    }`}>
                      {status === 'OFFLINE' || isOffline ? 'OFFLINE (0s)' : isPaused ? 'Paused' : isCompleted ? 'Completed' : `${clampProgress.toFixed(0)}%`}
                    </span>
                  </div>
                  <span className={`text-[9px] sm:text-[10px] font-mono mt-0.5 ${
                    isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    {status === 'OFFLINE' || isOffline ? 'Offline rate active' : `${durationSeconds}s duration`}
                  </span>
                </div>
              </div>
            </div>

            {/* BOTTOM BLOCK: Trading Pair */}
            <div className="pt-2 border-t border-dashed border-amber-200/80 dark:border-slate-800">
              <span className={`text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider block mb-1.5 ${
                isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                Trading Pair
              </span>

              <div className="inline-block">
                <TradingPairBadge pair={tradingPair} isLightTheme={isLightTheme} size="md" showName />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Vertical Animated Hourglass Sand Glass */}
          <div className="col-span-5 flex flex-col items-center justify-center relative">
            {/* Soft Ambient Radial Glow */}
            <div className={`absolute w-24 h-24 sm:w-36 sm:h-36 rounded-full blur-2xl pointer-events-none opacity-25 ${
              remainingSeconds <= 10
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`} />

            {/* Animated Hourglass Graphic */}
            <motion.div 
              className="relative flex items-center justify-center py-1 z-10 w-full"
              animate={
                isCompleted 
                  ? { rotate: 180 }
                  : status === 'RUNNING' 
                    ? { rotate: [0, 360] } 
                    : { rotate: 0 }
              }
              transition={
                isCompleted
                  ? { duration: 0.8, ease: "easeInOut" }
                  : status === 'RUNNING'
                    ? { duration: 6, ease: "linear", repeat: Infinity }
                    : { duration: 0.5 }
              }
            >
              <svg viewBox="0 0 120 180" className="w-[105px] h-[145px] sm:w-[130px] sm:h-[175px] drop-shadow-xl overflow-visible">
                <defs>
                  {/* Wooden Frame Gradients */}
                  <linearGradient id="woodPlateGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#78350F" />
                    <stop offset="30%" stopColor="#B45309" />
                    <stop offset="50%" stopColor="#D97706" />
                    <stop offset="70%" stopColor="#B45309" />
                    <stop offset="100%" stopColor="#78350F" />
                  </linearGradient>

                  <linearGradient id="woodColumnGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#451A03" />
                    <stop offset="40%" stopColor="#B45309" />
                    <stop offset="100%" stopColor="#78350F" />
                  </linearGradient>

                  <linearGradient id="goldBrassGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="50%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                  </linearGradient>

                  {/* Sand Gradient */}
                  <linearGradient id="goldenSandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="50%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                  </linearGradient>

                  <radialGradient id="sandMoundGrad" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="60%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#A16207" />
                  </radialGradient>

                  {/* Glass Reflection Gradient */}
                  <linearGradient id="glassReflection" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                    <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.25" />
                  </linearGradient>

                  {/* Glass Chamber Mask */}
                  <clipPath id="topBulbClip">
                    <path d="M 28 24 L 92 24 C 92 52, 68 80, 63 85 C 57 80, 28 52, 28 24 Z" />
                  </clipPath>

                  <clipPath id="bottomBulbClip">
                    <path d="M 63 95 C 68 100, 92 128, 92 156 L 28 156 C 28 128, 52 100, 57 95 Z" />
                  </clipPath>
                </defs>

                {/* Back Wooden Columns */}
                <rect x="18" y="16" width="8" height="148" rx="4" fill="url(#woodColumnGrad)" opacity="0.6" />
                <rect x="94" y="16" width="8" height="148" rx="4" fill="url(#woodColumnGrad)" opacity="0.6" />

                {/* Glass Chamber Inner Glow */}
                <path 
                  d="M 28 24 L 92 24 C 92 52, 68 80, 63 85 L 63 95 C 68 100, 92 128, 92 156 L 28 156 C 28 128, 52 100, 57 95 L 57 85 Z" 
                  fill={isLightTheme ? "rgba(255, 255, 255, 0.4)" : "rgba(15, 23, 42, 0.6)"}
                  stroke={isLightTheme ? "rgba(217, 119, 6, 0.3)" : "rgba(52, 211, 153, 0.3)"}
                  strokeWidth="1.5"
                />

                {/* TOP BULB SAND FILL */}
                <g clipPath="url(#topBulbClip)">
                  <rect 
                    x="20" 
                    y={topSandY} 
                    width="80" 
                    height="70" 
                    fill="url(#goldenSandGrad)" 
                    className="transition-all duration-300 ease-linear"
                  />
                  {topRatio > 0 && (
                    <ellipse 
                      cx="60" 
                      cy={topSandY} 
                      rx={Math.max(0, 32 * topRatio)} 
                      ry={Math.max(0, 5 * topRatio)} 
                      fill="#FEF08A" 
                      className="transition-all duration-300 ease-linear"
                    />
                  )}
                </g>

                {/* BOTTOM BULB SAND FILL */}
                <g clipPath="url(#bottomBulbClip)">
                  {bottomRatio > 0 && (
                    <path
                      d={`M 28 156 L 92 156 Q 60 ${bottomSandY + 12}, 28 156 Z`}
                      fill="url(#sandMoundGrad)"
                      className="transition-all duration-300 ease-linear"
                    />
                  )}
                  {bottomRatio > 0 && (
                    <path
                      d={`M ${60 - 28 * bottomRatio} 156 Q 60 ${bottomSandY - 6}, ${60 + 28 * bottomRatio} 156 Z`}
                      fill="#FEF08A"
                      className="transition-all duration-300 ease-linear"
                    />
                  )}
                </g>

                {/* TRICKLING SAND STREAM */}
                {!isPaused && !isCompleted && topRatio > 0 && (
                  <g>
                    <line 
                      x1="60" 
                      y1={Math.max(topSandY, 78)} 
                      x2="60" 
                      y2={Math.min(bottomSandY + 4, 154)} 
                      stroke="#FDE047" 
                      strokeWidth="2.5" 
                      strokeDasharray="4 2"
                      className="animate-pulse"
                    />
                    <line 
                      x1="60" 
                      y1="82" 
                      x2="60" 
                      y2="148" 
                      stroke="#CA8A04" 
                      strokeWidth="1" 
                    />

                    {/* Animated Falling Sand Grains */}
                    <circle cx="60" cy="86" r="1.5" fill="#FFF">
                      <animate attributeName="cy" values="84;148" dur="0.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0.2" dur="0.6s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="59" cy="95" r="1.2" fill="#FDE047">
                      <animate attributeName="cy" values="84;148" dur="0.8s" begin="0.2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="61" cy="90" r="1.2" fill="#FEF08A">
                      <animate attributeName="cy" values="84;148" dur="0.7s" begin="0.4s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {/* Glass Highlights */}
                <path 
                  d="M 32 28 C 32 45, 52 70, 56 82 C 52 94, 32 120, 32 152" 
                  stroke="url(#glassReflection)" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  fill="none" 
                />
                <path 
                  d="M 88 28 C 88 45, 68 70, 64 82 C 68 94, 88 120, 88 152" 
                  stroke="url(#glassReflection)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  fill="none" 
                  opacity="0.6"
                />

                {/* Brass Rings */}
                <rect x="25" y="20" width="70" height="4" rx="2" fill="url(#goldBrassGrad)" />
                <rect x="25" y="156" width="70" height="4" rx="2" fill="url(#goldBrassGrad)" />

                {/* Front Turned Columns */}
                <g>
                  <rect x="12" y="16" width="10" height="148" rx="5" fill="url(#woodColumnGrad)" stroke="#451A03" strokeWidth="0.5" />
                  <rect x="10" y="20" width="14" height="6" rx="2" fill="url(#goldBrassGrad)" />
                  <rect x="10" y="154" width="14" height="6" rx="2" fill="url(#goldBrassGrad)" />
                  <circle cx="17" cy="90" r="6" fill="url(#woodColumnGrad)" stroke="url(#goldBrassGrad)" strokeWidth="1" />
                </g>

                <g>
                  <rect x="98" y="16" width="10" height="148" rx="5" fill="url(#woodColumnGrad)" stroke="#451A03" strokeWidth="0.5" />
                  <rect x="96" y="20" width="14" height="6" rx="2" fill="url(#goldBrassGrad)" />
                  <rect x="96" y="154" width="14" height="6" rx="2" fill="url(#goldBrassGrad)" />
                  <circle cx="103" cy="90" r="6" fill="url(#woodColumnGrad)" stroke="url(#goldBrassGrad)" strokeWidth="1" />
                </g>

                {/* Top Wooden Base Plate */}
                <path 
                  d="M 8 10 L 112 10 C 115 10, 117 12, 116 16 L 110 22 C 109 23, 107 24, 105 24 L 15 24 C 13 24, 11 23, 10 22 L 4 16 C 3 12, 5 10, 8 10 Z" 
                  fill="url(#woodPlateGrad)" 
                  stroke="#451A03" 
                  strokeWidth="1" 
                />
                <rect x="22" y="8" width="76" height="3" rx="1.5" fill="url(#goldBrassGrad)" />

                {/* Bottom Wooden Base Plate */}
                <path 
                  d="M 10 158 C 11 157, 13 156, 15 156 L 105 156 C 107 156, 109 157, 110 158 L 116 164 C 117 168, 115 170, 112 170 L 8 170 C 5 170, 3 168, 4 164 Z" 
                  fill="url(#woodPlateGrad)" 
                  stroke="#451A03" 
                  strokeWidth="1" 
                />
                <rect x="22" y="169" width="76" height="3" rx="1.5" fill="url(#goldBrassGrad)" />

                {/* Golden Screws */}
                <circle cx="17" cy="17" r="2.5" fill="url(#goldBrassGrad)" />
                <circle cx="103" cy="17" r="2.5" fill="url(#goldBrassGrad)" />
                <circle cx="17" cy="163" r="2.5" fill="url(#goldBrassGrad)" />
                <circle cx="103" cy="163" r="2.5" fill="url(#goldBrassGrad)" />
              </svg>
            </motion.div>

            {/* Center Floating Progress Badge on Hourglass (Fixed Upright Overlay) */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-xl border backdrop-blur-md shadow-md z-20 pointer-events-none ${
              isLightTheme
                ? 'bg-white/95 border-amber-300 text-amber-950 shadow-amber-500/20'
                : 'bg-slate-900/95 border-amber-500/50 text-amber-300 shadow-black/80'
            }`}>
              <span className="text-xs font-mono font-black">
                {clampProgress.toFixed(0)}%
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
