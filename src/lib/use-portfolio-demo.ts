'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** Sets `data-portfolio-demo` on body for chrome hiding + returns portfolio mode flag. */
export function usePortfolioDemoChrome(): boolean {
  const portfolioMode = useSearchParams().get('portfolio') === '1';

  useEffect(() => {
    if (!portfolioMode) return;
    document.body.setAttribute('data-portfolio-demo', 'true');
    return () => document.body.removeAttribute('data-portfolio-demo');
  }, [portfolioMode]);

  return portfolioMode;
}
