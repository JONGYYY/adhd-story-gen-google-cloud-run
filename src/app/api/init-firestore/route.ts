import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Initializing Firestore database...');
    
    const db = await getAdminFirestore();
    
    // Create a test document to initialize the database
    const testDocRef = db.collection('_init').doc('test');
    await testDocRef.set({
      initialized: true,
      timestamp: Date.now(),
      message: 'Firestore database initialized successfully'
    });
    
    console.log('Firestore database initialized successfully');
    
    // Clean up the test document
    await testDocRef.delete();
    
    return NextResponse.json({
      success: true,
      message: 'Firestore database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to initialize Firestore database:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 