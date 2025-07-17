import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { SocialMediaCredentials, SocialPlatform } from './types';

const COLLECTION_NAME = 'socialMediaCredentials';

// Client-side functions (for use in client components)
export async function setSocialMediaCredentials(
  userId: string,
  platform: SocialPlatform,
  credentials: Partial<SocialMediaCredentials>
) {
  const db = getFirestore();
  const docRef = doc(db, COLLECTION_NAME, `${userId}_${platform}`);
  await setDoc(docRef, {
    ...credentials,
    platform,
    updatedAt: Date.now()
  }, { merge: true });
}

export async function saveSocialMediaCredentials(
  userId: string,
  credentials: SocialMediaCredentials
) {
  const db = getFirestore();
  const docRef = doc(db, COLLECTION_NAME, `${userId}_${credentials.platform}`);
  await setDoc(docRef, {
    ...credentials,
    updatedAt: Date.now()
  });
}

export async function getSocialMediaCredentials(
  userId: string,
  platform: SocialPlatform
): Promise<SocialMediaCredentials | null> {
  const db = getFirestore();
  const docRef = doc(db, COLLECTION_NAME, `${userId}_${platform}`);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as SocialMediaCredentials;
  }
  return null;
}

export async function deleteSocialMediaCredentials(
  userId: string,
  platform: SocialPlatform
) {
  const db = getFirestore();
  const docRef = doc(db, COLLECTION_NAME, `${userId}_${platform}`);
  await deleteDoc(docRef);
}

// Server-side functions (for use in API routes)
export async function setSocialMediaCredentialsServer(
  userId: string,
  platform: SocialPlatform,
  credentials: Partial<SocialMediaCredentials>
) {
  const db = await getAdminFirestore();
  const docRef = db.collection(COLLECTION_NAME).doc(`${userId}_${platform}`);
  await docRef.set({
    ...credentials,
    platform,
    updatedAt: Date.now()
  }, { merge: true });
}

export async function saveSocialMediaCredentialsServer(
  userId: string,
  credentials: SocialMediaCredentials
) {
  const db = await getAdminFirestore();
  const docRef = db.collection(COLLECTION_NAME).doc(`${userId}_${credentials.platform}`);
  await docRef.set({
    ...credentials,
    updatedAt: Date.now()
  });
}

export async function getSocialMediaCredentialsServer(
  userId: string,
  platform: SocialPlatform
): Promise<SocialMediaCredentials | null> {
  const db = await getAdminFirestore();
  const docRef = db.collection(COLLECTION_NAME).doc(`${userId}_${platform}`);
  const docSnap = await docRef.get();
  
  if (docSnap.exists) {
    return docSnap.data() as SocialMediaCredentials;
  }
  return null;
}

export async function deleteSocialMediaCredentialsServer(
  userId: string,
  platform: SocialPlatform
) {
  const db = await getAdminFirestore();
  const docRef = db.collection(COLLECTION_NAME).doc(`${userId}_${platform}`);
  await docRef.delete();
}

// Add Firestore rules for security
export const firestoreRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /socialMediaCredentials/{document} {
      allow read: if request.auth != null && 
                  request.auth.uid == document.split('_')[0];
      allow write: if request.auth != null && 
                   request.auth.uid == document.split('_')[0];
    }
  }
}
`; 