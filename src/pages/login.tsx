import React, { useEffect, useRef } from "react";
import {
  Button,
  Input,
  Checkbox,
  Link,
  Form,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
import { useNavigate, useLocation } from "react-router-dom"; // Import useNavigate
import { addToast } from "@/providers/toast";
import { isSignInWithEmailLink, getAdditionalUserInfo } from "firebase/auth";
import { auth } from "@/config/firebase";
import { extractFirebaseAuthError } from "@/utils/firebaseErrors";
import { usePageTracking } from "@/hooks/usePageTracking";
import { executeRecaptcha } from "@/utils/recaptcha";
import { saveUserProfile } from "@/api/users";
import { consumePendingSignupProfile } from "@/utils/pendingSignupProfile";

const MAGIC_LINK_SENT_KEY = "magicLinkSent:login";
const MAGIC_LINK_EMAIL_KEY = "magicLinkEmail:login";

export default function LoginPage() {
  usePageTracking("Sign In");
  const [isVisible, setIsVisible] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [loginMode, setLoginMode] = React.useState<"magic-link" | "password">(
    "magic-link",
  );
  const [linkSent, setLinkSent] = React.useState(false);
  const [linkSentEmail, setLinkSentEmail] = React.useState("");
  const handledMagicLink = useRef(false);

  const {
    userLoggedIn, // We can use this to redirect if already logged in
    loginEmailAndPassword, // Import the email/password login function
    sendLoginLink,
    signInWithLink,
    signInWithGoogle,
    resetPassword,
    loading: authLoading,
  } = useAuth(); // Get auth functions and state

  const toggleVisibility = () => setIsVisible(!isVisible);
  const navigate = useNavigate(); // Initialize navigate
  const location = useLocation();
  const state = (location.state || {}) as { from?: string; message?: string };
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pendingMagicLink, setPendingMagicLink] = React.useState<string | null>(
    null,
  );
  const [isEmailConfirmationModalOpen, setEmailConfirmationModalOpen] =
    React.useState(false);
  const [emailConfirmationValue, setEmailConfirmationValue] =
    React.useState("");
  const [emailConfirmationError, setEmailConfirmationError] = React.useState<
    string | null
  >(null);
  const [magicLinkSubmitting, setMagicLinkSubmitting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedSent = window.sessionStorage.getItem(MAGIC_LINK_SENT_KEY);
    if (storedSent === "1") {
      const storedEmail =
        window.sessionStorage.getItem(MAGIC_LINK_EMAIL_KEY) || "";
      setLinkSent(true);
      setLinkSentEmail(storedEmail);
      if (!email && storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, [email]);

  const completeMagicLinkSignIn = React.useCallback(
    async (emailAddress: string, link: string) => {
      handledMagicLink.current = true;
      if (isMountedRef.current) {
        setMagicLinkSubmitting(true);
        setEmailConfirmationError(null);
      }
      try {
        const result = await signInWithLink(emailAddress, link);
        const additionalUserInfo = getAdditionalUserInfo(result);
        if (additionalUserInfo?.isNewUser) {
          const pendingProfile = consumePendingSignupProfile(emailAddress);
          if (pendingProfile) {
            try {
              await saveUserProfile(result.user.uid, {
                firstName: pendingProfile.firstName,
                lastName: pendingProfile.lastName,
                email: pendingProfile.email,
              });
            } catch (profileError: unknown) {
              console.error(
                "Failed to save profile after magic-link signup",
                profileError,
              );
            }
          }
          navigate(siteConfig.pages.profile.link);
        } else {
          const dest = state?.from || siteConfig.pages.home.link;
          navigate(dest);
        }
      } catch (error: unknown) {
        handledMagicLink.current = false;
        console.error("Magic Link Sign-In failed:", error);
        const msg = getFirebaseAuthErrorMessage(error);
        if (isMountedRef.current) {
          setInlineError(msg);
          setEmailConfirmationError(msg);
          setPendingMagicLink(link);
          setEmailConfirmationModalOpen(true);
          setEmailConfirmationValue(emailAddress);
        }
        try {
          addToast({
            title: "Sign in failed",
            description: msg,
            color: "danger",
          });
        } catch (toastError: unknown) {
          console.warn("Toast failed:", toastError);
        }
      } finally {
        if (isMountedRef.current) {
          setMagicLinkSubmitting(false);
        }
      }
    },
    [navigate, signInWithLink, state?.from],
  );

  useEffect(() => {
    if (userLoggedIn && !authLoading) {
      // Check if user is logged in and auth is not loading
      const dest = state?.from || siteConfig.pages.home.link;
      navigate(dest);
    }
  }, [userLoggedIn, authLoading, navigate, state?.from]);

  // Check for incoming magic link
  useEffect(() => {
    let isCancelled = false;

    const checkMagicLink = async () => {
      if (handledMagicLink.current) {
        return;
      }

      const currentUrl = window.location.href;
      if (!isSignInWithEmailLink(auth, currentUrl)) {
        return;
      }

      const storedEmail = window.localStorage.getItem("emailForSignIn");
      if (storedEmail) {
        await completeMagicLinkSignIn(storedEmail, currentUrl);
        return;
      }

      if (isCancelled) {
        return;
      }

      setPendingMagicLink(currentUrl);
      setEmailConfirmationModalOpen(true);
      setEmailConfirmationError(null);
      setEmailConfirmationValue(email.trim());
    };

    void checkMagicLink();

    return () => {
      isCancelled = true;
    };
  }, [completeMagicLinkSignIn, email]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setInlineError(null);
    setIsSubmitting(true);

    try {
      // Execute reCAPTCHA for login
      const token = await executeRecaptcha("login");
      if (!token) {
        setInlineError(
          "Security check failed. Please refresh the page and try again.",
        );
        addToast({
          title: "Login failed",
          description: "reCAPTCHA verification failed.",
          color: "danger",
        });
        return;
      }

      if (loginMode === "magic-link") {
        if (email) {
          try {
            await sendLoginLink(email);
            setLinkSent(true);
            setLinkSentEmail(email.trim());
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(MAGIC_LINK_SENT_KEY, "1");
              window.sessionStorage.setItem(MAGIC_LINK_EMAIL_KEY, email.trim());
            }
            addToast({
              title: "Link sent!",
              description: "Check your email for the sign-in link.",
              color: "success",
            });
          } catch (error: unknown) {
            console.error("Send Link failed:", error);
            const msg = getFirebaseAuthErrorMessage(error);
            try {
              addToast({
                title: "Magic link sign-in failed",
                description: msg,
                color: "danger",
              });
            } catch (toastError: unknown) {
              // if toast fails for some reason, still set inline error
              console.warn("Toast failed:", toastError);
            }
            setInlineError(msg);
          }
        }
      } else {
        if (email && password) {
          try {
            await loginEmailAndPassword(email, password);
            // Navigate to original destination if provided, otherwise home
            const dest = state?.from || siteConfig.pages.home.link;
            navigate(dest);
          } catch (error: unknown) {
            console.error("Email/Password Sign-In failed on LoginPage:", error);
            const msg = getFirebaseAuthErrorMessage(error);
            // show toast and set inline fallback
            try {
              addToast({
                title: "Sign in failed",
                description: msg,
                color: "danger",
              });
            } catch (toastError: unknown) {
              // if toast fails for some reason, still set inline error
              console.warn("Toast failed:", toastError);
            }
            setInlineError(msg);
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      // Execute reCAPTCHA for Google login
      const token = await executeRecaptcha("google_login");
      if (!token) {
        setInlineError("Security check failed. Please try again.");
        return;
      }

      const result = await signInWithGoogle();
      // If redirect fallback was used the function may return void.
      if (!result) return;
      // Navigation or further actions on successful Google sign-in
      const additionalUserInfo = getAdditionalUserInfo(result);
      if (additionalUserInfo?.isNewUser) {
        navigate(siteConfig.pages.profile.link);
      } else {
        const dest = state?.from || siteConfig.pages.home.link;
        navigate(dest);
      }
    } catch (error: unknown) {
      console.error("Google Sign-In failed on LoginPage:", {
        email: email.trim() || undefined,
        error,
      });
      const msg = getFirebaseAuthErrorMessage(error);
      try {
        addToast({
          title: "Sign in failed",
          description: msg,
          color: "danger",
        });
      } catch (toastError: unknown) {
        console.warn("Toast failed:", toastError);
      }
      setInlineError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  function getAuthErrorMessage(code?: string, fallback?: string) {
    switch (code) {
      case "auth/invalid-email":
        return "The email address is not valid.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact support.";
      case "auth/user-not-found":
        return "No account found for that email.";
      case "auth/wrong-password":
        return "Incorrect password. Try again or reset your password.";
      case "auth/invalid-credential":
        return "Invalid credentials provided. Please try again.";
      case "auth/popup-closed-by-user":
        return "Sign in popup was closed before completing. Try again.";
      case "auth/cancelled-popup-request":
        return "Sign in was cancelled. Try again.";
      case "auth/expired-action-code":
        return "The sign-in link has expired. Please try again.";
      case "auth/invalid-action-code":
        return "The sign-in link is invalid. Please try again.";
      default:
        return fallback || "Failed to sign in. Please try again.";
    }
  }

  function getFirebaseAuthErrorMessage(error: unknown) {
    const firebaseError = extractFirebaseAuthError(error);
    return getAuthErrorMessage(firebaseError?.code, firebaseError?.message);
  }

  // If already logged in and not loading, render null or a loading indicator to prevent flash of login form
  if (userLoggedIn && !authLoading) {
    return null; // Or a loading spinner
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setInlineError("Please enter your email address to reset your password.");
      return;
    }
    try {
      await resetPassword(email);
      addToast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions.",
        color: "success",
      });
    } catch (error: unknown) {
      console.error("Reset Password failed:", error);
      const msg = getFirebaseAuthErrorMessage(error);
      setInlineError(msg);
    }
  };

  const handleEmailConfirmationSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!pendingMagicLink) {
      setEmailConfirmationError(
        "We couldn't find your sign-in link. Please click the link again.",
      );
      return;
    }
    if (!emailConfirmationValue.trim()) {
      setEmailConfirmationError("Email address is required.");
      return;
    }
    await completeMagicLinkSignIn(
      emailConfirmationValue.trim(),
      pendingMagicLink,
    );
  };

  const handleEmailPromptClose = () => {
    if (magicLinkSubmitting) {
      return;
    }
    setEmailConfirmationModalOpen(false);
    setEmailConfirmationError(null);
    setPendingMagicLink(null);
    handledMagicLink.current = true;
    navigate(siteConfig.pages.home.link, { replace: true });
  };

  return (
    <>
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="flex w-full max-w-sm flex-col gap-4 rounded-large 
        bg-content1 px-8 pb-10 pt-6 shadow-small"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-large font-medium">Sign in to your account</h1>
            <p className="text-small text-default-500">
              to continue to Ridgefield Golf Club
            </p>
            {state?.message ? (
              <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                {state.message}
              </div>
            ) : null}
            {inlineError ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                {inlineError}
              </div>
            ) : null}
          </div>

          <Form
            className="flex flex-col gap-3"
            validationBehavior="native"
            onSubmit={handleSubmit}
          >
            <Input
              isRequired
              label="Email Address"
              name="email"
              placeholder="Enter your email"
              type="email"
              variant="bordered"
              value={email}
              onValueChange={setEmail}
            />
            {loginMode === "password" && (
              <Input
                isRequired
                endContent={
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={toggleVisibility}
                    aria-label={isVisible ? "Hide password" : "Show password"}
                    className="min-w-0 h-auto"
                  >
                    {isVisible ? (
                      <Icon
                        className="text-2xl text-default-400"
                        icon="solar:eye-closed-linear"
                      />
                    ) : (
                      <Icon
                        className="text-2xl text-default-400"
                        icon="solar:eye-bold"
                      />
                    )}
                  </Button>
                }
                label="Password"
                name="password"
                placeholder="Enter your password"
                type={isVisible ? "text" : "password"}
                variant="bordered"
                value={password}
                onValueChange={setPassword}
              />
            )}

            {loginMode === "password" && (
              <div className="flex w-full items-center justify-between px-1 py-2">
                <Checkbox name="remember" size="sm">
                  Remember me
                </Checkbox>
                <Link
                  className="text-default-500"
                  onPress={handleForgotPassword}
                  size="sm"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              className="w-full"
              color="primary"
              type="submit"
              isDisabled={authLoading || isSubmitting}
              isLoading={isSubmitting}
            >
              {authLoading || isSubmitting
                ? "Processing..."
                : loginMode === "magic-link"
                  ? "Send Sign-In Link"
                  : "Sign In"}
            </Button>
          </Form>

          <div className="flex flex-col items-center gap-2">
            <Button
              variant="light"
              size="sm"
              className="text-default-500"
              onPress={() => {
                const nextMode =
                  loginMode === "magic-link" ? "password" : "magic-link";
                setLoginMode(nextMode);
                if (nextMode === "magic-link") {
                  setPassword("");
                }
              }}
            >
              {loginMode === "magic-link"
                ? "Sign in with password instead"
                : "Sign in with email link instead"}
            </Button>
          </div>

          <div className="flex items-center gap-4 py-2">
            <Divider className="flex-1" />
            <p className="shrink-0 text-tiny text-default-500">OR</p>
            <Divider className="flex-1" />
          </div>
          <div className="flex flex-col gap-2">
            {/* Google Sign-In Button */}
            <Button
              startContent={
                !isSubmitting && (
                  <Icon icon="flat-color-icons:google" width={24} />
                )
              }
              variant="bordered"
              onPress={handleGoogleSignIn}
              isDisabled={authLoading || isSubmitting}
              isLoading={isSubmitting}
            >
              {authLoading || isSubmitting
                ? "Signing in..."
                : "Continue with Google"}
            </Button>
          </div>
          <p className="text-center text-small">
            Need to create an account?&nbsp;
            <Link href={siteConfig.pages.signup.link} size="sm">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
      <Modal isOpen={linkSent} isDismissable={false}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Check your email
              </ModalHeader>
              <ModalBody className="space-y-3">
                <p className="text-small text-default-600">
                  We sent a sign-in link
                  {linkSentEmail ? ` to ${linkSentEmail}.` : "."} Click the link
                  to finish signing in.
                </p>
                <p className="text-small text-default-600">
                  If you don't see it, check your spam folder and look for an
                  email from{" "}
                  <span className="font-mono text-xs">
                    noreply@ridgefield-golf-club.firebaseapp.com
                  </span>
                  .
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="light"
                  onPress={() => {
                    setLinkSent(false);
                    setLinkSentEmail("");
                    if (typeof window !== "undefined") {
                      window.sessionStorage.removeItem(MAGIC_LINK_SENT_KEY);
                      window.sessionStorage.removeItem(MAGIC_LINK_EMAIL_KEY);
                    }
                  }}
                >
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal
        isOpen={isEmailConfirmationModalOpen}
        isDismissable={!magicLinkSubmitting}
        hideCloseButton={magicLinkSubmitting}
        onOpenChange={(open) => {
          if (!open) {
            handleEmailPromptClose();
          }
        }}
      >
        <ModalContent>
          {() => (
            <form onSubmit={handleEmailConfirmationSubmit}>
              <ModalHeader className="flex flex-col gap-1">
                Confirm your email
              </ModalHeader>
              <ModalBody className="flex flex-col gap-3">
                <p className="text-small text-default-500">
                  Enter the email address you used to request the sign-in link
                  so we can complete your login.
                </p>
                <Input
                  autoFocus
                  isRequired
                  label="Email Address"
                  type="email"
                  value={emailConfirmationValue}
                  onValueChange={(value) => {
                    setEmailConfirmationValue(value);
                    if (emailConfirmationError) {
                      setEmailConfirmationError(null);
                    }
                  }}
                  isInvalid={Boolean(emailConfirmationError)}
                  errorMessage={emailConfirmationError || undefined}
                  isDisabled={magicLinkSubmitting}
                  variant="bordered"
                />
              </ModalBody>
              <ModalFooter>
                <Button
                  type="button"
                  variant="light"
                  onPress={handleEmailPromptClose}
                  isDisabled={magicLinkSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  type="submit"
                  isDisabled={magicLinkSubmitting}
                >
                  {magicLinkSubmitting ? "Signing in..." : "Confirm"}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
