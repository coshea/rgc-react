import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Button, Chip, Link, Modal } from "@heroui/react";
import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { HomePopup } from "@/types/homePopup";
import { isInternalLink } from "@/utils/homePopup";

/** Styles for everything the message's markdown editor can produce. */
export const POPUP_MARKDOWN_CLASS =
  "leading-relaxed text-foreground/80 [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold [&_em]:italic " +
  "[&_p+*]:mt-3 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:mt-1 " +
  "[&_.contains-task-list]:ml-0 [&_.contains-task-list]:list-none [&_input]:mr-2 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-separator [&_blockquote]:pl-3 [&_blockquote]:italic " +
  "[&_code]:rounded [&_code]:bg-default [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] " +
  "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-sm [&_th]:border-b [&_th]:border-separator [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:px-2 [&_td]:py-1";

export type HomePopupContent = Pick<
  HomePopup,
  "title" | "body" | "ctaLabel" | "ctaLink"
>;

interface HomePopupDialogProps {
  popup: HomePopupContent;
  isOpen: boolean;
  /** X, "Not now", Escape or a backdrop tap. */
  onClose: () => void;
  /** The button or a link in the message was pressed. Not called in preview. */
  onFollowLink?: (link: string) => void;
  /** Admin preview: links don't navigate, so the editor keeps its state. */
  preview?: boolean;
}

/**
 * The home page popup. A bottom sheet on phones, centred on larger screens
 * (`placement="auto"`).
 */
export function HomePopupDialog({
  popup,
  isOpen,
  onClose,
  onFollowLink,
  preview = false,
}: HomePopupDialogProps) {
  const [blockedLink, setBlockedLink] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) setBlockedLink(null);
  }, [isOpen]);

  const follow = (link: string) => {
    if (preview) setBlockedLink(link);
    else onFollowLink?.(link);
  };

  // Message links go through `follow` too, so they dismiss first (or are
  // blocked in preview) instead of navigating on their own.
  const handleMarkdownLink = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    event.preventDefault();
    follow(href);
  };

  const ctaLabel = popup.ctaLabel?.trim();
  const ctaLink = popup.ctaLink?.trim();

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container placement="auto" size="md">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={preview ? "Close preview" : "Close"} />
          <Modal.Header className="flex flex-col items-start gap-3">
            {preview && (
              <Chip size="sm" variant="primary" color="default">
                <Icon icon="lucide:eye" aria-hidden />
                Preview · only you see this · links are off
              </Chip>
            )}
            <Modal.Icon className="bg-accent-soft text-accent">
              <Icon icon="lucide:megaphone" className="size-5" aria-hidden />
            </Modal.Icon>
            <Modal.Heading className="text-xl font-bold">
              {popup.title || "Untitled popup"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className={`text-[15px] ${POPUP_MARKDOWN_CLASS}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }: { href?: string; children?: ReactNode }) => (
                  // Native anchor so in-app links can route without a reload.
                  <a
                    href={href}
                    target={href && !isInternalLink(href) ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => href && handleMarkdownLink(e, href)}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {popup.body}
            </ReactMarkdown>
            {blockedLink && (
              <div
                role="status"
                className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-default px-3 py-2.5 text-sm text-foreground"
              >
                <span>
                  Links are off in preview. This one goes to{" "}
                  <code className="font-mono">{blockedLink}</code>.
                </span>
                <Link
                  href={blockedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-8 text-sm"
                >
                  Open in new tab
                  <Link.Icon />
                </Link>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="tertiary"
              className="h-12 w-full sm:h-10 sm:w-auto"
              onPress={onClose}
            >
              Not now
            </Button>
            {ctaLabel && ctaLink && (
              <Button
                className="h-12 w-full sm:h-10 sm:w-auto"
                onPress={() => follow(ctaLink)}
              >
                {ctaLabel}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
