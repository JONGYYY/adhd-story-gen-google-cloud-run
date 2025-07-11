'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    // Clear authentication
    document.cookie = 'isLoggedIn=false; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('rememberedEmail');

    // Redirect to home page
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Signing out...</h1>
        <p className="text-gray-400">Please wait while we sign you out.</p>
      </div>
    </div>
  );
} 