import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useAuth } from "@/providers/AuthProvider";
import { addToast } from "@/providers/toast";
import {
  BlogPost,
  BlogPostStatus,
  BlogCategory,
  BlogTemplateType,
} from "@/types/blog";
import {
  createBlogPost,
  updateBlogPost,
  onBlogPost,
  mapBlogPostDoc,
  generateSlug,
  generateExcerpt,
} from "@/api/blog";
import { onAllTournaments, mapTournamentDoc } from "@/api/tournaments";
import { Tournament } from "@/types/tournament";
import BackButton from "@/components/back-button";
import GroupedWinners from "@/components/grouped-winners";

export const BlogEditorPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = React.useState(isEditing);
  const [saving, setSaving] = React.useState(false);
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);

  const [formData, setFormData] = React.useState<Partial<BlogPost>>({
    title: "",
    content: "",
    excerpt: "",
    category: BlogCategory.General,
    status: BlogPostStatus.Draft,
    tags: [],
    isPinned: false,
    templateType: BlogTemplateType.Custom,
  });

  const [selectedTournamentId, setSelectedTournamentId] =
    React.useState<string>("");

  // Load existing post if editing
  React.useEffect(() => {
    if (!id) return;
    const unsub = onBlogPost(
      id,
      (snap) => {
        if (!snap.exists()) {
          addToast({
            title: "Not found",
            description: "Blog post not found",
            color: "danger",
          });
          navigate("/announcements");
          return;
        }
        const post = mapBlogPostDoc(snap);
        setFormData(post);
        if (post.tournamentId) {
          setSelectedTournamentId(post.tournamentId);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        addToast({
          title: "Error",
          description: "Failed to load blog post",
          color: "danger",
        });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id, navigate]);

  // Load tournaments for template selection
  React.useEffect(() => {
    const unsub = onAllTournaments(
      (snap) => {
        const tourneys = snap.docs
          .map(mapTournamentDoc)
          .sort(
            (a: Tournament, b: Tournament) =>
              b.date.getTime() - a.date.getTime()
          );
        setTournaments(tourneys);
      },
      (err) => console.error("Failed to load tournaments", err)
    );
    return () => unsub();
  }, []);

  const handleSave = async (publish = false) => {
    if (!user) {
      addToast({
        title: "Error",
        description: "You must be logged in",
        color: "danger",
      });
      return;
    }

    if (!formData.title?.trim()) {
      addToast({
        title: "Validation error",
        description: "Title is required",
        color: "warning",
      });
      return;
    }

    if (!formData.content?.trim()) {
      addToast({
        title: "Validation error",
        description: "Content is required",
        color: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const slug = formData.slug || generateSlug(formData.title);
      const excerpt = formData.excerpt || generateExcerpt(formData.content);

      const postData: Partial<BlogPost> = {
        ...formData,
        slug,
        excerpt,
        authorId: user.uid,
        authorName: user.displayName || user.email || "Anonymous",
        authorPhotoURL: user.photoURL || undefined,
        status: publish ? BlogPostStatus.Published : formData.status,
        publishedAt: publish ? new Date() : formData.publishedAt,
        tournamentId: selectedTournamentId || undefined,
      };

      if (isEditing && id) {
        await updateBlogPost(id, postData);
        addToast({
          title: "Success",
          description: publish ? "Post published!" : "Post updated",
          color: "success",
        });
        if (publish) {
          navigate("/announcements");
        }
      } else {
        const newId = await createBlogPost(
          postData as Omit<BlogPost, "id" | "createdAt" | "updatedAt">
        );
        addToast({
          title: "Success",
          description: publish ? "Post published!" : "Draft saved",
          color: "success",
        });
        if (publish) {
          navigate("/announcements");
        } else {
          navigate(`/announcements/edit/${newId}`);
        }
      }
    } catch (error) {
      console.error("Save failed", error);
      addToast({
        title: "Error",
        description: "Failed to save blog post",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = () => {
    if (!formData.templateType) return;

    switch (formData.templateType) {
      case BlogTemplateType.TournamentResults:
        if (selectedTournamentId) {
          const tournament = tournaments.find(
            (t) => t.firestoreId === selectedTournamentId
          );
          if (tournament) {
            setFormData({
              ...formData,
              title: `${tournament.date.getFullYear()} ${tournament.title} - Results`,
              category: BlogCategory.TournamentResults,
              excerpt: `Check out the winners from this year's ${tournament.title}!`,
              content: `The results for **${tournament.title}** are now available!\n\n[tournament-winners:${selectedTournamentId}]`,
            });
          }
        }
        break;

      case BlogTemplateType.TeeTimes:
        if (selectedTournamentId) {
          const tournament = tournaments.find(
            (t) => t.firestoreId === selectedTournamentId
          );
          if (tournament) {
            setFormData({
              ...formData,
              title: `${tournament.title} - Tee Times Posted`,
              category: BlogCategory.TeeTimes,
              excerpt: `Tee times are now available for the upcoming ${tournament.title}.`,
              content: `Tee times for **${tournament.title}** are now available.\n\n## Tournament Details\n- **Date:** ${tournament.date instanceof Date ? tournament.date.toLocaleDateString() : "TBD"}\n- **Prize Pool:** $${tournament.prizePool.toLocaleString()}\n\nGood luck to all participants!`,
            });
          }
        }
        break;

      case BlogTemplateType.GeneralAnnouncement:
        setFormData({
          ...formData,
          category: BlogCategory.Announcement,
          excerpt: "Important update for all club members.",
          content:
            "## Important Announcement\n\nYour announcement content here...",
        });
        break;
    }
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

  return (
    <div className="max-w-4xl mx-auto pt-4 pb-10 px-4">
      <div className="mb-4 flex items-center justify-between">
        <BackButton onPress={() => navigate("/announcements")} />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            onPress={() => handleSave(false)}
            isLoading={saving}
            startContent={!saving && <Icon icon="lucide:save" />}
          >
            Save Draft
          </Button>
          <Button
            size="sm"
            color="primary"
            onPress={() => handleSave(true)}
            isLoading={saving}
            startContent={!saving && <Icon icon="lucide:send" />}
          >
            Publish
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">
            {isEditing ? "Edit Blog Post" : "Create New Blog Post"}
          </h1>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Template Selection */}
          {!isEditing && (
            <div className="space-y-3">
              <Select
                label="Template Type"
                selectedKeys={
                  formData.templateType ? [formData.templateType] : []
                }
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as BlogTemplateType;
                  setFormData({ ...formData, templateType: value });
                }}
              >
                <SelectItem key={BlogTemplateType.Custom}>
                  Custom Post
                </SelectItem>
                <SelectItem key={BlogTemplateType.TournamentResults}>
                  Tournament Results
                </SelectItem>
                <SelectItem key={BlogTemplateType.TeeTimes}>
                  Tee Times Announcement
                </SelectItem>
                <SelectItem key={BlogTemplateType.GeneralAnnouncement}>
                  General Announcement
                </SelectItem>
              </Select>

              {(formData.templateType === BlogTemplateType.TournamentResults ||
                formData.templateType === BlogTemplateType.TeeTimes) && (
                <>
                  <Select
                    label="Select Tournament"
                    selectedKeys={
                      selectedTournamentId ? [selectedTournamentId] : []
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;
                      setSelectedTournamentId(value);
                    }}
                  >
                    {tournaments.map((t) => (
                      <SelectItem key={t.firestoreId!}>{t.title}</SelectItem>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={applyTemplate}
                    isDisabled={!selectedTournamentId}
                    startContent={<Icon icon="lucide:wand-2" />}
                  >
                    Apply Template
                  </Button>
                </>
              )}

              {formData.templateType ===
                BlogTemplateType.GeneralAnnouncement && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={applyTemplate}
                  startContent={<Icon icon="lucide:wand-2" />}
                >
                  Apply Template
                </Button>
              )}
            </div>
          )}

          {/* Title */}
          <Input
            label="Title"
            placeholder="Enter post title"
            value={formData.title || ""}
            onValueChange={(value) =>
              setFormData({ ...formData, title: value })
            }
            isRequired
          />

          {/* Slug */}
          <Input
            label="URL Slug"
            placeholder="auto-generated-from-title"
            value={formData.slug || ""}
            onValueChange={(value) => setFormData({ ...formData, slug: value })}
            description="Leave empty to auto-generate from title"
          />

          {/* Category */}
          <Select
            label="Category"
            selectedKeys={formData.category ? [formData.category] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as BlogCategory;
              setFormData({ ...formData, category: value });
            }}
            isRequired
          >
            {Object.values(BlogCategory).map((cat) => (
              <SelectItem key={cat}>{cat}</SelectItem>
            ))}
          </Select>

          {/* Content */}
          <RichTextEditor
            value={formData.content || ""}
            onChange={(value) => setFormData({ ...formData, content: value })}
          />

          {/* Excerpt */}
          <Input
            label="Excerpt (Optional)"
            placeholder="Short summary (auto-generated if empty)"
            value={formData.excerpt || ""}
            onValueChange={(value) =>
              setFormData({ ...formData, excerpt: value })
            }
            description="Short summary shown in lists and previews"
          />

          {/* Featured Image URL */}
          <Input
            label="Featured Image URL (Optional)"
            placeholder="https://example.com/image.jpg"
            value={formData.featuredImage || ""}
            onValueChange={(value) =>
              setFormData({ ...formData, featuredImage: value })
            }
          />

          {/* Pin Post */}
          <Switch
            isSelected={formData.isPinned || false}
            onValueChange={(value) =>
              setFormData({ ...formData, isPinned: value })
            }
          >
            Pin to top of blog list
          </Switch>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-500">Status:</span>
            <Chip
              color={
                formData.status === BlogPostStatus.Published
                  ? "success"
                  : "warning"
              }
              size="sm"
            >
              {formData.status}
            </Chip>
          </div>
        </CardBody>
      </Card>

      {/* Preview tournament winners if template */}
      {selectedTournamentId &&
        formData.templateType === BlogTemplateType.TournamentResults && (
          <Card className="mt-6">
            <CardHeader>
              <h2 className="text-xl font-semibold">
                Tournament Winners Preview
              </h2>
            </CardHeader>
            <CardBody>
              {tournaments.find((t) => t.firestoreId === selectedTournamentId)
                ?.winnerGroups ? (
                <GroupedWinners
                  groups={
                    tournaments.find(
                      (t) => t.firestoreId === selectedTournamentId
                    )!.winnerGroups!
                  }
                />
              ) : (
                <p className="text-foreground-500">
                  No winners data available for this tournament.
                </p>
              )}
            </CardBody>
          </Card>
        )}
    </div>
  );
};
