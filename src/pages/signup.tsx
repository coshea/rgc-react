import React from "react";
import { Button, Input, Checkbox, Link, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { getAdditionalUserInfo } from "firebase/auth";

import { RGCLogo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { addToast } from "@/providers/toast";

export default function SignUpPage() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [signupMode, setSignupMode] = React.useState<"magic-link" | "password">(
    "magic-link"
  );
  const [linkSent, setLinkSent] = React.useState(false);

  const {
    userLoggedIn,
    signupEmailAndPassword,
    sendLoginLink,
    signInWithGoogle,
    loading: authLoading,
  } = useAuth();
  const navigate = useNavigate();

  const toggleVisibility = () => setIsVisible(!isVisible);
  const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

  // Redirect signed-in users away from signup page
  React.useEffect(() => {
    if (userLoggedIn && !authLoading) {
      navigate(siteConfig.pages.home.link);
    }
  }, [userLoggedIn, authLoading, navigate]);

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    setInlineError(null);

    if (signupMode === "magic-link") {
      if (email) {
        try {
          await sendLoginLink(email);
          setLinkSent(true);
          addToast({
            title: "Link sent!",
            description: "Check your email for the sign-up link.",
            color: "success",
          });
        } catch (error) {
          console.error("Send Link failed:", error);
          const err = error as any;
          const msg = getSignupErrorMessage(err?.code, err?.message);
          setInlineError(msg);
        }
      }
      return;
    }

    if (password !== confirmPassword) {
      // Handle password mismatch error - you might want to set a local error state for this
      console.error("Passwords do not match");
      setInlineError("Passwords do not match");
      return;
    }

    if (email && password) {
      try {
        await signupEmailAndPassword(email, password);
        navigate(siteConfig.pages.verifyEmail.link);
      } catch (error) {
        const err = error as any;
        const msg = getSignupErrorMessage(err?.code, err?.message);
        setInlineError(msg);
        try {
          addToast({
            title: "Sign up failed",
            description: msg,
            color: "danger",
          });
        } catch (e) {
          // ignore toast failures in non-DOM test environments
          // eslint-disable-next-line no-console
          console.debug("toast unavailable", e);
        }
        console.error("Email/Password Sign-Up failed:", error);
      }
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        const additionalUserInfo = getAdditionalUserInfo(result);
        if (additionalUserInfo?.isNewUser) {
          navigate(siteConfig.pages.profile.link);
        } else {
          navigate(siteConfig.pages.home.link);
        }
      }
    } catch (error) {
      const err = error as any;
      const msg = getSignupErrorMessage(err?.code, err?.message);
      setInlineError(msg);
      try {
        addToast({
          title: "Sign up failed",
          description: msg,
          color: "danger",
        });
      } catch (e) {
        // ignore toast failures in non-DOM test environments
        // eslint-disable-next-line no-console
        console.debug("toast unavailable", e);
      }
      console.error("Google Sign-Up failed:", error);
    }
  };

  function getSignupErrorMessage(code?: string, fallback?: string) {
    switch (code) {
      case "auth/email-already-in-use":
        return "An account with that email already exists. Please sign in instead or use Forgot Password.";
      case "auth/invalid-email":
        return "The email address is not valid.";
      case "auth/weak-password":
        return "Password is too weak. Use at least 6 characters (more is better).";
      case "auth/operation-not-allowed":
        return "Email/password sign up is disabled. Contact support.";
      case "auth/popup-closed-by-user":
        return "The sign up popup was closed before completing.";
      default:
        return fallback || "Failed to sign up. Please try again.";
    }
  }

  if (userLoggedIn && !authLoading) {
    return null; // prevent UI flash while navigation happens
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
            We sent a sign-up link to your email address. Click the link to
            create your account.
          </p>
          <Button
            variant="light"
            onPress={() => setLinkSent(false)}
            className="mt-2"
          >
            Back to Sign Up
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-large bg-content1 px-8 pb-10 pt-6 shadow-small">
        <div className="flex flex-col items-center pb-6">
          <RGCLogo size={240} />
          <p className="text-xl font-medium">Welcome</p>
          <p className="text-small text-default-500">
            Create an account to get started
          </p>
        </div>
        {inlineError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {inlineError}
          </div>
        )}
        <form className="flex flex-col gap-3" onSubmit={handleSignUp}>
          <div className="flex flex-col">
            <Input
              isRequired
              classNames={{
                base: "-mb-[2px]",
                inputWrapper:
                  "rounded-none data-[hover=true]:z-10 group-data-[focus-visible=true]:z-10",
              }}
              label="Email Address"
              name="email"
              placeholder="Enter your email"
              type="email"
              variant="bordered"
            />
            {signupMode === "password" && (
              <>
                <Input
                  isRequired
                  classNames={{
                    base: "-mb-[2px]",
                    inputWrapper:
                      "rounded-none data-[hover=true]:z-10 group-data-[focus-visible=true]:z-10",
                  }}
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
                <Input
                  isRequired
                  classNames={{
                    inputWrapper: "rounded-t-none",
                  }}
                  endContent={
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={toggleConfirmVisibility}
                      aria-label={
                        isConfirmVisible
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      className="min-w-0 h-auto"
                    >
                      {isConfirmVisible ? (
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
                  label="Confirm Password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  type={isConfirmVisible ? "text" : "password"}
                  variant="bordered"
                />
              </>
            )}
          </div>
          <Checkbox isRequired className="py-4" size="sm">
            I agree with the&nbsp;
            <Link className="relative z-1" href="#" size="sm">
              Terms
            </Link>
            &nbsp; and&nbsp;
            <Link className="relative z-1" href="#" size="sm">
              Privacy Policy
            </Link>
          </Checkbox>
          <Button color="primary" type="submit" isDisabled={authLoading}>
            {authLoading
              ? "Processing..."
              : signupMode === "magic-link"
                ? "Send Sign-Up Link"
                : "Sign Up"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2">
          <Button
            variant="light"
            size="sm"
            className="text-default-500"
            onPress={() =>
              setSignupMode(
                signupMode === "magic-link" ? "password" : "magic-link"
              )
            }
          >
            {signupMode === "magic-link"
              ? "Sign up with password instead"
              : "Sign up with email link instead"}
          </Button>
        </div>

        <div className="flex items-center gap-4 py-2">
          <Divider className="flex-1" />
          <p className="shrink-0 text-tiny text-default-500">OR</p>
          <Divider className="flex-1" />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            startContent={<Icon icon="flat-color-icons:google" width={24} />}
            variant="bordered"
            onPress={handleGoogleSignUp}
            isDisabled={authLoading}
          >
            {authLoading ? "Processing..." : "Sign Up with Google"}
          </Button>
        </div>
        <p className="text-center text-small">
          Already have an account?&nbsp;
          <Link href={siteConfig.pages.login.link} size="sm">
            {siteConfig.pages.login.title}
          </Link>
        </p>
      </div>
    </div>
  );
}
