import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Input,
  Label,
  TextField,
  ListBox,
  Select,
  Card,
  Chip,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BlogImagePicker } from "@/components/blog-image-picker";
import { useAuth } from "@/providers/AuthProvider";
import { addToast } from "@/providers/toast";
import { useUserProfile } from "@/hooks/useUserProfile";
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
import {
  onAllTournaments,
  mapTournamentDoc,
  fetchRegistrationCount,
} from "@/api/tournaments";
import { Tournament } from "@/types/tournament";
import BackButton from "@/components/back-button";
import GroupedWinners from "@/components/grouped-winners";
import { usePageTracking } from "@/hooks/usePageTracking";

export const BlogEditorPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userProfile } = useUserProfile();
  const isEditing = !!id;

  const [loading, setLoading] = React.useState(isEditing);
  const [saving, setSaving] = React.useState(false);
  const [generatingAi, setGeneratingAi] = React.useState(false);
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

  usePageTracking(
    isEditing ? "Edit Announcement" : "New Announcement",
    loading,
  );

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
      },
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
              b.date.getTime() - a.date.getTime(),
          );
        setTournaments(tourneys);
      },
      (err) => console.error("Failed to load tournaments", err),
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
        authorName:
          userProfile?.displayName ||
          user.displayName ||
          user.email ||
          "Anonymous",
        authorPhotoURL: userProfile?.photoURL ?? user.photoURL ?? undefined,
        status: publish ? BlogPostStatus.Published : formData.status,
        publishedAt: publish ? new Date() : formData.publishedAt,
        ...(selectedTournamentId && { tournamentId: selectedTournamentId }),
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
          postData as Omit<BlogPost, "id" | "createdAt" | "updatedAt">,
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

  const handleAiWriteup = async () => {
    const tournament = tournaments.find(
      (t) => t.firestoreId === selectedTournamentId,
    );
    if (!tournament) return;

    setGeneratingAi(true);
    try {
      const { functions } = await import("@/config/firebase");
      const { httpsCallable } = await import("firebase/functions");
      const fn = httpsCallable<unknown, { content: string }>(
        functions,
        "generate_blog_writeup",
      );
      const result = await fn({
        tournamentTitle: tournament.title,
        date:
          tournament.date instanceof Date
            ? tournament.date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })
            : String(tournament.date),
        tee: tournament.tee ?? "Mixed",
        prizePool: tournament.prizePool,
        totalTeams: tournament.firestoreId
          ? await fetchRegistrationCount(tournament.firestoreId)
          : tournament.players,
        description: tournament.description ?? "",
        winnerGroups: tournament.winnerGroups ?? [],
        weather: tournament.weather,
      });
      setFormData((prev) => ({ ...prev, content: result.data.content }));
      addToast({
        title: "AI write-up generated",
        description: "Review and edit the content below before publishing.",
        color: "success",
      });
    } catch (error) {
      console.error("AI write-up failed", error);
      addToast({
        title: "Generation failed",
        description:
          "Could not generate write-up. Check the console for details.",
        color: "danger",
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const applyTemplate = () => {
    if (!formData.templateType) return;

    switch (formData.templateType) {
      case BlogTemplateType.TournamentResults:
        if (selectedTournamentId) {
          const tournament = tournaments.find(
            (t) => t.firestoreId === selectedTournamentId,
          );
          if (tournament) {
            setFormData({
              ...formData,
              // Only set title if not already filled
              title: formData.title?.trim()
                ? formData.title
                : `${tournament.date.getFullYear()} ${tournament.title} - Results`,
              category: BlogCategory.TournamentResults,
              // Only set excerpt if not already filled
              excerpt: formData.excerpt?.trim()
                ? formData.excerpt
                : `Check out the winners from this year's ${tournament.title}!`,
              // Only set content if empty — winners are shown as a separate section
              content: formData.content?.trim()
                ? formData.content
                : `The results for **${tournament.title}** are now available!`,
            });
          }
        }
        break;

      case BlogTemplateType.TeeTimes:
        if (selectedTournamentId) {
          const tournament = tournaments.find(
            (t) => t.firestoreId === selectedTournamentId,
          );
          if (tournament) {
            setFormData({
              ...formData,
              title: formData.title?.trim()
                ? formData.title
                : `${tournament.title} - Tee Times Posted`,
              category: BlogCategory.TeeTimes,
              excerpt: formData.excerpt?.trim()
                ? formData.excerpt
                : `Tee times are now available for the upcoming ${tournament.title}.`,
              content: formData.content?.trim()
                ? formData.content
                : [
                    `Tee times for **${tournament.title}** are now available.`,
                    "",
                    "## Tournament Details",
                    `- **Date:** ${tournament.date instanceof Date ? tournament.date.toLocaleDateString() : "TBD"}`,
                    `- **Prize Pool:** $${tournament.prizePool.toLocaleString()}`,
                    "",
                    "Good luck to all participants!",
                  ].join("\n"),
            });
          }
        }
        break;

      case BlogTemplateType.GeneralAnnouncement:
        setFormData({
          ...formData,
          category: BlogCategory.Announcement,
          excerpt: formData.excerpt?.trim()
            ? formData.excerpt
            : "Important update for all club members.",
          content: formData.content?.trim()
            ? formData.content
            : "## Important Announcement\n\nYour announcement content here...",
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
            className="animate-spin text-4xl text-accent"
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
            variant="tertiary"
            onPress={() => handleSave(false)}
          >
            {!saving && <Icon icon="lucide:save" />}
            Save Draft
          </Button>
          <Button size="sm" onPress={() => handleSave(true)}>
            {!saving && <Icon icon="lucide:send" />}
            Publish
          </Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <h1 className="text-2xl font-bold">
            {isEditing ? "Edit Blog Post" : "Create New Blog Post"}
          </h1>
        </Card.Header>
        <Card.Content className="space-y-6">
          {/* Template Selection */}
          {!isEditing && (
            <div className="space-y-3">
              <Select
                value={formData.templateType}
                onChange={(key) => {
                  if (key)
                    setFormData({
                      ...formData,
                      templateType: key as BlogTemplateType,
                    });
                }}
              >
                <Label>Template Type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item
                      id={BlogTemplateType.Custom}
                      textValue="Custom Post"
                    >
                      Custom Post
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item
                      id={BlogTemplateType.TournamentResults}
                      textValue="Tournament Results"
                    >
                      Tournament Results
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item
                      id={BlogTemplateType.TeeTimes}
                      textValue="Tee Times Announcement"
                    >
                      Tee Times Announcement
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item
                      id={BlogTemplateType.GeneralAnnouncement}
                      textValue="General Announcement"
                    >
                      General Announcement
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>

              {(formData.templateType === BlogTemplateType.TournamentResults ||
                formData.templateType === BlogTemplateType.TeeTimes) && (
                <>
                  <Select
                    value={selectedTournamentId || undefined}
                    onChange={(key) => {
                      if (key) setSelectedTournamentId(String(key));
                    }}
                  >
                    <Label>Select Tournament</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {tournaments.map((t) => (
                          <ListBox.Item
                            key={t.firestoreId!}
                            id={t.firestoreId!}
                            textValue={
                              t.date instanceof Date
                                ? `${t.date.getFullYear()} – ${t.title}`
                                : t.title
                            }
                          >
                            {t.date instanceof Date
                              ? `${t.date.getFullYear()} – ${t.title}`
                              : t.title}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={applyTemplate}
                      isDisabled={!selectedTournamentId}
                    >
                      <Icon icon="lucide:wand-2" />
                      Apply Template
                    </Button>
                    {formData.templateType ===
                      BlogTemplateType.TournamentResults && (
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={handleAiWriteup}
                        isDisabled={
                          !selectedTournamentId ||
                          !tournaments.find(
                            (t) => t.firestoreId === selectedTournamentId,
                          )?.winnerGroups?.length
                        }
                      >
                        {!generatingAi && (
                          <Icon icon="lucide:sparkles" className="w-4 h-4" />
                        )}
                        AI Write-Up
                      </Button>
                    )}
                  </div>
                </>
              )}

              {formData.templateType ===
                BlogTemplateType.GeneralAnnouncement && (
                <Button size="sm" variant="tertiary" onPress={applyTemplate}>
                  <Icon icon="lucide:wand-2" />
                  Apply Template
                </Button>
              )}
            </div>
          )}

          {/* AI Write-Up for editing tournament results posts */}
          {isEditing &&
            formData.templateType === BlogTemplateType.TournamentResults && (
              <div className="space-y-3">
                <Select
                  value={selectedTournamentId || undefined}
                  onChange={(key) => {
                    if (key) setSelectedTournamentId(String(key));
                  }}
                >
                  <Label>Tournament</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {tournaments.map((t) => (
                        <ListBox.Item
                          key={t.firestoreId!}
                          id={t.firestoreId!}
                          textValue={
                            t.date instanceof Date
                              ? `${t.date.getFullYear()} – ${t.title}`
                              : t.title
                          }
                        >
                          {t.date instanceof Date
                            ? `${t.date.getFullYear()} – ${t.title}`
                            : t.title}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={handleAiWriteup}
                  isDisabled={
                    !selectedTournamentId ||
                    !tournaments.find(
                      (t) => t.firestoreId === selectedTournamentId,
                    )?.winnerGroups?.length
                  }
                >
                  {!generatingAi && (
                    <Icon icon="lucide:sparkles" className="w-4 h-4" />
                  )}
                  AI Write-Up
                </Button>
              </div>
            )}

          {/* Title */}
          <TextField
            isRequired
            value={formData.title || ""}
            onChange={(v) => setFormData({ ...formData, title: v })}
          >
            <Label>Title</Label>
            <Input placeholder="Enter post title" />
          </TextField>

          {/* Slug */}
          <TextField
            value={formData.slug || ""}
            onChange={(v) => setFormData({ ...formData, slug: v })}
          >
            <Label>URL Slug</Label>
            <Input placeholder="auto-generated-from-title" />
            <p className="text-xs text-muted mt-1">
              Leave empty to auto-generate from title
            </p>
          </TextField>

          {/* Category */}
          <Select
            selectedKey={formData.category}
            onSelectionChange={(key) => {
              if (key)
                setFormData({ ...formData, category: key as BlogCategory });
            }}
            isRequired
          >
            <Label>Category</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {Object.values(BlogCategory).map((cat) => (
                  <ListBox.Item key={cat} id={cat} textValue={cat}>
                    {cat}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {/* Content */}
          <RichTextEditor
            value={formData.content || ""}
            onChange={(value) => setFormData({ ...formData, content: value })}
          />

          {/* Excerpt */}
          <TextField
            value={formData.excerpt || ""}
            onChange={(v) => setFormData({ ...formData, excerpt: v })}
          >
            <Label>Excerpt (Optional)</Label>
            <Input placeholder="Short summary (auto-generated if empty)" />
            <p className="text-xs text-muted mt-1">
              Short summary shown in lists and previews
            </p>
          </TextField>

          {/* Featured Image */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Featured Image (Optional)
            </label>
            <BlogImagePicker
              value={formData.featuredImage}
              onChange={(url) =>
                setFormData({ ...formData, featuredImage: url })
              }
            />
          </div>

          {/* Pin Post */}
          <Switch
            isSelected={formData.isPinned || false}
            onChange={(value) => setFormData({ ...formData, isPinned: value })}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>Pin to top of blog list</Label>
            </Switch.Content>
          </Switch>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Status:</span>
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
        </Card.Content>
      </Card>

      {/* Tournament winners — separate section shown below content in the published post */}
      {selectedTournamentId &&
        formData.templateType === BlogTemplateType.TournamentResults && (
          <Card className="mt-6">
            <Card.Header>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-semibold">Tournament Results</h2>
                <p className="text-sm text-muted">
                  This section is automatically displayed below the post
                  content. It does not need to be added to the text above.
                </p>
              </div>
            </Card.Header>
            <Card.Content>
              {(() => {
                const selectedTournament = tournaments.find(
                  (t) => t.firestoreId === selectedTournamentId,
                );
                if (selectedTournament?.winnerGroups?.length) {
                  return (
                    <GroupedWinners groups={selectedTournament.winnerGroups} />
                  );
                }
                return (
                  <p className="text-muted">
                    No winners data available for this tournament.
                  </p>
                );
              })()}
            </Card.Content>
          </Card>
        )}
    </div>
  );
};
