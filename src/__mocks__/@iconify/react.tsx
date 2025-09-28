/* eslint-disable */
// Lightweight mock of @iconify/react Icon component to prevent internal timers/state
// interfering with test teardown. Accepts any props but renders a simple span.
export const Icon = (props: {
  icon?: string;
  className?: string;
  [k: string]: any;
}) => {
  return (
    <span
      data-icon={props.icon || "mock-icon"}
      className={props.className || ""}
    />
  );
};

export default Icon;
