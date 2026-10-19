import type { Timestamp } from "firebase/firestore";

export interface BlogPost {
  // Firestore document ID
  id?: string;

  // Core content
  title: string;
  slug: string; // URL-friendly version of title
  content: string; // Rich text HTML content
  excerpt?: string; // Short summary (auto-generated if not provided)

  // Metadata
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;

  // Publishing
  status: BlogPostStatus;
  publishedAt?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;

  // Categorization
  category: BlogCategory;
  tags?: string[];

  // Features
  featuredImage?: string; // URL to image
  isPinned?: boolean; // Pin to top of list

  // Template data (for tournament posts)
  templateType?: BlogTemplateType;
  tournamentId?: string; // Reference to tournament if using template
}

export enum BlogPostStatus {
  Draft = "draft",
  Published = "published",
  Archived = "archived",
}

export enum BlogCategory {
  Announcement = "Announcement",
  TournamentResults = "Tournament Results",
  TeeTimes = "Tee Times",
  ClubNews = "Club News",
  Event = "Event",
  General = "General",
}

export enum BlogTemplateType {
  TournamentResults = "tournament-results",
  TeeTimes = "tee-times",
  GeneralAnnouncement = "general-announcement",
  Custom = "custom",
}

// For the blog list/history view
export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  authorName: string;
  authorPhotoURL?: string;
  publishedAt?: Date | Timestamp;
  category: BlogCategory;
  tags?: string[];
  featuredImage?: string;
  isPinned?: boolean;
}

// Emoji reactions members can leave on a published post. Firestore stores the
// `key`, never the emoji itself. Keep the keys in step with the
// `blogPosts/{postId}/reactions` rule in firestore.rules (a spec checks this).
// Display order follows this array.
export const BLOG_REACTIONS = [
  { key: "thumbsUp", emoji: "👍", label: "Thumbs up" },
  { key: "heart", emoji: "❤️", label: "Love" },
  { key: "laugh", emoji: "😂", label: "Haha" },
  { key: "clap", emoji: "👏", label: "Applause" },
  { key: "party", emoji: "🎉", label: "Celebrate" },
  { key: "flag", emoji: "⛳", label: "Pin high" },
  { key: "golfer", emoji: "🏌️", label: "Nice swing" },
  { key: "trophy", emoji: "🏆", label: "Champion" },
  { key: "birdie", emoji: "🐦", label: "Birdie" },
  { key: "eagle", emoji: "🦅", label: "Eagle" },
] as const;

export type BlogReactionDef = (typeof BLOG_REACTIONS)[number];
export type ReactionKey = BlogReactionDef["key"];

export const BLOG_REACTION_KEYS: readonly ReactionKey[] = BLOG_REACTIONS.map(
  (r) => r.key,
);

export function isReactionKey(value: unknown): value is ReactionKey {
  return (
    typeof value === "string" &&
    (BLOG_REACTION_KEYS as readonly string[]).includes(value)
  );
}

/** One member's reactions to a post (`blogPosts/{postId}/reactions/{uid}`). */
export interface BlogReaction {
  uid: string;
  emojis: ReactionKey[];
}
