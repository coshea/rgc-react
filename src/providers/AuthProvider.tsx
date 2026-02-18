import { auth, withAuthPersistenceRetry } from "@/config/firebase";
import { siteConfig } from "@/config/site";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User as FirebaseUser,
  ActionCodeSettings,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  UserCredential,
} from "firebase/auth";
import React, { useEffect, useState, createContext, useContext } from "react";

const EMAIL_FOR_SIGN_IN_STORAGE_KEY = "emailForSignIn";

function normalizeAndValidateEmail(email: string): string {
  const trimmed = email.trim();
  // Intentionally lightweight validation (matches other parts of the app).
  // Prevents persisting malformed values that could break the email-link flow.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    throw new Error("Please enter a valid email address.");
  }
  return trimmed;
}

// Define the shape of the context value
interface AuthContextType {
  user: FirebaseUser | null;
  userLoggedIn: boolean;
  loading: boolean;
  error: Error | null;
  loginEmailAndPassword: (
    email: string,
    password: string,
  ) => Promise<UserCredential>;
  signupEmailAndPassword: (
    email: string,
    password: string,
  ) => Promise<UserCredential>;
  sendLoginLink: (email: string) => Promise<void>;
  signInWithLink: (email: string, href: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential | void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context with a default undefined value initially,
// or a default object matching AuthContextType if preferred.
// Using undefined forces consumers to check if the context is available.
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, initializeUser);
    return () => unsubscribe();
  }, []);

  // initializeUser is not async itself, but it's called by onAuthStateChanged
  function initializeUser(firebaseUser: FirebaseUser | null) {
    if (firebaseUser) {
      setUser(firebaseUser); // Store the original Firebase User object
      setUserLoggedIn(true);
    } else {
      setUser(null);
      setUserLoggedIn(false);
    }
    setLoading(false);
  }

  const loginEmailAndPassword = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await withAuthPersistenceRetry(() =>
        signInWithEmailAndPassword(auth, email, password),
      );
      return result;
      // onAuthStateChanged will handle setting user and userLoggedIn
    } catch (err) {
      setError(err as Error);
      throw err; // Re-throw the error for the calling component
    } finally {
      setLoading(false);
    }
  };

  const signupEmailAndPassword = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await withAuthPersistenceRetry(() =>
        createUserWithEmailAndPassword(auth, email, password),
      );
      // onAuthStateChanged will handle setting user and userLoggedIn
      if (userCredential.user) {
        const actionCodeSettings: ActionCodeSettings = {
          url: window.location.origin + "/verify-email",
          handleCodeInApp: true,
        };
        try {
          await sendEmailVerification(userCredential.user, actionCodeSettings);
        } catch (ve) {
          console.error("Failed to send verification email", ve);
          // don't block signup, but surface error
          setError(ve as Error);
        }
      }
      return userCredential;
    } catch (err) {
      setError(err as Error);
      throw err; // Re-throw the error for the calling component
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");
      provider.setCustomParameters({ prompt: "select_account" }); // Ensure explicit account selection
      // If the page is running in a cross-origin isolated context (COOP/COEP),
      // accessing `window.closed` from the popup can be blocked causing the
      // popup-based flow to fail with console errors. Detect that and use the
      // redirect flow proactively to avoid the popup error noise.
      // Avoid using `as any` by declaring a local typed Window variant.
      type WindowWithCOI = Window & { crossOriginIsolated?: boolean };
      if (
        typeof window !== "undefined" &&
        (window as WindowWithCOI).crossOriginIsolated
      ) {
        await withAuthPersistenceRetry(() =>
          signInWithRedirect(auth, provider),
        );
        return;
      }

      try {
        const result = await withAuthPersistenceRetry(() =>
          signInWithPopup(auth, provider),
        );
        return result;
      } catch (popupErr) {
        // Some hosting setups (Cross-Origin-Opener-Policy) block reading
        // `window.closed` from the popup which causes the firebase popup
        // flow to throw. Fall back to redirect-based sign-in in that case.
        const message = (popupErr as Error)?.message || "";
        if (
          message.includes("Cross-Origin-Opener-Policy") ||
          message.includes("blocked the window.closed call") ||
          message.includes("Unable to use window.closed")
        ) {
          // Use redirect as a fallback; this will navigate away.
          await withAuthPersistenceRetry(() =>
            signInWithRedirect(auth, provider),
          );
          return; // caller should handle void result (redirect occurred)
        }
        throw popupErr;
      }
      // onAuthStateChanged will handle setting user and userLoggedIn
      // and creating a new user if one doesn't exist.
    } catch (err) {
      setError(err as Error);
      throw err; // Re-throw the error for the calling component
    } finally {
      setLoading(false);
    }
  };

  const sendLoginLink = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const safeEmail = normalizeAndValidateEmail(email);
      const actionCodeSettings: ActionCodeSettings = {
        // Firebase requires an absolute URL (including domain) for continue URLs.
        // Use the current origin as a fallback when siteConfig provides a relative path.
        url: window.location.origin + siteConfig.pages.login.link,
        handleCodeInApp: true,
      };
      await withAuthPersistenceRetry(() =>
        sendSignInLinkToEmail(auth, safeEmail, actionCodeSettings),
      );
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_STORAGE_KEY, safeEmail);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithLink = async (email: string, href: string) => {
    setLoading(true);
    setError(null);
    try {
      const safeEmail = normalizeAndValidateEmail(email);
      if (isSignInWithEmailLink(auth, href)) {
        const result = await withAuthPersistenceRetry(() =>
          signInWithEmailLink(auth, safeEmail, href),
        );
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_STORAGE_KEY);
        return result;
      }
      throw new Error("Invalid sign-in link");
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const safeEmail = normalizeAndValidateEmail(email);
      const actionCodeSettings: ActionCodeSettings = {
        url: window.location.origin + siteConfig.pages.login.link,
      };
      await withAuthPersistenceRetry(() =>
        sendPasswordResetEmail(auth, safeEmail, actionCodeSettings),
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await withAuthPersistenceRetry(() => signOut(auth));
      // onAuthStateChanged will handle setting user to null and userLoggedIn to false
    } catch (err) {
      setError(err as Error);
      throw err; // Re-throw the error for the calling component
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userLoggedIn,
    loading,
    error,
    loginEmailAndPassword,
    signupEmailAndPassword,
    sendLoginLink,
    signInWithLink,
    signInWithGoogle,
    resetPassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
