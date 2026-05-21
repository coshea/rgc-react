import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Chip,
  Label,
  ListBox,
  SearchField,
  Select,
  Modal,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/utils/admin";
import { usePageTracking } from "@/hooks/usePageTracking";
import { BlogPost, BlogPostStatus, BlogCategory } from "@/types/blog";
import {
  onPublishedBlogPosts,
  onAllBlogPosts,
  mapBlogPostDoc,
  deleteBlogPost,
} from "@/api/blog";
import { addToast } from "@/providers/toast";

export const BlogListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);

  usePageTracking("Club Announcements");

  const [posts, setPosts] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<
    BlogCategory | "all"
  >("all");
  const [showAllPosts, setShowAllPosts] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Load blog posts
  React.useEffect(() => {
    setLoading(true);
    const unsub = (
      isAdmin && showAllPosts ? onAllBlogPosts : onPublishedBlogPosts
    )(
      (snap) => {
        const blogPosts = snap.docs.map(mapBlogPostDoc);
        setPosts(blogPosts);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load blog posts", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [isAdmin, showAllPosts]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      // Optimistically remove from UI
      setPosts((prev) => prev.filter((p) => p.id !== deleteConfirm.id));

      await deleteBlogPost(deleteConfirm.id);
      addToast({
        title: "Deleted",
        description: "Blog post removed",
        color: "success",
      });
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Delete failed", error);
      addToast({
        title: "Error",
        description: "Failed to delete post",
        color: "danger",
      });
      // Refresh the list on error to restore the post
      setLoading(true);
    } finally {
      setDeleting(false);
    }
  };

  // Filter posts
  const filteredPosts = React.useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        !searchTerm ||
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        filterCategory === "all" || post.category === filterCategory;

      return matchesSearch && matchesCategory;
    });
  }, [posts, searchTerm, filterCategory]);

  const formatDate = (date: any) => {
    if (!date) return "Not published";
    const d =
      date instanceof Date
        ? date
        : date.toDate
          ? date.toDate()
          : new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-6xl mx-auto pt-4 pb-10">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold">Club Announcements</h1>
          {isAdmin && (
            <Button
              variant="primary"
              onPress={() => navigate("/announcements/new")}
            >
              <Icon icon="lucide:plus" />
              New Post
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchField
            className="flex-1"
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={() => setSearchTerm("")}
            aria-label="Search posts"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search posts..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Select
            className="sm:w-64"
            selectedKey={filterCategory}
            onSelectionChange={(key) => {
              if (key) setFilterCategory(key as BlogCategory | "all");
            }}
          >
            <Label>Category</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all" textValue="All Categories">
                  All Categories
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {Object.values(BlogCategory).map((cat) => (
                  <ListBox.Item key={cat} id={cat} textValue={cat}>
                    {cat}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {isAdmin && (
            <Button
              variant={showAllPosts ? "primary" : "tertiary"}
              onPress={() => setShowAllPosts(!showAllPosts)}
            >
              <Icon icon={showAllPosts ? "lucide:eye" : "lucide:eye-off"} />
              {showAllPosts ? "All" : "Published"}
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-24">
          <Icon
            icon="lucide:loader"
            className="animate-spin text-4xl text-accent"
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPosts.length === 0 && (
        <Card>
          <Card.Content className="text-center py-12">
            <Icon
              icon="lucide:file-text"
              className="text-6xl text-muted mx-auto mb-4"
            />
            <p className="text-xl text-muted">No blog posts found</p>
            {isAdmin && (
              <Button
                variant="primary"
                className="mt-4"
                onPress={() => navigate("/announcements/new")}
              >
                <Icon icon="lucide:plus" />
                Create Your First Post
              </Button>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Blog Posts List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <Card
            key={post.id}
            onPress={
              !isAdmin
                ? () => navigate(`/announcements/${post.slug}`)
                : undefined
            }
          >
            <Card.Content className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Featured Image */}
                {post.featuredImage && (
                  <div className="md:w-48 md:shrink-0">
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-32 md:h-full object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {post.isPinned && (
                          <Chip size="sm" variant="tertiary">
                            <Icon
                              icon="lucide:pin"
                              className="inline-block w-3 h-3 mr-0.5 align-[-1px]"
                            />
                            Pinned
                          </Chip>
                        )}
                        <Chip size="sm" variant="tertiary">
                          {post.category}
                        </Chip>
                        {isAdmin && (
                          <Chip
                            size="sm"
                            color={
                              post.status === BlogPostStatus.Published
                                ? "success"
                                : "default"
                            }
                            variant="tertiary"
                          >
                            {post.status}
                          </Chip>
                        )}
                      </div>
                      {isAdmin ? (
                        <Button
                          variant="ghost"
                          className="w-full h-auto p-0 data-[hover=true]:bg-transparent"
                          onPress={() =>
                            navigate(`/announcements/${post.slug}`)
                          }
                        >
                          <h2 className="w-full text-lg md:text-2xl font-bold mb-2 line-clamp-2 text-left break-words">
                            {post.title}
                          </h2>
                        </Button>
                      ) : (
                        <h2 className="text-lg md:text-2xl font-bold mb-2 line-clamp-2 break-words">
                          {post.title}
                        </h2>
                      )}
                      {post.excerpt && (
                        <p className="text-muted mb-3 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-muted">
                        <span className="flex items-center gap-1">
                          <Icon icon="lucide:user" className="w-4 h-4" />
                          {post.authorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon icon="lucide:calendar" className="w-4 h-4" />
                          {formatDate(post.publishedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="tertiary"
                          isIconOnly
                          onPress={() =>
                            navigate(`/announcements/edit/${post.id}`)
                          }
                          aria-label="Edit post"
                        >
                          <Icon icon="lucide:edit" />
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          isIconOnly
                          onPress={() =>
                            setDeleteConfirm({
                              id: post.id!,
                              title: post.title,
                            })
                          }
                          aria-label="Delete post"
                        >
                          <Icon icon="lucide:trash-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteConfirm(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>Delete Blog Post</Modal.Header>
              <Modal.Body>
                <p>
                  Are you sure you want to delete "{deleteConfirm?.title}"? This
                  cannot be undone.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="tertiary"
                  onPress={() => !deleting && setDeleteConfirm(null)}
                  isDisabled={deleting}
                >
                  Cancel
                </Button>
                <Button variant="danger" onPress={handleDelete}>
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>{" "}
        </Modal.Backdrop>{" "}
      </Modal>
    </div>
  );
};
