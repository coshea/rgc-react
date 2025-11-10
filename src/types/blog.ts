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
