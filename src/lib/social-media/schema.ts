import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { SocialMediaCredentials, SocialPlatform } from './types';

const COLLECTION_NAME = 'socialMediaCredentials';

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