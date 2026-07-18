import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import symbolUrl from '@/assets/brand/symbol.svg';

interface BrandMarkProps {
  compact?: boolean;
  /** Quando definido, a marca navega para a rota. */
  to?: string;
  className?: string;
}

/**
 * Marca ZapBusiness: monograma ZB + wordmark (Zap / Business).
 * Sem “by LCM” no logo (LCM só em copyright/rodapé).
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  compact = false,
  to,
  className = '',
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
        </span>
      )}
    </>
  );

  const classes = `brand-mark ${compact ? 'brand-mark--compact' : ''} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={classes} title={BRAND.productName} aria-label={BRAND.productName}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} title={BRAND.productName} aria-label={BRAND.productName}>
      {content}
    </div>
  );
};

export default BrandMark;
