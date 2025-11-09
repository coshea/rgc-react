import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Button, Chip } from "@heroui/react";
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
        const blogPosts = snap.docs.map(mapBlogPostDoc).slice(0, limit);
        setPosts(blogPosts);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load blog posts", err);
        setLoading(false);
      },
      limit
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
        <div className="flex justify-center py-12">
          <Icon
            icon="lucide:loader"
            className="animate-spin text-4xl text-primary"
          />
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return null; // Don't show section if no posts
  }

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">Latest News</h2>
          <p className="text-foreground-500">
            Stay updated with club announcements and tournament results
          </p>
        </div>
        {showViewAll && (
          <Button
            variant="flat"
            onPress={() => navigate("/announcements")}
            endContent={<Icon icon="lucide:arrow-right" />}
          >
            View All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Card
            key={post.id}
            isPressable
            onPress={() => navigate(`/announcements/${post.slug}`)}
            className="h-full"
          >
            {post.featuredImage && (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-3">
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

              <h3 className="text-xl font-bold mb-2 line-clamp-2">
                {post.title}
              </h3>

              {post.excerpt && (
                <p className="text-foreground-600 text-sm mb-3 line-clamp-3">
                  {post.excerpt}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-foreground-500 mt-auto pt-2">
                <span className="flex items-center gap-1">
                  <Icon icon="lucide:user" className="w-3 h-3" />
                  {post.authorName}
                </span>
                <span className="flex items-center gap-1">
                  <Icon icon="lucide:calendar" className="w-3 h-3" />
                  {formatDate(post.publishedAt)}
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
};
