import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Auth Provider
export const provider = new GoogleAuthProvider();

// Custom parameters to ensure smooth account selection
provider.setCustomParameters({ 
  prompt: 'select_account'
});

// Add the scopes required for Google Sheets, Google Drive, and Gmail operations
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.compose');

// Flag indicating active sign-in
let isSigningIn = false;
// Memory cache for access token
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('bk_google_access_token') : null;

// Initialize Auth Listener & Process Redirect Results
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if returning from signInWithRedirect
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('bk_google_access_token', cachedAccessToken);
          if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((err) => {
      console.error('Firebase Auth Redirect Result Error:', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem('bk_google_access_token');
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we have a user but no cached token, request login again to capture token
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('bk_google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Main Sign-In function via Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google Authentication');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('bk_google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Alternative Sign-In function via Redirect (Bypasses popup blocker / mobile webview issues)
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Firebase Google Sign-In Redirect Error:', error);
    isSigningIn = false;
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem('bk_google_access_token');
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('bk_google_access_token');
};

