import { title } from "@/components/primitives";
import { siteConfig } from "@/config/site";
import { Button, Link, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <section className="flex flex-col items-center justify-center gap-6 py-8 md:py-12">
      <div className="inline-block max-w-3xl text-center justify-center">
        <h1 className={title()}>About Ridgefield Golf Club</h1>
        <p className="mt-3 text-default-600">
          Founded in 1974, the Ridgefield Golf Club is a lively community of
          roughly 300 golfers—residents and non-residents alike—ranging from
          weekend hackers to serious competitors. We exist to create great golf,
          friendly rivalry, and lasting friendships.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-xl font-semibold">Tournaments & Events</h2>
            <p className="text-default-600">
              Each season we run about 15 member tournaments—from quick fun
              formats to full competitive events. Winners earn Pro‑Shop credit
              to redeem on gear and merchandise.
            </p>
            <div className="pt-2">
              <Button
                as={Link}
                href={siteConfig.pages.tournaments.link}
                color="primary"
                variant="flat"
                endContent={<Icon icon="lucide:chevron-right" />}
              >
                View Tournaments
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-xl font-semibold">Membership</h2>
            <p className="text-default-600">
              Whether you’re new in town or a long-time local, our club offers
              organized play, social events, and opportunities to improve your
              game in an inclusive atmosphere.
            </p>
            <div className="pt-2">
              <Button
                as={Link}
                href={siteConfig.pages.membership.link}
                color="secondary"
                variant="flat"
                endContent={<Icon icon="lucide:user-plus" />}
              >
                Become a Member
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="max-w-3xl text-center text-default-500 text-sm">
        <p>
          Have questions? You can reach us any time via the contact section on
          the home page.
        </p>
        <p>
          <a
            href={siteConfig.pages.contact.link}
            className="text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              navigate(siteConfig.pages.home.link, {
                state: { scrollTo: "home-contact-section" },
              });
            }}
          >
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
}
