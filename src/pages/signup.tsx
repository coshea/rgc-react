import React from "react";
import {
  Button,
  Input,
  Checkbox,
  Link,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { getAdditionalUserInfo } from "firebase/auth";

import { RGCLogo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { termsSections, privacySections } from "@/content/policies";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { addToast } from "@/providers/toast";
import { extractFirebaseAuthError } from "@/utils/firebaseErrors";
import { usePageTracking } from "@/hooks/usePageTracking";
import { executeRecaptcha } from "@/utils/recaptcha";
import { saveUserProfile } from "@/api/users";
import { auth } from "@/config/firebase";
import {
  storePendingSignupProfile,
  clearPendingSignupProfile,
} from "@/utils/pendingSignupProfile";

const MAGIC_LINK_SENT_KEY = "magicLinkSent:signup";
const MAGIC_LINK_EMAIL_KEY = "magicLinkEmail:signup";

export default function SignUpPage() {
  usePageTracking("Sign Up");
  const [isVisible, setIsVisible] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [signupMode, setSignupMode] = React.useState<"magic-link" | "password">(
    "magic-link",
  );
  const [linkSent, setLinkSent] = React.useState(false);
  const [linkSentEmail, setLinkSentEmail] = React.useState("");
  const [isTermsOpen, setIsTermsOpen] = React.useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [signupEmail, setSignupEmail] = React.useState("");

  const stackedInputClassNames = {
    base: "-mb-[2px]",
    inputWrapper:
      "rounded-none data-[hover=true]:z-10 group-data-[focus-visible=true]:z-10",
  };

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

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storedSent = window.sessionStorage.getItem(MAGIC_LINK_SENT_KEY);
    if (storedSent === "1") {
      const storedEmail =
        window.sessionStorage.getItem(MAGIC_LINK_EMAIL_KEY) || "";
      setLinkSent(true);
      setLinkSentEmail(storedEmail);
    }
  }, []);

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const firstName = (formData.get("firstName") as string) || "";
    const lastName = (formData.get("lastName") as string) || "";
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    setInlineError(null);
    setIsSubmitting(true);

    try {
      // Execute reCAPTCHA for sign up
      const token = await executeRecaptcha("signup");
      if (!token) {
        setInlineError(
          "Security check failed. Please refresh the page and try again.",
        );
        addToast({
          title: "Sign up failed",
          description: "reCAPTCHA verification failed.",
          color: "danger",
        });
        return;
      }

      if (!firstName.trim() || !lastName.trim()) {
        setInlineError("First and last name are required.");
        addToast({
          title: "Missing name",
          description: "Please enter both first and last name.",
          color: "warning",
        });
        return;
      }

      if (signupMode === "magic-link") {
        if (email) {
          try {
            storePendingSignupProfile({
              email: email.trim(),
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              createdAt: Date.now(),
            });
            await sendLoginLink(email);
            setLinkSent(true);
            setLinkSentEmail(email.trim());
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(MAGIC_LINK_SENT_KEY, "1");
              window.sessionStorage.setItem(MAGIC_LINK_EMAIL_KEY, email.trim());
            }
            addToast({
              title: "Link sent!",
              description: "Check your email for the sign-up link.",
              color: "success",
            });
          } catch (error: unknown) {
            clearPendingSignupProfile();
            console.error("Send Link failed:", error);
            const msg = getFirebaseSignupErrorMessage(error);
            setInlineError(msg);
            addToast({
              title: "Unable to send link",
              description: msg,
              color: "danger",
            });
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
          const uid = auth.currentUser?.uid;
          if (uid) {
            try {
              await saveUserProfile(uid, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
              });
            } catch (profileError: unknown) {
              console.error(
                "Failed to save profile after signup",
                profileError,
              );
              addToast({
                title: "Profile not saved",
                description:
                  "Your account was created, but we couldn't save your profile yet. Please complete it after verification.",
                color: "warning",
              });
            }
          }
          navigate(siteConfig.pages.verifyEmail.link);
        } catch (error: unknown) {
          console.error("Signup failed:", error);
          const msg = getFirebaseSignupErrorMessage(error);
          setInlineError(msg);
          addToast({
            title: "Signup failed",
            description: msg,
            color: "danger",
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsSubmitting(true);
      // Execute reCAPTCHA for Google signup
      const token = await executeRecaptcha("google_signup");
      if (!token) {
        setInlineError("Security check failed. Please try again.");
        return;
      }

      const result = await signInWithGoogle(signupEmail.trim() || undefined);
      // If a redirect fallback was used the function may return void.
      if (!result) return;
      if (result.user) {
        const additionalUserInfo = getAdditionalUserInfo(result);
        if (additionalUserInfo?.isNewUser) {
          const displayName = result.user.displayName || "";
          const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
          if (nameParts.length >= 2) {
            const [first, ...rest] = nameParts;
            const last = rest.join(" ");
            try {
              await saveUserProfile(result.user.uid, {
                firstName: first,
                lastName: last,
                email: result.user.email || undefined,
              });
            } catch (profileError: unknown) {
              console.error(
                "Failed to save profile after Google signup",
                profileError,
              );
            }
          }
          navigate(siteConfig.pages.profile.link);
        } else {
          navigate(siteConfig.pages.home.link);
        }
      }
    } catch (error: unknown) {
      const msg = getFirebaseSignupErrorMessage(error);
      setInlineError(msg);
      console.error("Google Sign-Up failed:", {
        email: signupEmail.trim() || undefined,
        error,
      });
    } finally {
      setIsSubmitting(false);
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
      case "auth/password-does-not-meet-requirements":
        return "Password must contain at least 6 characters.";
      case "auth/operation-not-allowed":
        return "Sign up is disabled. Please contact support.";
      case "auth/popup-closed-by-user":
        return "The sign up popup was closed before completing.";
      case "auth/missing-email":
        return "Please provide an email address.";
      case "auth/invalid-continue-uri":
        return "Configuration error: Invalid redirect URL.";
      case "auth/unauthorized-continue-uri":
        return "Configuration error: Domain not authorized in Firebase Console.";
      case "auth/quota-exceeded":
        return "Sign-in quota exceeded. Please try again later.";
      default:
        return fallback || "Failed to sign up. Please try again.";
    }
  }

  function getFirebaseSignupErrorMessage(error: unknown) {
    const firebaseError = extractFirebaseAuthError(error);
    return getSignupErrorMessage(firebaseError?.code, firebaseError?.message);
  }

  const PolicyModal = ({
    title,
    sections,
    isOpen,
    onOpenChange,
    viewLink,
  }: {
    title: string;
    sections: typeof termsSections;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    viewLink: string;
  }) => (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-small text-default-500">
                Last updated: January 2026
              </p>
            </ModalHeader>
            <ModalBody className="space-y-4">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="font-semibold">{section.title}</p>
                  <p className="text-sm text-default-600">{section.body}</p>
                </div>
              ))}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => close()}>
                Close
              </Button>
              <Button
                as="a"
                href={viewLink}
                target="_blank"
                rel="noreferrer"
                variant="flat"
                color="primary"
                onPress={() => close()}
              >
                View Full Page
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );

  if (userLoggedIn && !authLoading) {
    return null; // prevent UI flash while navigation happens
  }

  return (
    <>
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
                classNames={stackedInputClassNames}
                label="First Name"
                name="firstName"
                placeholder="Enter your first name"
                type="text"
                variant="bordered"
              />
              <Input
                isRequired
                classNames={stackedInputClassNames}
                label="Last Name"
                name="lastName"
                placeholder="Enter your last name"
                type="text"
                variant="bordered"
              />
              <Input
                isRequired
                classNames={stackedInputClassNames}
                label="Email Address"
                name="email"
                placeholder="Enter your email"
                type="email"
                variant="bordered"
                value={signupEmail}
                onValueChange={setSignupEmail}
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
                        aria-label={
                          isVisible ? "Hide password" : "Show password"
                        }
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
            <Checkbox
              isRequired
              className="py-4"
              size="sm"
              aria-describedby="terms-privacy-modal-hint"
            >
              <span id="terms-privacy-modal-hint" className="sr-only">
                Terms and Privacy Policy open in-page dialogs.
              </span>
              I agree with the&nbsp;
              <Link
                className="relative z-1"
                size="sm"
                onPress={() => setIsTermsOpen(true)}
                aria-label="View Terms of Use (opens dialog)"
                aria-haspopup="dialog"
              >
                Terms
              </Link>
              &nbsp; and&nbsp;
              <Link
                className="relative z-1"
                size="sm"
                onPress={() => setIsPrivacyOpen(true)}
                aria-label="View Privacy Policy (opens dialog)"
                aria-haspopup="dialog"
              >
                Privacy Policy
              </Link>
            </Checkbox>
            <Button
              color="primary"
              type="submit"
              isDisabled={authLoading || isSubmitting}
              isLoading={isSubmitting}
            >
              {authLoading || isSubmitting
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
                  signupMode === "magic-link" ? "password" : "magic-link",
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
              startContent={
                !isSubmitting && (
                  <Icon icon="flat-color-icons:google" width={24} />
                )
              }
              variant="bordered"
              onPress={handleGoogleSignUp}
              isDisabled={authLoading || isSubmitting}
              isLoading={isSubmitting}
            >
              {authLoading || isSubmitting
                ? "Processing..."
                : "Sign Up with Google"}
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
      <Modal isOpen={linkSent} isDismissable={false}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Check your email
              </ModalHeader>
              <ModalBody className="space-y-3">
                <p className="text-small text-default-600">
                  We sent a sign-up link
                  {linkSentEmail ? ` to ${linkSentEmail}.` : "."} Click it to
                  finish creating your account.
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
      <PolicyModal
        title="Terms of Use"
        sections={termsSections}
        isOpen={isTermsOpen}
        onOpenChange={setIsTermsOpen}
        viewLink={siteConfig.pages.terms.link}
      />
      <PolicyModal
        title="Privacy Policy"
        sections={privacySections}
        isOpen={isPrivacyOpen}
        onOpenChange={setIsPrivacyOpen}
        viewLink={siteConfig.pages.privacy.link}
      />
    </>
  );
}
