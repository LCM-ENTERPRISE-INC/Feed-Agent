import React, { useMemo } from 'react';
import { BRAND, brandCopyright } from '@/config/brand';

interface BrandCopyrightProps {
  className?: string;
  showSolutionLine?: boolean;
  showSignature?: boolean;
  compact?: boolean;
}

export const BrandCopyright: React.FC<BrandCopyrightProps> = ({
  className = '',
  showSolutionLine = false,
  showSignature = true,
  compact = false,
}) => {
  const year = useMemo(() => new Date().getFullYear(), []);
  const line = brandCopyright(year);

  return (
    <div className={`brand-copyright ${compact ? 'brand-copyright--compact' : ''} ${className}`.trim()}>
      {showSignature && <p className="brand-copyright__signature">{BRAND.signature}</p>}
      {showSolutionLine && <p className="brand-copyright__solution">{BRAND.solutionLineFull}</p>}
      <p className="brand-copyright__line">{line}</p>
    </div>
  );
};

export default BrandCopyright;
