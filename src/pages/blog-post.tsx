import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody, Chip, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlogPost } from "@/types/blog";
import { getBlogPostBySlug } from "@/api/blog";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/utils/admin";
import BackButton from "@/components/back-button";
import GroupedWinners from "@/components/grouped-winners";
import { onTournament, mapTournamentDoc } from "@/api/tournaments";
import { Tournament } from "@/types/tournament";
import { addToast } from "@/providers/toast";

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);

  const [post, setPost] = React.useState<BlogPost | null>(null);
  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Load blog post by slug
  React.useEffect(() => {
    if (!slug) return;

    setLoading(true);
    getBlogPostBySlug(slug)
      .then((blogPost) => {
        if (!blogPost) {
          addToast({
            title: "Not found",
            description: "Blog post not found",
            color: "danger",
          });
          navigate("/announcements");
          return;
        }
        setPost(blogPost);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load blog post", err);
        addToast({
          title: "Error",
          description: "Failed to load blog post",
          color: "danger",
        });
        setLoading(false);
      });
  }, [slug, navigate]);

  // Load tournament if referenced
  React.useEffect(() => {
    if (!post?.tournamentId) return;

    const unsub = onTournament(
      post.tournamentId,
      (snap) => {
        if (snap.exists()) {
          setTournament(mapTournamentDoc(snap));
        }
      },
      (err) => console.error("Failed to load tournament", err)
    );
    return () => unsub();
  }, [post?.tournamentId]);

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
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Replace tournament winners placeholder with actual component
  const renderContent = () => {
    if (!post) return null;

    const content = post.content;

    // Check for tournament winners placeholder
    const tournamentWinnersRegex = /\[tournament-winners:([^\]]+)\]/g;
    const parts = content.split(tournamentWinnersRegex);

    if (parts.length === 1) {
      // No placeholders, just render markdown
      return (
        <div className="prose prose-lg max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      );
    }

    // Render with tournament winners sections
    return parts.map((part, index) => {
      // Odd indices are tournament IDs from the regex capture groups
      if (index % 2 === 1 && tournament && tournament.winnerGroups) {
        return (
          <div key={index} className="my-8">
            <GroupedWinners groups={tournament.winnerGroups} />
          </div>
        );
      }

      // Even indices are regular content
      if (part.trim()) {
        return (
          <div key={index} className="prose prose-lg max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
          </div>
        );
      }

      return null;
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto pt-4 pb-10 px-4">
        <div className="flex justify-center items-center py-24">
          <Icon
            icon="lucide:loader"
            className="animate-spin text-4xl text-primary"
          />
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto pt-4 pb-10 px-4">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <BackButton onPress={() => navigate("/announcements")} />
        {isAdmin && (
          <Button
            size="sm"
            variant="flat"
            onPress={() => navigate(`/announcements/edit/${post.id}`)}
            startContent={<Icon icon="lucide:edit" />}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Featured Image */}
      {post.featuredImage && (
        <div className="mb-8 rounded-lg overflow-hidden aspect-video">
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Post Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
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
          {post.tags?.map((tag) => (
            <Chip key={tag} size="sm" variant="dot">
              {tag}
            </Chip>
          ))}
        </div>

        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-foreground-500">
          <div className="flex items-center gap-2">
            {post.authorPhotoURL && (
              <img
                src={post.authorPhotoURL}
                alt={post.authorName}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="flex items-center gap-1">
              <Icon icon="lucide:user" className="w-4 h-4" />
              {post.authorName}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Icon icon="lucide:calendar" className="w-4 h-4" />
            {formatDate(post.publishedAt)}
          </span>
        </div>
      </div>

      {/* Post Content */}
      <Card>
        <CardBody className="p-8">{renderContent()}</CardBody>
      </Card>

      {/* Navigation Footer */}
      <div className="mt-8 flex justify-center">
        <Button
          variant="flat"
          onPress={() => navigate("/announcements")}
          startContent={<Icon icon="lucide:arrow-left" />}
        >
          Back to Announcements
        </Button>
      </div>
    </div>
  );
};
