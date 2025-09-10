import React, { useEffect } from "react";
import { Button, Input, Checkbox, Link, Form, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
import { useNavigate, useLocation } from "react-router-dom"; // Import useNavigate

export default function LoginPage() {
  const [isVisible, setIsVisible] = React.useState(false);
  const {
    userLoggedIn, // We can use this to redirect if already logged in
    loginEmailAndPassword, // Import the email/password login function
    signInWithGoogle,
    loading: authLoading,
    error: authError,
  } = useAuth(); // Get auth functions and state

  const toggleVisibility = () => setIsVisible(!isVisible);
  const navigate = useNavigate(); // Initialize navigate
  const location = useLocation();
  const state = (location.state || {}) as { from?: string; message?: string };

  useEffect(() => {
    if (userLoggedIn && !authLoading) {
      // Check if user is logged in and auth is not loading
      const dest = state?.from || siteConfig.pages.home.link;
      navigate(dest);
    }
  }, [userLoggedIn, authLoading, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (email && password) {
      try {
        await loginEmailAndPassword(email, password);
        // Navigate to original destination if provided, otherwise home
        const dest = state?.from || siteConfig.pages.home.link;
        navigate(dest);
      } catch (error) {
        // Error is already set in AuthProvider, but you can log or handle UI specific feedback here
        console.error("Email/Password Sign-In failed on LoginPage:", error);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Navigation or further actions on successful Google sign-in
      // can be handled here or by observing userLoggedIn state elsewhere.
      const dest = state?.from || siteConfig.pages.home.link;
      navigate(dest);
    } catch (error) {
      // Error is already set in AuthProvider, but you can log or handle UI specific feedback here
      console.error("Google Sign-In failed on LoginPage:", error);
    }
  };

  // If already logged in and not loading, render null or a loading indicator to prevent flash of login form
  if (userLoggedIn && !authLoading) {
    return null; // Or a loading spinner
  }
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
          />
          <Input
            isRequired
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
          <div className="flex w-full items-center justify-between px-1 py-2">
            <Checkbox name="remember" size="sm">
              Remember me
            </Checkbox>
            <Link className="text-default-500" href="#" size="sm">
              Forgot password?
            </Link>
          </div>
          {authError &&
            !authLoading && ( // Display error only if not loading from this specific action
              <p className="text-danger text-center text-small -mt-2 mb-1">
                {authError.message}
              </p>
            )}
          <Button
            className="w-full"
            color="primary"
            type="submit"
            isDisabled={authLoading}
          >
            {authLoading ? "Signing In..." : "Sign In"}
          </Button>
        </Form>
        <div className="flex items-center gap-4 py-2">
          <Divider className="flex-1" />
          <p className="shrink-0 text-tiny text-default-500">OR</p>
          <Divider className="flex-1" />
        </div>
        <div className="flex flex-col gap-2">
          {authError &&
            !authLoading && ( // Display error only if not loading from this specific action
              <p className="text-danger text-center text-small">
                {authError.message}
              </p>
            )}
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
