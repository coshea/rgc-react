import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  POPUP_MARKDOWN_CLASS,
  type HomePopupContent,
} from "@/components/home-popup/home-popup-dialog";

/**
 * Static picture of the popup for the editor and template picker. The real,
 * interactive one is `HomePopupDialog` (used by "Preview on this page").
 */
export function HomePopupPreviewCard({ popup }: { popup: HomePopupContent }) {
  const showButton = !!popup.ctaLabel?.trim() && !!popup.ctaLink?.trim();
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-3xl bg-overlay p-5 shadow-overlay"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon icon="lucide:megaphone" className="size-5" />
      </span>
      <span className="text-lg font-bold">
        {popup.title || "Untitled popup"}
      </span>
      <div className={`text-sm ${POPUP_MARKDOWN_CLASS}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ a: ({ children }) => <span>{children}</span> }}
        >
          {popup.body || "Message"}
        </ReactMarkdown>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-1 text-sm">
        <span className="rounded-xl bg-default px-3.5 py-2">Not now</span>
        {showButton && (
          <span className="rounded-xl bg-accent px-3.5 py-2 text-accent-foreground">
            {popup.ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}
