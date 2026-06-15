import { useCallback, useEffect, useState } from "react";
import { Button, Card, Spinner, Link } from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider";
import { siteConfig } from "@/config/site";
import { sendEmailVerification } from "firebase/auth";
import { Icon } from "@iconify/react";
import { usePageTracking } from "@/hooks/usePageTracking";

const RESEND_DELAY_MS = 60000; // 60s cooldown

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  usePageTracking("Verify Email", loading);
  const [cooldownEnds, setCooldownEnds] = useState<number>(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const remainingMs = Math.max(0, cooldownEnds - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const triggerResend = useCallback(async () => {
    if (!user || remainingMs > 0) return;
    setResendLoading(true);
    setMessage(null);
    try {
      const actionCodeSettings = {
        url: window.location.origin + "/verify-email",
        handleCodeInApp: true,
      };
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
        <Spinner aria-label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <Card className="max-w-md w-full">
          <Card.Content>
            <p className="text-sm mb-4">You need to sign in first.</p>
            <Button
              onPress={() =>
                window.location.replace(siteConfig.pages.login.link)
              }
            >
              Go to Login
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="max-w-lg w-full">
        <Card.Content className="space-y-5">
          <div className="flex items-center gap-2 text-lg font-medium">
            <Icon icon="lucide:mail" className="w-5 h-5" />
            Verify Your Email
          </div>
          <p className="text-sm text-muted leading-relaxed">
            We sent a verification link to{" "}
            <span className="font-medium">{user.email}</span>. Please click the
            link in that email to verify your address. Once verified, refresh
            your status below to continue. If you don't see the email, check
            your spam folder.
          </p>
          {message && (
            <div className="text-xs text-foreground bg-surface-secondary rounded-md px-3 py-2">
              {message}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button fullWidth onPress={checkStatus}>
              {!checking && (
                <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
              )}
              {checking ? "Checking..." : "I Verified / Refresh"}
            </Button>
            <Button
              fullWidth
              variant="tertiary"
              onPress={triggerResend}
              isDisabled={remainingMs > 0 || resendLoading}
            >
              {!resendLoading && (
                <Icon icon="lucide:send" className="w-4 h-4" />
              )}
              {remainingMs > 0
                ? `Resend (${remainingSeconds}s)`
                : "Resend Email"}
            </Button>
          </div>
          <div className="text-xs text-muted">
            Wrong email?{" "}
            <Link href={siteConfig.pages.profile.link}>Go to profile</Link> or{" "}
            <Link href={siteConfig.pages.login.link}>log out</Link> and sign up
            again.
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
