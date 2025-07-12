'use client';

import { Suspense, useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function ClientOnlyWithSuspense({ children, fallback = null }: ClientOnlyProps) {
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ClientOnly>
  );
} 