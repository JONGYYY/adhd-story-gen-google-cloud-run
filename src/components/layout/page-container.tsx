'use client';

import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <main className="min-h-screen bg-gray-900">
      {children}
    </main>
  );
} 