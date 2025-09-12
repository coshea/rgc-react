import React, { useEffect } from "react";
import { Button, Input, Checkbox, Link, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";

import { RGCLogo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function SignUpPage() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const {
    userLoggedIn,
    signupEmailAndPassword,
    signInWithGoogle,
    loading: authLoading,
    error: authError,
  } = useAuth();
  const navigate = useNavigate();

  const toggleVisibility = () => setIsVisible(!isVisible);
  const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

  useEffect(() => {
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

    if (password !== confirmPassword) {
      // Handle password mismatch error - you might want to set a local error state for this
      console.error("Passwords do not match");
      return;
    }

    if (email && password) {
      try {
        await signupEmailAndPassword(email, password);
        // Redirect only to profile so user can complete their details
        navigate(siteConfig.pages.profile.link);
      } catch (error) {
        console.error("Email/Password Sign-Up failed:", error);
      }
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
      navigate(siteConfig.pages.profile.link);
    } catch (error) {
      console.error("Google Sign-Up failed:", error);
    }
  };

  if (userLoggedIn && !authLoading) {
    return null; // Or a loading spinner
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
            <Input
              isRequired
              classNames={{
                base: "-mb-[2px]",
                inputWrapper:
                  "rounded-none data-[hover=true]:z-10 group-data-[focus-visible=true]:z-10",
              }}
              endContent={
                <button type="button" onClick={toggleVisibility}>
                  {isVisible ? (
                    <Icon
                      className="pointer-events-none text-2xl text-default-400"
                      icon="solar:eye-closed-linear"
                    />
                  ) : (
                    <Icon
                      className="pointer-events-none text-2xl text-default-400"
                      icon="solar:eye-bold"
                    />
                  )}
                </button>
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
                <button type="button" onClick={toggleConfirmVisibility}>
                  {isConfirmVisible ? (
                    <Icon
                      className="pointer-events-none text-2xl text-default-400"
                      icon="solar:eye-closed-linear"
                    />
                  ) : (
                    <Icon
                      className="pointer-events-none text-2xl text-default-400"
                      icon="solar:eye-bold"
                    />
                  )}
                </button>
              }
              label="Confirm Password"
              name="confirmPassword"
              placeholder="Confirm your password"
              type={isConfirmVisible ? "text" : "password"}
              variant="bordered"
            />
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
          {authError && !authLoading && (
            <p className="text-danger text-center text-small -mt-2 mb-1">
              {authError.message}
            </p>
          )}
          <Button color="primary" type="submit" isDisabled={authLoading}>
            {authLoading ? "Signing Up..." : "Sign Up"}
          </Button>
        </form>
        <div className="flex items-center gap-4 py-2">
          <Divider className="flex-1" />
          <p className="shrink-0 text-tiny text-default-500">OR</p>
          <Divider className="flex-1" />
        </div>
        <div className="flex flex-col gap-2">
          {authError &&
            !authLoading && ( // Also show general auth error here if not specific to email/pass
              <p className="text-danger text-center text-small">
                {authError.message}
              </p>
            )}
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
