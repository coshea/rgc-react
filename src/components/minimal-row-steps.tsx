import { Button } from "@heroui/react";

export interface MinimalRowStepsProps {
  currentStep: number;
  stepsCount: number;
  label?: string;
  onStepChange?: (nextStep: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function MinimalRowSteps({
  currentStep,
  stepsCount,
  label,
  onStepChange,
}: MinimalRowStepsProps) {
  const safeStepsCount = Math.max(1, Math.floor(stepsCount));
  const safeCurrent = clamp(Math.floor(currentStep), 0, safeStepsCount - 1);

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-3 text-center text-sm text-default-500">{label}</div>
      ) : null}

      <div className="flex items-center gap-2">
        {Array.from({ length: safeStepsCount }).map((_, index) => {
          const isComplete = index < safeCurrent;
          const isCurrent = index === safeCurrent;

          return (
            <div key={index} className="flex flex-1 items-center gap-2">
              <Button
                isIconOnly
                radius="full"
                size="sm"
                variant={isCurrent ? "solid" : "flat"}
                color={isCurrent || isComplete ? "primary" : "default"}
                aria-label={`Go to step ${index + 1}`}
                onPress={() => onStepChange?.(index)}
                className={
                  isCurrent
                    ? "min-w-0"
                    : isComplete
                      ? "min-w-0"
                      : "min-w-0 opacity-70"
                }
              >
                <span className="text-xs font-semibold">{index + 1}</span>
              </Button>

              {index < safeStepsCount - 1 ? (
                <div
                  aria-hidden
                  className={
                    "h-1 w-full rounded-full " +
                    (isComplete
                      ? "bg-primary"
                      : isCurrent
                        ? "bg-primary/40"
                        : "bg-default-200")
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
