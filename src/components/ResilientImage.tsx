import { useState } from 'react';
import { Code2 } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientImage({ src, alt, className = '', fallbackTitle }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#0B1120] to-[#082F49]/40 border border-slate-800/80 text-slate-400 p-6 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Code2 className="w-8 h-8 text-cyan-400/80 mb-2" aria-hidden="true" />
        {fallbackTitle ? (
          <span className="text-xs font-medium text-slate-300 text-center max-w-[200px] truncate">
            {fallbackTitle}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
