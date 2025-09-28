import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, Spinner, Link } from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider";
import { siteConfig } from "@/config/site";
import { sendEmailVerification, ActionCodeSettings } from "firebase/auth";
import { Icon } from "@iconify/react";

const RESEND_DELAY_MS = 60000; // 60s cooldown

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const [cooldownEnds, setCooldownEnds] = useState<number>(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const remainingMs = Math.max(0, cooldownEnds - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const actionCodeSettings: ActionCodeSettings = {
    url: window.location.origin + "/verify-email",
    handleCodeInApp: true,
  };

  const triggerResend = useCallback(async () => {
    if (!user || remainingMs > 0) return;
    setResendLoading(true);
    setMessage(null);
    try {
      await sendEmailVerification(user, actionCodeSettings);
      setCooldownEnds(Date.now() + RESEND_DELAY_MS);
      setMessage("Verification email sent. Check your inbox.");
    } catch (e: any) {
      setMessage(e.message || "Failed to send verification email.");
    } finally {
      setResendLoading(false);
    }
  }, [user, remainingMs]);

  const checkStatus = useCallback(async () => {
    if (!user) return;
    setChecking(true);
    setMessage(null);
    try {
      await user.reload();
      if (user.emailVerified) {
        window.location.replace(siteConfig.pages.profile.link);
      } else {
        setMessage("Still not verified yet.");
      }
    } catch (e: any) {
      setMessage(e.message || "Failed to refresh user status.");
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.emailVerified) {
      // Already verified -> go straight to profile
      window.location.replace(siteConfig.pages.profile.link);
    }
  }, [user?.emailVerified]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <Spinner label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <Card className="max-w-md w-full">
          <CardBody>
            <p className="text-sm mb-4">You need to sign in first.</p>
            <Button
              color="primary"
              onPress={() =>
                window.location.replace(siteConfig.pages.login.link)
              }
            >
              Go to Login
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="max-w-lg w-full">
        <CardBody className="space-y-5">
          <div className="flex items-center gap-2 text-large font-medium">
            <Icon icon="lucide:mail" className="w-5 h-5" />
            Verify Your Email
          </div>
          <p className="text-small text-default-500 leading-relaxed">
            We sent a verification link to{" "}
            <span className="font-medium">{user.email}</span>. Please click the
            link in that email to verify your address. Once verified, refresh
            your status below to continue. If you don't see the email, check
            your spam folder.
          </p>
          {message && (
            <div className="text-tiny text-default-600 bg-content2 rounded-medium px-3 py-2">
              {message}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              fullWidth
              color="primary"
              onPress={checkStatus}
              isLoading={checking}
              startContent={
                !checking && (
                  <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
                )
              }
            >
              {checking ? "Checking..." : "I Verified / Refresh"}
            </Button>
            <Button
              fullWidth
              variant="flat"
              onPress={triggerResend}
              isDisabled={remainingMs > 0 || resendLoading}
              isLoading={resendLoading}
              startContent={
                !resendLoading && (
                  <Icon icon="lucide:send" className="w-4 h-4" />
                )
              }
            >
              {remainingMs > 0
                ? `Resend (${remainingSeconds}s)`
                : "Resend Email"}
            </Button>
          </div>
          <div className="text-tiny text-default-400">
            Wrong email?{" "}
            <Link href={siteConfig.pages.profile.link}>Go to profile</Link> or{" "}
            <Link href={siteConfig.pages.login.link}>log out</Link> and sign up
            again.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
