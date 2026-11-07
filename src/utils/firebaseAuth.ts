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

/**
 * Checks whether the stored Google access token has expired (standard Google token lifespan is 3600s / 1hr).
 * We consider it expired after 55 minutes to prevent edge-case 401s during file uploads.
 */
export const isAccessTokenExpired = (): boolean => {
  if (typeof window === 'undefined') return true;
  const token = localStorage.getItem('bk_google_access_token');
  if (!token) return true;
  const acquired = localStorage.getItem('bk_google_access_token_acquired_at');
  if (!acquired) return false; // if acquired timestamp is missing, let API request test it
  const ageMs = Date.now() - parseInt(acquired, 10);
  return ageMs > 55 * 60 * 1000; // 55 minutes
};

/**
 * Cleanly clears expired Google OAuth tokens and dispatches an event for UI components.
 */
export const clearExpiredGoogleToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bk_google_access_token');
    localStorage.removeItem('bk_google_access_token_acquired_at');
    window.dispatchEvent(new CustomEvent('bk_google_session_expired'));
    window.dispatchEvent(new Event('storage'));
  }
};

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
          localStorage.setItem('bk_google_access_token_acquired_at', Date.now().toString());
          if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((err) => {
      console.error('Firebase Auth Redirect Result Error:', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (isAccessTokenExpired()) {
        clearExpiredGoogleToken();
      } else if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem('bk_google_access_token');
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we have a user but no cached token, notify failure to allow clean re-authorization
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearExpiredGoogleToken();
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
    localStorage.setItem('bk_google_access_token_acquired_at', Date.now().toString());
    window.dispatchEvent(new CustomEvent('bk_google_session_restored', { detail: { token: cachedAccessToken, user: result.user } }));
    window.dispatchEvent(new Event('storage'));
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
    if (isAccessTokenExpired()) {
      clearExpiredGoogleToken();
      return null;
    }
    cachedAccessToken = localStorage.getItem('bk_google_access_token');
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  clearExpiredGoogleToken();
};

