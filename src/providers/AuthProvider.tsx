import { auth } from "@/config/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
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

// Define the shape of the context value
interface AuthContextType {
  user: FirebaseUser | null;
  userLoggedIn: boolean;
  loading: boolean;
  error: Error | null;
  loginEmailAndPassword: (
    email: string,
    password: string
  ) => Promise<UserCredential>;
  signupEmailAndPassword: (
    email: string,
    password: string
  ) => Promise<UserCredential>;
  sendLoginLink: (email: string) => Promise<void>;
  signInWithLink: (email: string, href: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context with a default undefined value initially,
// or a default object matching AuthContextType if preferred.
// Using undefined forces consumers to check if the context is available.
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
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
        password
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
      const result = await signInWithPopup(auth, provider);
      return result;
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
      const actionCodeSettings: ActionCodeSettings = {
        url: window.location.origin + "/login",
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
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
      if (isSignInWithEmailLink(auth, href)) {
        const result = await signInWithEmailLink(auth, email, href);
        window.localStorage.removeItem("emailForSignIn");
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
