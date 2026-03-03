import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Button, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { BlogPost } from "@/types/blog";
import { onPublishedBlogPosts, mapBlogPostDoc } from "@/api/blog";

interface RecentBlogPostsProps {
  limit?: number;
  showViewAll?: boolean;
}

export const RecentBlogPosts: React.FC<RecentBlogPostsProps> = ({
  limit = 3,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const [posts, setPosts] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = onPublishedBlogPosts(
      (snap) => {
        const blogPosts = snap.docs.map(mapBlogPostDoc);
        setPosts(blogPosts);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load blog posts", err);
        setLoading(false);
      },
      limit,
    );
    return () => unsub();
  }, [limit]);

  const formatDate = (date: any) => {
    if (!date) return "";
    const d =
      date instanceof Date
        ? date
        : date.toDate
          ? date.toDate()
          : new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <section className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-4 w-80 max-w-[90vw] rounded-lg" />
          </div>
          {showViewAll && <Skeleton className="h-8 w-24 rounded-lg" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: limit }).map((_, idx) => (
            <Card key={idx} className="w-full h-full">
              <CardBody className="p-0">
                <div className="h-32 w-full">
                  <Skeleton className="h-full w-full rounded-t-lg" />
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-full rounded-lg" />
                  <Skeleton className="h-4 w-11/12 rounded-lg" />
                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                  <div className="pt-1">
                    <Skeleton className="h-4 w-2/3 rounded-lg" />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return null; // Don't show section if no posts
  }

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-4 pb-8 overflow-x-hidden">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold mb-1">Latest News</h2>
          <p className="text-sm text-foreground-500">
            Stay updated with club announcements and tournament results
          </p>
        </div>
        {showViewAll && (
          <Button
            size="sm"
            variant="flat"
            onPress={() => navigate("/announcements")}
            endContent={<Icon icon="lucide:arrow-right" className="w-3 h-3" />}
            className="self-start sm:self-auto"
          >
            View All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {posts.map((post) => (
          <Card
            key={post.id}
            isPressable
            onPress={() => navigate(`/announcements/${post.slug}`)}
            className="w-full h-full"
          >
            <CardBody className="p-0">
              <div className="flex flex-col h-full">
                {post.featuredImage && (
                  <div className="h-32 w-full shrink-0 overflow-hidden">
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 mb-2">
                    {post.isPinned && (
                      <Chip
                        size="sm"
                        color="warning"
                        variant="flat"
                        startContent={
                          <Icon icon="lucide:pin" className="w-3 h-3" />
                        }
                      >
                        Pinned
                      </Chip>
                    )}
                    <Chip size="sm" variant="flat">
                      {post.category}
                    </Chip>
                  </div>

                  <h3 className="text-lg font-bold mb-1.5 line-clamp-2">
                    {post.title}
                  </h3>

                  {post.excerpt && (
                    <p className="text-foreground-600 text-sm mb-2 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-foreground-500 mt-auto">
                    <span className="flex items-center gap-1">
                      <Icon icon="lucide:user" className="w-3 h-3" />
                      {post.authorName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon icon="lucide:calendar" className="w-3 h-3" />
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
};
