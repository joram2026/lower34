import React, { useState } from 'react';
import { optimizeTraderImageUrl, getInitials } from '../utils/imageUtils';

interface ExpertAvatarProps {
  photoUrl?: string;
  name?: string;
  className?: string;
  size?: number; // pixel dimension
  roundedClassName?: string;
  borderClassName?: string;
}

export const ExpertAvatar: React.FC<ExpertAvatarProps> = ({
  photoUrl,
  name = 'Expert Trader',
  className = 'w-14 h-14',
  size = 160,
  roundedClassName = 'rounded-full',
  borderClassName = 'border-2 border-emerald-500/50'
}) => {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const optimizedSrc = optimizeTraderImageUrl(photoUrl, size);
  const initials = getInitials(name);

  // Derive subtle deterministic gradient based on name characters
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  const gradients = [
    'from-amber-600 to-amber-900',
    'from-emerald-600 to-teal-900',
    'from-blue-600 to-indigo-900',
    'from-purple-600 to-slate-900'
  ];
  const bgGradient = gradients[charCode % gradients.length];

  return (
    <div
      className={`relative ${className} ${roundedClassName} ${borderClassName} overflow-hidden shrink-0 shadow-md bg-gradient-to-br ${bgGradient} flex items-center justify-center select-none`}
    >
      {/* Instant fallback initials rendered underneath or on error */}
      <span className="text-white font-black font-mono tracking-wider text-xs sm:text-sm uppercase opacity-90 drop-shadow-xs">
        {initials}
      </span>

      {/* Optimized Image with Instant Eager Loading & Smooth Fade-in */}
      {!hasError && (
        <img
          src={optimizedSrc}
          alt={name}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setHasLoaded(true)}
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            hasLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
