// Centralized blog-related Firestore access.
// Following project conventions: components import from this module, not directly from firebase SDK.
import { toDate } from "@/api/users";
import { db } from "@/config/firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  where,
  limit,
  deleteDoc,
  FirestoreError,
  getDocs,
  addDoc,
  setDoc,
  serverTimestamp,
  FieldValue,
} from "firebase/firestore";
import { BlogPost, BlogPostStatus, BlogCategory } from "@/types/blog";

const BLOG_COLLECTION = "blogPosts";

// Map Firestore document to BlogPost
export function mapBlogPostDoc(snap: any): BlogPost {
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title || "",
    slug: data.slug || "",
    content: data.content || "",
    excerpt: data.excerpt,
    authorId: data.authorId || "",
    authorName: data.authorName || "",
    authorPhotoURL: data.authorPhotoURL,
    status: data.status || BlogPostStatus.Draft,
    publishedAt: toDate(data.publishedAt) || undefined,
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
    category: data.category || BlogCategory.General,
    tags: data.tags || [],
    featuredImage: data.featuredImage,
    isPinned: data.isPinned || false,
    templateType: data.templateType,
    tournamentId: data.tournamentId,
  };
}

// Real-time listener for a single blog post
export function onBlogPost(
  id: string,
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void
) {
  const ref = doc(db, BLOG_COLLECTION, id);
  return onSnapshot(ref, next, error);
}

// Real-time listener for published blog posts (ordered by publishedAt desc, pinned first)
export function onPublishedBlogPosts(
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void,
  limitCount?: number
) {
  const col = collection(db, BLOG_COLLECTION);
  let q;
  if (limitCount) {
    q = query(
      col,
      where("status", "==", BlogPostStatus.Published),
      orderBy("isPinned", "desc"),
      orderBy("publishedAt", "desc"),
      limit(limitCount)
    );
  } else {
    q = query(
      col,
      where("status", "==", BlogPostStatus.Published),
      orderBy("isPinned", "desc"),
      orderBy("publishedAt", "desc")
    );
  }
  return onSnapshot(q, next, error);
}

// Real-time listener for all blog posts (admin view)
export function onAllBlogPosts(
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void
) {
  const col = collection(db, BLOG_COLLECTION);
  const q = query(col, orderBy("updatedAt", "desc"));
  return onSnapshot(q, next, error);
}

// Get published posts by category
export async function getBlogPostsByCategory(
  category: BlogCategory,
  limitCount = 10
): Promise<BlogPost[]> {
  const col = collection(db, BLOG_COLLECTION);
  const q = query(
    col,
    where("status", "==", BlogPostStatus.Published),
    where("category", "==", category),
    orderBy("publishedAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapBlogPostDoc);
}

// Get a single blog post by slug
export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPost | null> {
  const col = collection(db, BLOG_COLLECTION);
  // Public-safe: only fetch published posts by slug.
  // Admins access drafts via the editor routes by document id.
  const q = query(
    col,
    where("slug", "==", slug),
    where("status", "==", BlogPostStatus.Published),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapBlogPostDoc(snap.docs[0]);
}

// Create a new blog post
export async function createBlogPost(
  post: Omit<BlogPost, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const col = collection(db, BLOG_COLLECTION);
  const docData = {
    ...post,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: post.publishedAt || null,
  };
  const docRef = await addDoc(col, docData);
  return docRef.id;
}

// Update an existing blog post
export async function updateBlogPost(
  id: string,
  updates: Partial<
    Omit<BlogPost, "createdAt" | "updatedAt" | "publishedAt">
  > & {
    createdAt?: BlogPost["createdAt"] | FieldValue;
    updatedAt?: BlogPost["updatedAt"] | FieldValue;
    publishedAt?: BlogPost["publishedAt"] | FieldValue;
  }
): Promise<void> {
  const docRef = doc(db, BLOG_COLLECTION, id);
  type BlogPostUpdatePayload = Partial<
    Omit<BlogPost, "id" | "createdAt" | "updatedAt" | "publishedAt">
  > & {
    createdAt?: BlogPost["createdAt"] | FieldValue;
    publishedAt?: BlogPost["publishedAt"] | FieldValue;
    updatedAt: FieldValue;
  };

  const updateData: BlogPostUpdatePayload = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Remove undefined values (functional, non-mutating)
  const cleanData = Object.fromEntries(
    Object.entries(updateData).filter(([_, v]) => v !== undefined)
  );

  await setDoc(docRef, cleanData, { merge: true });
}

// Delete a blog post
export async function deleteBlogPost(id: string): Promise<void> {
  const docRef = doc(db, BLOG_COLLECTION, id);
  await deleteDoc(docRef);
}

// Publish a draft post
export async function publishBlogPost(id: string): Promise<void> {
  await updateBlogPost(id, {
    status: BlogPostStatus.Published,
    publishedAt: serverTimestamp(),
  });
}

// Unpublish a post (move to draft)
export async function unpublishBlogPost(id: string): Promise<void> {
  await updateBlogPost(id, {
    status: BlogPostStatus.Draft,
  });
}

// Generate a URL-friendly slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

// Generate excerpt from HTML content
export function generateExcerpt(html: string, maxLength = 160): string {
  // Strip HTML tags
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

// Search blog posts
export async function searchBlogPosts(
  searchTerm: string,
  limitCount = 20
): Promise<BlogPost[]> {
  // Firestore doesn't support full-text search natively
  // This is a simple implementation that searches in title
  // For production, consider Algolia or similar
  const col = collection(db, BLOG_COLLECTION);
  const q = query(
    col,
    where("status", "==", BlogPostStatus.Published),
    orderBy("publishedAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  const posts = snap.docs.map(mapBlogPostDoc);

  // Client-side filtering
  const lowerSearch = searchTerm.toLowerCase();
  return posts.filter(
    (post) =>
      post.title.toLowerCase().includes(lowerSearch) ||
      post.excerpt?.toLowerCase().includes(lowerSearch) ||
      post.content.toLowerCase().includes(lowerSearch)
  );
}
