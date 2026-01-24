import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Policy, PolicyType, POLICY_LABELS } from "@/types/policy";
import { getPolicyByType, updatePolicy } from "@/api/policy";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/utils/admin";
import { addToast } from "@/providers/toast";
import BackButton from "@/components/back-button";
import { MarkdownEditor } from "@/components/markdown-editor";
import RequireAdmin from "@/components/require-admin";
import { usePageTracking } from "@/hooks/usePageTracking";

export const PolicyEditorPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  usePageTracking("Policy Editor", loading);

  // Load existing policy
  useEffect(() => {
    if (!type || !isAdmin) return;

    // Validate policy type
    if (!Object.values(PolicyType).includes(type as PolicyType)) {
      addToast({
        title: "Invalid policy type",
        description: "The specified policy type does not exist",
        color: "danger",
      });
      navigate("/policies");
      return;
    }

    setLoading(true);
    getPolicyByType(type as PolicyType)
      .then((policyDoc) => {
        if (policyDoc) {
          setPolicy(policyDoc);
          setTitle(policyDoc.title || POLICY_LABELS[policyDoc.type]);
          setContent(policyDoc.content || "");
        } else {
          // New policy
          setTitle(POLICY_LABELS[type as PolicyType]);
          setContent("");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load policy", err);
        addToast({
          title: "Error",
          description: "Failed to load policy",
          color: "danger",
        });
        setLoading(false);
      });
  }, [type, isAdmin, navigate]);

  const handleSave = async () => {
    if (!type || !user) return;

    if (!title.trim()) {
      addToast({
        title: "Validation Error",
        description: "Title is required",
        color: "danger",
      });
      return;
    }

    if (!content.trim()) {
      addToast({
        title: "Validation Error",
        description: "Content is required",
        color: "danger",
      });
      return;
    }

    setIsSaving(true);

    try {
      await updatePolicy(type as PolicyType, {
        title: title.trim(),
        content: content.trim(),
        lastUpdatedBy: user.uid,
        lastUpdatedByName: user.displayName || user.email || "Admin",
      });

      addToast({
        title: "Success",
        description: "Policy has been updated",
        color: "success",
      });

      navigate(`/policies/${type}`);
    } catch (error) {
      console.error("Failed to save policy", error);
      addToast({
        title: "Error",
        description: "Failed to save policy. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/policies/${type}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-default-500">Loading policy...</p>
        </div>
      </div>
    );
  }

  return (
    <RequireAdmin>
      <div className="max-w-6xl mx-auto p-6">
        <BackButton />

        <Card className="mt-4">
          <CardHeader className="flex flex-col gap-3 pb-4">
            <div className="flex items-center gap-3 w-full">
              <Icon
                icon="lucide:pencil"
                className="w-8 h-8 text-primary flex-shrink-0"
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {policy ? "Edit Policy" : "Create Policy"}
              </h1>
            </div>
          </CardHeader>

          <CardBody className="space-y-6">
            <Input
              label="Title"
              placeholder="Enter policy title"
              value={title}
              onValueChange={setTitle}
              isRequired
              size="lg"
              classNames={{
                label: "text-sm font-medium",
              }}
            />

            <div>
              <label className="block text-sm font-medium mb-2">
                Content (Markdown)
              </label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder="Enter policy content using Markdown formatting..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="flat"
                onPress={handleCancel}
                isDisabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={isSaving}
                startContent={
                  !isSaving && <Icon icon="lucide:save" className="w-4 h-4" />
                }
              >
                {isSaving ? "Saving..." : "Save Policy"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </RequireAdmin>
  );
};
