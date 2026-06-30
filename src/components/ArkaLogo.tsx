import React from 'react';

interface ArkaLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  textColor?: string;
  accentColor?: string;
}

export const ArkaLogo: React.FC<ArkaLogoProps> = ({ 
  className = '', 
  iconOnly = false, 
  size = 'md',
  textColor = 'text-[#3D2E24]',
  accentColor = 'text-[#5a8370]'
}) => {
  // Sizing mappings
  const sizes = {
    xs: {
      circle: 'w-6 h-6 text-[9px] border-[1.2px]',
      title: 'text-xs',
      subtitle: 'text-[6px] tracking-[0.16em]',
      gap: 'gap-1.5'
    },
    sm: {
      circle: 'w-8 h-8 text-[11px] border-[1.5px]',
      title: 'text-sm',
      subtitle: 'text-[7.5px] tracking-[0.2em]',
      gap: 'gap-2'
    },
    md: {
      circle: 'w-11 h-11 text-[15px] border-2',
      title: 'text-lg',
      subtitle: 'text-[9.5px] tracking-[0.25em]',
      gap: 'gap-3'
    },
    lg: {
      circle: 'w-16 h-16 text-[22px] border-2.5',
      title: 'text-2xl',
      subtitle: 'text-[13px] tracking-[0.3em]',
      gap: 'gap-4'
    },
    xl: {
      circle: 'w-24 h-24 text-[32px] border-4',
      title: 'text-4xl',
      subtitle: 'text-[18px] tracking-[0.35em]',
      gap: 'gap-6'
    }
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${currentSize.gap} ${className}`}>
      {/* Dynamic Emblem Circle */}
      <div 
        className={`${currentSize.circle} flex-shrink-0 rounded-full flex items-center justify-center bg-[#5a8370] shadow-xs select-none`}
        style={{ borderColor: '#c49a45' }}
      >
        <span className="font-serif italic text-white font-extrabold leading-none relative -top-[1.5px]">
          Arka
        </span>
      </div>

      {/* Corporate Lettering */}
      {!iconOnly && (
        <div className="flex flex-col justify-center leading-none">
          <span className={`font-serif font-black ${textColor} ${currentSize.title} tracking-tight`}>
            Arka Dental
          </span>
          <span className={`font-sans font-extrabold uppercase mt-1 ${accentColor} ${currentSize.subtitle}`}>
            Center
          </span>
        </div>
      )}
    </div>
  );
};

export default ArkaLogo;
