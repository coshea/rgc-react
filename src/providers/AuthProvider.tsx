import { auth } from "@/config/firebase";
import { siteConfig } from "@/config/site";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid || "null");
      initializeUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Check for redirect result on mount.
    // We remove the useRef guard to ensure we definitely call it.
    // Firebase SDK handles multiple calls safely (idempotent-ish relative to consuming the token).
    const checkRedirect = async () => {
      try {
        console.log("AuthProvider: Checking getRedirectResult...");
        const result = await getRedirectResult(auth);

        if (result) {
          console.log("AuthProvider: Redirect Result Found!", result.user.uid);
          // setUser will happen via onAuthStateChanged
        } else {
          console.log("AuthProvider: No redirect result found.");
        }
      } catch (err: any) {
        if (err.code === "auth/popup-closed-by-user") {
          // ignore
        } else if (err.code === "auth/null-user") {
          // ignore
        } else {
          console.error("AuthProvider: Redirect Error:", err);
          setError(err as Error);
        }
      }
    };

    // Only verify if we are not already logged in
    if (!auth.currentUser) {
      checkRedirect();
    } else {
      console.log("AuthProvider: User already active:", auth.currentUser.uid);
    }
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
      const result = await signInWithEmailAndPassword(auth, email, password);
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
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
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
      provider.setCustomParameters({ prompt: "select_account" });

      if (import.meta.env.DEV) {
        console.log("AuthProvider: Starting Google Popup Flow (Dev)...");
        await signInWithPopup(auth, provider);
      } else {
        console.log("AuthProvider: Starting Google Redirect Flow (Prod)...");
        // Ensure persistence is set to LOCAL so the session survives the redirect
        await setPersistence(auth, browserLocalPersistence);
        await signInWithRedirect(auth, provider);
      }
      return;
    } catch (err) {
      console.error("AuthProvider: signInWithGoogle Error:", err);
      setError(err as Error);
      throw err;
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
      await sendSignInLinkToEmail(auth, safeEmail, actionCodeSettings);
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
        const result = await signInWithEmailLink(auth, safeEmail, href);
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
      await sendPasswordResetEmail(auth, email);
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
      await signOut(auth);
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
