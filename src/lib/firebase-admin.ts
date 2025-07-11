'use server';

async function callFirebaseAdminApi(action: string, payload: any) {
  // Get the base URL from environment or default to localhost in development
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/firebase-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Firebase Admin API call failed');
  }

  return response.json();
}

export async function verifySessionCookie(sessionCookie: string, checkRevoked = true) {
  const result = await callFirebaseAdminApi('verifySession', {
    sessionCookie,
    checkRevoked,
  });
  return result.decodedClaims;
}

export async function createSessionCookie(idToken: string, expiresIn: number) {
  const result = await callFirebaseAdminApi('createSession', {
    idToken,
    expiresIn,
  });
  return result.sessionCookie;
} 