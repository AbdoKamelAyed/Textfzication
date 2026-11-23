import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AccountStatus, SystemRole } from '../engine/adminGovernance';
import type { DatasetRecord, TextSample } from '../engine/types';

export const BOOTSTRAP_ADMIN_EMAIL = 'abdokamel200514@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory OAuth access token cache (never stored in localStorage or sessionStorage)
let cachedDriveAccessToken: string | null = null;
let isSigningIn = false;
const inFlightProfileSync = new Map<string, Promise<void>>();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client is offline. Please verify Firebase configuration.');
      return false;
    }
    // Permission error on /test/connection simply confirms server connectivity
    return true;
  }
}

export function subscribeAuth(
  onUser: (user: User | null, hasDriveToken: boolean) => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedDriveAccessToken = null;
      onUser(null, false);
    } else if (!isSigningIn) {
      onUser(user, Boolean(cachedDriveAccessToken));
    } else {
      onUser(user, Boolean(cachedDriveAccessToken));
    }
  });
}

export async function signInWithGoogle(): Promise<{
  user: User;
  accessToken: string | null;
  idToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedDriveAccessToken = credential?.accessToken ?? null;
    const idToken = await result.user.getIdToken();
    return {
      user: result.user,
      accessToken: cachedDriveAccessToken,
      idToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  cachedDriveAccessToken = null;
  await signOut(auth);
}

export function getInMemoryDriveToken(): string | null {
  return cachedDriveAccessToken;
}

export async function getFreshIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

function sanitizeId(raw: string, maxLen = 128): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : 'item_0';
}

export async function syncUserProfileToFirestore(user: User, theme: 'light' | 'dark') {
  const uid = sanitizeId(user.uid, 128);
  const existingPromise = inFlightProfileSync.get(uid);
  if (existingPromise) {
    return existingPromise;
  }

  const task = (async () => {
    const path = `users/${uid}`;
    const userRef = doc(db, 'users', uid);
    let exists = false;
    try {
      const snap = await getDoc(userRef);
      exists = snap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!exists) {
      const initialRole: SystemRole =
        user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? 'admin' : 'researcher';
      try {
        await setDoc(userRef, {
          uid,
          email: (user.email || 'unknown@example.com').slice(0, 256),
          displayName: (user.displayName || 'Researcher').slice(0, 120),
          theme,
          preferredLanguage: 'en',
          role: initialRole,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    } else {
      try {
        await updateDoc(userRef, {
          displayName: (user.displayName || 'Researcher').slice(0, 120),
          theme,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  })().finally(() => {
    inFlightProfileSync.delete(uid);
  });

  inFlightProfileSync.set(uid, task);
  return task;
}

export async function syncDatasetAndSampleToFirestore(
  user: User,
  dataset: DatasetRecord,
  sample?: TextSample
) {
  const uid = sanitizeId(user.uid, 128);
  const dsKey = sanitizeId(dataset.dataset_key, 128);
  const dsPath = `users/${uid}/datasets/${dsKey}`;
  const dsRef = doc(db, 'users', uid, 'datasets', dsKey);

  let dsExists = false;
  try {
    const dsSnap = await getDoc(dsRef);
    dsExists = dsSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, dsPath);
  }

  if (!dsExists) {
    try {
      await setDoc(dsRef, {
        datasetKey: dsKey,
        ownerUid: uid,
        name: dataset.name.slice(0, 160),
        description: dataset.description.slice(0, 1000),
        layer: dataset.layer,
        version: dataset.version.slice(0, 32),
        license: dataset.license.slice(0, 64),
        isSyntheticDemo: Boolean(dataset.is_synthetic_demo),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, dsPath);
    }
  } else {
    try {
      await updateDoc(dsRef, {
        name: dataset.name.slice(0, 160),
        description: dataset.description.slice(0, 1000),
        layer: dataset.layer,
        version: dataset.version.slice(0, 32),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, dsPath);
    }
  }

  if (sample) {
    const sId = sanitizeId(sample.sample_id, 64);
    const sPath = `users/${uid}/samples/${sId}`;
    const sRef = doc(db, 'users', uid, 'samples', sId);
    let sExists = false;
    try {
      const sSnap = await getDoc(sRef);
      sExists = sSnap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, sPath);
    }

    if (!sExists) {
      try {
        await setDoc(sRef, {
          sampleId: sId,
          ownerUid: uid,
          datasetKey: dsKey,
          text: sample.text.slice(0, 20000),
          language: sample.language.slice(0, 16),
          domain: sample.domain.slice(0, 64),
          originClass: sample.origin.class,
          validationStatus: sample.validation.status,
          verified: Boolean(sample.validation.verified),
          isSyntheticDemo: Boolean(sample.is_synthetic_demo),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, sPath);
      }
    } else {
      try {
        await updateDoc(sRef, {
          text: sample.text.slice(0, 20000),
          domain: sample.domain.slice(0, 64),
          originClass: sample.origin.class,
          validationStatus: sample.validation.status,
          verified: Boolean(sample.validation.verified),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, sPath);
      }
    }
  }
}

export async function saveResearchNoteToFirestore(
  user: User,
  title: string,
  content: string,
  tags: string[]
) {
  const uid = sanitizeId(user.uid, 128);
  const noteId = sanitizeId(`note_${Date.now().toString(36)}`, 128);
  const path = `users/${uid}/notes/${noteId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'notes', noteId), {
      noteId,
      ownerUid: uid,
      title: title.slice(0, 200),
      content: content.slice(0, 15000),
      tags: tags.slice(0, 10).map((t) => t.slice(0, 40)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return noteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listUserNotesFromFirestore(user: User) {
  const uid = sanitizeId(user.uid, 128);
  const path = `users/${uid}/notes`;
  try {
    const q = query(
      collection(db, 'users', uid, 'notes'),
      where('ownerUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data())
      .sort((a, b) => {
        const aMs = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
        const bMs = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
        return bMs - aMs;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface FirestoreUserRecord {
  uid: string;
  email: string;
  displayName?: string;
  theme?: 'light' | 'dark';
  preferredLanguage?: 'en' | 'ar';
  role?: SystemRole;
  status?: AccountStatus;
  updatedAtIso?: string;
}

export interface FirestoreAdminRecord {
  uid: string;
  email: string;
  grantedBy?: string;
  createdAtIso?: string;
}

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified) {
    return true;
  }
  const uid = sanitizeId(user.uid, 128);
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function listFirestoreUsers(): Promise<FirestoreUserRecord[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => {
      const data = d.data();
      const updatedMs =
        typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : null;
      return {
        uid: String(data.uid || d.id),
        email: String(data.email || ''),
        displayName: data.displayName ? String(data.displayName) : undefined,
        theme: data.theme === 'dark' ? 'dark' : 'light',
        preferredLanguage: data.preferredLanguage === 'ar' ? 'ar' : 'en',
        role: (data.role as SystemRole) || 'researcher',
        status: (data.status as AccountStatus) || 'active',
        updatedAtIso: updatedMs ? new Date(updatedMs).toISOString() : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listFirestoreAdmins(): Promise<FirestoreAdminRecord[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => {
      const data = d.data();
      const createdMs =
        typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : null;
      return {
        uid: String(data.uid || d.id),
        email: String(data.email || ''),
        grantedBy: data.grantedBy ? String(data.grantedBy) : undefined,
        createdAtIso: createdMs ? new Date(createdMs).toISOString() : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateUserRoleAndStatus(
  adminUser: User,
  targetUid: string,
  targetEmail: string,
  role: SystemRole,
  status: AccountStatus
): Promise<void> {
  const cleanTargetUid = sanitizeId(targetUid, 128);
  const cleanAdminUid = sanitizeId(adminUser.uid, 128);
  const path = `users/${cleanTargetUid}`;
  try {
    await updateDoc(doc(db, 'users', cleanTargetUid), {
      role,
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  if (role === 'admin') {
    await grantAdminAccess(adminUser, cleanTargetUid, targetEmail);
  } else if (cleanTargetUid !== cleanAdminUid) {
    const adminRef = doc(db, 'admins', cleanTargetUid);
    const snap = await getDoc(adminRef).catch(() => null);
    if (snap?.exists()) {
      try {
        await deleteDoc(adminRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `admins/${cleanTargetUid}`);
      }
    }
  }
}

export async function grantAdminAccess(
  adminUser: User,
  targetUid: string,
  targetEmail: string
): Promise<void> {
  const cleanTargetUid = sanitizeId(targetUid, 128);
  const cleanAdminUid = sanitizeId(adminUser.uid, 128);
  const path = `admins/${cleanTargetUid}`;
  const adminRef = doc(db, 'admins', cleanTargetUid);
  let exists = false;
  try {
    const snap = await getDoc(adminRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(adminRef, {
        uid: cleanTargetUid,
        email: targetEmail.trim().slice(0, 256),
        grantedBy: cleanAdminUid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(adminRef, {
        email: targetEmail.trim().slice(0, 256),
        grantedBy: cleanAdminUid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function revokeAdminAccess(targetUid: string): Promise<void> {
  const cleanTargetUid = sanitizeId(targetUid, 128);
  const path = `admins/${cleanTargetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', cleanTargetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
