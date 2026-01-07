import React, { useEffect, useRef } from "react";
import { Button, Input, Checkbox, Link, Form, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
import { useNavigate, useLocation } from "react-router-dom"; // Import useNavigate
import { addToast } from "@/providers/toast";
import { isSignInWithEmailLink, getAdditionalUserInfo } from "firebase/auth";
import { auth } from "@/config/firebase";

export default function LoginPage() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [loginMode, setLoginMode] = React.useState<"magic-link" | "password">(
    "magic-link"
  );
  const [linkSent, setLinkSent] = React.useState(false);
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

  useEffect(() => {
    if (userLoggedIn && !authLoading) {
      // Check if user is logged in and auth is not loading
      const dest = state?.from || siteConfig.pages.home.link;
      navigate(dest);
    }
  }, [userLoggedIn, authLoading, navigate]);

  // Check for incoming magic link
  useEffect(() => {
    if (handledMagicLink.current) {
      return;
    }
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) {
        // User opened link on different device. Ask for email.
        email = window.prompt("Please provide your email for confirmation");
      }
      if (email) {
        handledMagicLink.current = true;
        signInWithLink(email, window.location.href)
          .then((result) => {
            const additionalUserInfo = getAdditionalUserInfo(result);
            if (additionalUserInfo?.isNewUser) {
              navigate(siteConfig.pages.profile.link);
            } else {
              const dest = state?.from || siteConfig.pages.home.link;
              navigate(dest);
            }
          })
          .catch((error) => {
            console.error("Magic Link Sign-In failed:", error);
            const msg = getAuthErrorMessage(error?.code, error?.message);
            setInlineError(msg);
            addToast({
              title: "Sign in failed",
              description: msg,
              color: "danger",
            });
          });
      }
    }
  }, [navigate, signInWithLink, state?.from]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;

    setInlineError(null);

    if (loginMode === "magic-link") {
      if (email) {
        try {
          await sendLoginLink(email);
          setLinkSent(true);
          addToast({
            title: "Link sent!",
            description: "Check your email for the sign-in link.",
            color: "success",
          });
        } catch (error) {
          console.error("Send Link failed:", error);
          const err = error as any;
          const msg = getAuthErrorMessage(err?.code, err?.message);
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
        } catch (error) {
          console.error("Email/Password Sign-In failed on LoginPage:", error);
          const err = error as any;
          const msg = getAuthErrorMessage(err?.code, err?.message);
          // show toast and set inline fallback
          try {
            addToast({
              title: "Sign in failed",
              description: msg,
              color: "danger",
            });
          } catch (e) {
            // if toast fails for some reason, still set inline error
            console.warn("Toast failed:", e);
          }
          setInlineError(msg);
        }
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      // Navigation or further actions on successful Google sign-in
      const additionalUserInfo = getAdditionalUserInfo(result);
      if (additionalUserInfo?.isNewUser) {
        navigate(siteConfig.pages.profile.link);
      } else {
        const dest = state?.from || siteConfig.pages.home.link;
        navigate(dest);
      }
    } catch (error) {
      console.error("Google Sign-In failed on LoginPage:", error);
      const err = error as any;
      const msg = getAuthErrorMessage(err?.code, err?.message);
      try {
        addToast({
          title: "Sign in failed",
          description: msg,
          color: "danger",
        });
      } catch (e) {
        console.warn("Toast failed:", e);
      }
      setInlineError(msg);
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

  // If already logged in and not loading, render null or a loading indicator to prevent flash of login form
  if (userLoggedIn && !authLoading) {
    return null; // Or a loading spinner
  }

  if (linkSent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-large bg-content1 px-8 pb-10 pt-6 shadow-small text-center">
          <Icon
            icon="solar:letter-linear"
            className="mx-auto text-6xl text-primary"
          />
          <h1 className="text-large font-medium">Check your email</h1>
          <p className="text-small text-default-500">
            We sent a sign-in link to your email address. Click the link to sign
            in.
          </p>
          <Button
            variant="light"
            onPress={() => setLinkSent(false)}
            className="mt-2"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
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
    } catch (error) {
      console.error("Reset Password failed:", error);
      const err = error as any;
      const msg = getAuthErrorMessage(err?.code, err?.message);
      setInlineError(msg);
    }
  };

  return (
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
            />
          )}

          {loginMode === "password" && (
            <div className="flex w-full items-center justify-between px-1 py-2">
              <Checkbox name="remember" size="sm">
                Remember me
              </Checkbox>
              <Link
                className="text-default-500 cursor-pointer"
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
            isDisabled={authLoading}
          >
            {authLoading
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
            onPress={() =>
              setLoginMode(
                loginMode === "magic-link" ? "password" : "magic-link"
              )
            }
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
            startContent={<Icon icon="flat-color-icons:google" width={24} />}
            variant="bordered"
            onPress={handleGoogleSignIn}
            isDisabled={authLoading}
          >
            {authLoading ? "Signing in..." : "Continue with Google"}
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
  );
}
