import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/firebase-admin';

// Set session expiration to 5 days
const expiresIn = 60 * 60 * 24 * 5 * 1000;

// Helper to determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

export async function POST(request: Request) {
  try {
    console.log('Session creation request received');
    const body = await request.json();
    console.log('Request body keys:', Object.keys(body));
    
    const { idToken } = body;
    
    if (!idToken) {
      console.error('No idToken provided in request');
      return new NextResponse(
        JSON.stringify({ error: 'No ID token provided' }),
        { status: 400 }
      );
    }

    console.log('ID token received, length:', idToken.length);
    console.log('Creating session cookie...');
    
    // Create a session cookie using Firebase Admin
    const sessionCookie = await createSessionCookie(idToken, expiresIn);

    console.log('Session cookie created successfully, length:', sessionCookie.length);
    
    // Set cookie options
    const options = {
      name: 'session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: isProduction,
      path: '/',
      sameSite: 'lax' as const,
    };

    console.log('Cookie options:', {
      name: options.name,
      maxAge: options.maxAge,
      httpOnly: options.httpOnly,
      secure: options.secure,
      path: options.path,
      sameSite: options.sameSite
    });

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
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Return a more detailed error message
    const errorMessage = error.message || 'Unknown error occurred';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    return new NextResponse(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
        code: errorCode,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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