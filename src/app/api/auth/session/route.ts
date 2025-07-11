import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/firebase-admin';

// Set session expiration to 5 days
const expiresIn = 60 * 60 * 24 * 5 * 1000;

// Helper to determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

export async function POST(request: Request) {
  try {
    console.log('Session creation request received');
    const { idToken } = await request.json();
    
    if (!idToken) {
      console.error('No idToken provided in request');
      return new NextResponse(
        JSON.stringify({ error: 'No ID token provided' }),
        { status: 400 }
      );
    }

    console.log('Creating session cookie...');
    // Create a session cookie using Firebase Admin
    const sessionCookie = await createSessionCookie(idToken, expiresIn);

    console.log('Session cookie created successfully');
    // Set cookie options
    const options = {
      name: 'session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const,
    };

    // Return the session cookie
    const response = new NextResponse(JSON.stringify({ status: 'success' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set the cookie
    response.cookies.set(options);
    console.log('Session cookie set in response');

    return response;
  } catch (error: any) {
    console.error('Failed to create session:', error);
    // Return a more detailed error message
    const errorMessage = error.message || 'Unknown error occurred';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    return new NextResponse(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
        code: errorCode,
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
} 