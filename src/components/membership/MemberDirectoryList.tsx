import type React from "react";
import { Button } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import type { User } from "@/api/users";
import type { MemberSection } from "@/utils/memberDirectory";
import { type EmailIssue, emailIssueDocId } from "@@/types";
import { LetterScrubber } from "./LetterScrubber";
import { MemberDirectoryRow, memberRowId } from "./MemberDirectoryRow";

interface MemberDirectoryListProps {
  sections: MemberSection[];
  isAdmin: boolean;
  isDesktop: boolean;
  selectedId: string | null;
  /** Email delivery issues keyed by doc id (admins only; empty otherwise). */
  emailIssues: Map<string, EmailIssue>;
  year: number;
  query: string;
  onClearSearch: () => void;
  onMore: (member: User) => void;
}

function sectionId(letter: string) {
  return `letter-${letter === "#" ? "other" : letter}`;
}

export function MemberDirectoryList({
  sections,
  isAdmin,
  isDesktop,
  selectedId,
  emailIssues,
  year,
  query,
  onClearSearch,
  onMore,
}: MemberDirectoryListProps) {
  const navigate = useNavigate();

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-4 py-10 text-center">
        <p className="text-muted">
          {query.trim()
            ? `No members match “${query.trim()}”.`
            : "No members to show."}
        </p>
        {query.trim() && (
          <Button variant="tertiary" className="h-11" onPress={onClearSearch}>
            Clear search
          </Button>
        )}
      </div>
    );
  }

  const jumpTo = (letter: string) => {
    document
      .getElementById(sectionId(letter))
      ?.scrollIntoView({ block: "start" });
  };

  // Desktop: ↑/↓ move the selection through the list.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const ids = sections.flatMap((s) => s.members.map((m) => m.id));
    const current = selectedId ? ids.indexOf(selectedId) : -1;
    const next =
      e.key === "ArrowDown"
        ? Math.min(current + 1, ids.length - 1)
        : Math.max(current - 1, 0);
    const id = ids[next];
    if (!id || id === selectedId) return;
    e.preventDefault();
    navigate({ search: `?member=${encodeURIComponent(id)}` }, { replace: true });
    requestAnimationFrame(() => {
      const row = document.getElementById(memberRowId(id));
      row?.focus();
      row?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <>
      <nav
        aria-label="Members"
        onKeyDown={isDesktop ? handleKeyDown : undefined}
        className={clsx(
          isDesktop
            ? "h-[calc(100dvh-15rem)] min-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-surface pb-2"
            : "pr-6",
        )}
      >
        {sections.map((section) => (
          <section
            key={section.letter}
            id={sectionId(section.letter)}
            aria-labelledby={`${sectionId(section.letter)}-heading`}
            className="scroll-mt-(--directory-sticky-top) lg:scroll-mt-0"
          >
            <h2
              id={`${sectionId(section.letter)}-heading`}
              className="sticky top-(--directory-sticky-top) z-10 bg-background px-1 pb-2 pt-4 text-3xl leading-none text-accent lg:top-0 lg:bg-surface lg:px-4 lg:pb-1.5 lg:pt-3.5 lg:text-xl"
            >
              {section.letter}
            </h2>
            <ul
              className={clsx(
                isDesktop
                  ? "px-2"
                  : "divide-y divide-separator rounded-2xl bg-surface",
              )}
            >
              {section.members.map((m) => (
                <MemberDirectoryRow
                  key={m.id}
                  member={m}
                  isAdmin={isAdmin}
                  isDesktop={isDesktop}
                  isSelected={m.id === selectedId}
                  hasEmailIssue={
                    !!m.email && emailIssues.has(emailIssueDocId(m.email))
                  }
                  year={year}
                  onMore={onMore}
                />
              ))}
            </ul>
          </section>
        ))}
      </nav>
      {!isDesktop && (
        <LetterScrubber
          letters={sections.map((s) => s.letter)}
          onJump={jumpTo}
        />
      )}
    </>
  );
}
