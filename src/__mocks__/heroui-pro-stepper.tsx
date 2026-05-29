/**
 * Stub for @heroui-pro/react/stepper used in tests.
 *
 * HeroUI Pro requires a license token to download dist files during `npm install`.
 * In CI without HEROUI_AUTH_TOKEN the real dist is never written, so we alias
 * this specifier to a local stub that Vite can always resolve.
 *
 * Tests that need more specific behavior use vi.mock("@heroui-pro/react/stepper")
 * with an explicit factory, which overrides this stub.
 */
import React from "react";

type WithChildren = { children?: React.ReactNode; className?: string };

const Step = ({ children }: WithChildren) => <div>{children}</div>;
const Indicator = (_props: WithChildren) => null;
const Content = ({ children }: WithChildren) => <div>{children}</div>;
const Title = ({ children }: WithChildren) => <span>{children}</span>;
const Separator = (_props: { className?: string; force?: boolean }) => null;

export const Stepper = Object.assign(
  ({ children }: WithChildren) => (
    <div data-testid="stepper">{children}</div>
  ),
  { Step, Indicator, Content, Title, Separator },
);
