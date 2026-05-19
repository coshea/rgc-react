import { Link, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const scrollTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  };
  return (
    <footer className="mt-12 border-t/60 dark:/10 bg-linear-to-b from-background to-default-100/20 dark:from-black/40 dark:to-black/70">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          {/* Brand centered */}
          <div className="flex items-center gap-2 text-foreground">
            <img
              src="/rgc_fav.png"
              alt="Ridgefield Golf Club logo"
              className="h-6 w-6 sm:h-7 sm:w-7 rounded"
            />
            <span className="text-base sm:text-lg font-semibold">
              Ridgefield Golf Club
            </span>
          </div>

          {/* Nav links row */}
          <nav className="flex flex-wrap justify-center gap-3 sm:gap-6 text-muted text-sm sm:text-base">
            <Link
              href={siteConfig.pages.home.link}
              
              className="hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href={siteConfig.pages.about.link}
              
              className="hover:text-foreground"
            >
              About
            </Link>
            <Link
              href={siteConfig.pages.tournaments.link}
              
              className="hover:text-foreground"
            >
              Tournaments
            </Link>
            <Link
              href={siteConfig.pages.moneyList.link}
              
              className="hover:text-foreground"
            >
              Money List
            </Link>
            <Link
              href={siteConfig.pages.membership.link}
              
              className="hover:text-foreground"
            >
              Membership
            </Link>
            <Link
              href={siteConfig.pages.contact.link}
              
              className="hover:text-foreground"
            >
              Contact
            </Link>
            <Link
              href={siteConfig.pages.cookies.link}
              
              className="hover:text-foreground"
            >
              Cookies
            </Link>
          </nav>

          {/* Social links removed per request */}

          {/* Bottom row: copyright + back to top */}
          <div className="mt-2 sm:mt-4 w-full flex flex-col sm:flex-row items-center sm:items-start justify-center sm:justify-between gap-3 text-[11px] sm:text-xs text-muted">
            <div className="flex flex-col gap-1 items-center text-center sm:items-start sm:text-left">
              <p>© {year} Ridgefield Golf Club. All rights reserved.</p>
              <p>
                This site is protected by reCAPTCHA and the Google{" "}
                <Link
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] sm:text-xs font-normal text-inherit underline underline-offset-2 hover:opacity-80"
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] sm:text-xs font-normal text-inherit underline underline-offset-2 hover:opacity-80"
                >
                  Terms of Service
                </Link>{" "}
                apply.
              </p>
            </div>
            <div className="flex sm:justify-end justify-center w-full sm:w-auto">
              <Button
                size="sm"
                isIconOnly
                variant="tertiary"
                aria-label="Back to top"
                onPress={scrollTop}
                className="rounded-full"
              >
                <Icon icon="lucide:chevron-up" width={20} height={20} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
