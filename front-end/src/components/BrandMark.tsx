import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import symbolUrl from '@/assets/brand/symbol.svg';

interface BrandMarkProps {
  compact?: boolean;
  /** Quando definido, a marca navega para a rota. */
  to?: string;
  className?: string;
  /** Exibe subtítulo “by LCM” sob o wordmark (sidebar/login). */
  showByline?: boolean;
}

/** Marca provisória ZapBusiness — símbolo + wordmark (+ by LCM). */
export const BrandMark: React.FC<BrandMarkProps> = ({
  compact = false,
  to,
  className = '',
  showByline = true,
}) => {
  const content = (
    <>
      <img src={symbolUrl} alt="" className="brand-mark__symbol" width={36} height={36} aria-hidden />
      {!compact && (
        <span className="brand-mark__text">
          <span className="brand-mark__wordmark">
            <span className="brand-mark__zap">Zap</span>
            <span className="brand-mark__business">Business</span>
          </span>
          {showByline && <span className="brand-mark__by">by {BRAND.companyShort}</span>}
        </span>
      )}
    </>
  );

  const label = showByline ? BRAND.signature : BRAND.productName;
  const classes = `brand-mark ${compact ? 'brand-mark--compact' : ''} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={classes} title={label} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} title={label} aria-label={label}>
      {content}
    </div>
  );
};

export default BrandMark;
