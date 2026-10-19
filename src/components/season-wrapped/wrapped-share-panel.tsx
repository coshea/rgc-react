import { useEffect, useMemo } from "react";
import { Button } from "@heroui/react";
import * as Sentry from "@sentry/react";

import { addToast } from "@/providers/toast";

interface WrappedSharePanelProps {
  year: number;
  /** The rendered PNG, loaded before this card appears; undefined while loading. */
  image: Blob | undefined;
  isLoading: boolean;
  isError: boolean;
  onShared: (method: "share_sheet" | "download") => void;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * The share card's buttons (the mockup's pills). Shares the PNG through the
 * phone's share sheet when the browser supports files, otherwise saves it.
 */
export function WrappedSharePanel({ year, image, isLoading, isError, onShared }: WrappedSharePanelProps) {
  const fileName = `rgc-wrapped-${year}.png`;
  const url = useMemo(() => (image ? URL.createObjectURL(image) : undefined), [image]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const file = useMemo(() => (image ? new File([image], fileName, { type: "image/png" }) : undefined), [image, fileName]);
  const canShareFile = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const save = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    onShared("download");
  };

  const share = async () => {
    if (!file) return;
    try {
      // Called straight from the tap with the file already in memory, so iOS
      // keeps the user gesture and opens the share sheet.
      await navigator.share({ files: [file], text: `My ${year} season at Ridgefield Golf Club` });
      onShared("share_sheet");
    } catch (error) {
      if (isAbort(error)) return;
      Sentry.captureException(error);
      addToast({
        title: "Couldn't open sharing",
        description: "Save the image instead and share it from your photos.",
        color: "warning",
      });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="wr-btnrow">
        <Button
          className="wr-pill wr-pill-p"
          onPress={canShareFile ? share : save}
          isDisabled={!image}
          isPending={isLoading && !image}
        >
          {canShareFile ? "Share" : "Save image"}
        </Button>
        {canShareFile && (
          <Button variant="outline" className="wr-pill wr-pill-s" onPress={save} isDisabled={!url}>
            Save image
          </Button>
        )}
      </div>
      {isError && <p className="wr-foot">The share image isn&apos;t available right now.</p>}
    </div>
  );
}
