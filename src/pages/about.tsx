import { title } from "@/components/primitives";
import { siteConfig } from "@/config/site";
import { Button, Link, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function AboutPage() {
  usePageTracking("About");
  return (
    <section className="flex flex-col items-center justify-center gap-6 py-8 md:py-12">
      <div className="inline-block max-w-3xl text-center justify-center">
        <h1 className={title()}>About Ridgefield Golf Club</h1>
        <p className="mt-3 text-foreground">
          Founded in 1974, the Ridgefield Golf Club is a lively community of
          roughly 300 golfers—residents and non-residents alike—ranging from
          weekend hackers to serious competitors. We exist to create great golf,
          friendly rivalry, and lasting friendships.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
        <Card>
          <Card.Content className="space-y-2">
            <h2 className="text-xl font-semibold">Tournaments & Events</h2>
            <p className="text-foreground">
              Each season we run about 15 member tournaments—from quick fun
              formats to full competitive events. Winners earn Pro‑Shop credit
              to redeem on gear and merchandise.
            </p>
            <div className="pt-2">
              <Button
                as={Link}
                href={siteConfig.pages.tournaments.link}
                variant="tertiary"
              >
                View Tournaments
                <Icon icon="lucide:chevron-right" />
              </Button>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="space-y-2">
            <h2 className="text-xl font-semibold">Membership</h2>
            <p className="text-foreground">
              Whether you’re new in town or a long-time local, our club offers
              organized play, social events, and opportunities to improve your
              game in an inclusive atmosphere.
            </p>
            <div className="pt-2">
              <Button
                as={Link}
                href={siteConfig.pages.membership.link}
                variant="tertiary"
              >
                Become a Member
                <Icon icon="lucide:user-plus" />
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>

      <div className="max-w-3xl text-center text-muted text-sm">
        <p>
          Have questions? You can reach us any time via the contact section on
          the home page.
        </p>
        <p>
          <a
            href={siteConfig.pages.contact.link}
            className="text-accent hover:underline"
          >
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
}
