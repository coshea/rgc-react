import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
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
    <div className="max-w-5xl mx-auto pt-4 pb-10 px-4">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold">Club Announcements</h1>
          {isAdmin && (
            <Button
              color="primary"
              onPress={() => navigate("/announcements/new")}
              startContent={<Icon icon="lucide:plus" />}
            >
              New Post
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            className="flex-1"
            placeholder="Search posts..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            startContent={
              <Icon icon="lucide:search" className="text-foreground-500" />
            }
            isClearable
            onClear={() => setSearchTerm("")}
          />
          <Select
            className="sm:w-64"
            label="Category"
            selectedKeys={filterCategory ? [filterCategory] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as BlogCategory | "all";
              setFilterCategory(value);
            }}
          >
            {[
              <SelectItem key="all">All Categories</SelectItem>,
              ...Object.values(BlogCategory).map((cat) => (
                <SelectItem key={cat}>{cat}</SelectItem>
              )),
            ]}
          </Select>
          {isAdmin && (
            <Button
              variant={showAllPosts ? "solid" : "flat"}
              onPress={() => setShowAllPosts(!showAllPosts)}
              startContent={
                <Icon icon={showAllPosts ? "lucide:eye" : "lucide:eye-off"} />
              }
            >
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
            className="animate-spin text-4xl text-primary"
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPosts.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <Icon
              icon="lucide:file-text"
              className="text-6xl text-foreground-300 mx-auto mb-4"
            />
            <p className="text-xl text-foreground-500">No blog posts found</p>
            {isAdmin && (
              <Button
                className="mt-4"
                color="primary"
                onPress={() => navigate("/announcements/new")}
                startContent={<Icon icon="lucide:plus" />}
              >
                Create Your First Post
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* Blog Posts List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <Card
            key={post.id}
            isPressable={!isAdmin}
            onPress={
              !isAdmin
                ? () => navigate(`/announcements/${post.slug}`)
                : undefined
            }
          >
            <CardBody className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Featured Image */}
                {post.featuredImage && (
                  <div className="md:w-48 md:flex-shrink-0">
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
                          <Chip
                            size="sm"
                            color="warning"
                            variant="flat"
                            startContent={<Icon icon="lucide:pin" />}
                          >
                            Pinned
                          </Chip>
                        )}
                        <Chip size="sm" variant="flat">
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
                            variant="flat"
                          >
                            {post.status}
                          </Chip>
                        )}
                      </div>
                      {isAdmin ? (
                        <Button
                          variant="light"
                          className="h-auto p-0 data-[hover=true]:bg-transparent"
                          onPress={() =>
                            navigate(`/announcements/${post.slug}`)
                          }
                        >
                          <h2 className="text-2xl font-bold mb-2 line-clamp-2 text-left">
                            {post.title}
                          </h2>
                        </Button>
                      ) : (
                        <h2 className="text-2xl font-bold mb-2 line-clamp-2">
                          {post.title}
                        </h2>
                      )}
                      {post.excerpt && (
                        <p className="text-foreground-600 mb-3 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-foreground-500">
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
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="flat"
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
                          variant="flat"
                          color="danger"
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
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => !deleting && setDeleteConfirm(null)}
      >
        <ModalContent>
          <ModalHeader>Delete Blog Post</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete "{deleteConfirm?.title}"? This
              cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => !deleting && setDeleteConfirm(null)}
              isDisabled={deleting}
            >
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
