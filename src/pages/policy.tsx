import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Divider,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Policy, PolicyType, POLICY_LABELS } from "@/types/policy";
import { onPolicy } from "@/api/policy";
import { toDate } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/utils/admin";
import BackButton from "@/components/back-button";
import { addToast } from "@/providers/toast";

export const PolicyPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);

  const [policy, setPolicy] = React.useState<Policy | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Load policy by type
  React.useEffect(() => {
    if (!type) return;

    // Validate policy type
    if (!Object.values(PolicyType).includes(type as PolicyType)) {
      addToast({
        title: "Not found",
        description: "Policy page not found",
        color: "danger",
      });
      navigate("/policies");
      return;
    }

    setLoading(true);
    const unsub = onPolicy(
      type as PolicyType,
      (policyDoc) => {
        setPolicy(policyDoc);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load policy", err);
        addToast({
          title: "Error",
          description: "Failed to load policy",
          color: "danger",
        });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [type, navigate]);

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleEdit = () => {
    navigate(`/admin/policies/${type}/edit`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" label="Loading policy..." />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <BackButton />
        <Card className="mt-4">
          <CardBody className="text-center py-12">
            <Icon
              icon="lucide:file-text"
              className="w-16 h-16 mx-auto mb-4 text-default-300"
            />
            <h2 className="text-xl font-semibold mb-2">Policy Not Found</h2>
            <p className="text-default-500 mb-4">
              This policy document hasn't been created yet.
            </p>
            {isAdmin && (
              <Button color="primary" onPress={handleEdit}>
                <Icon icon="lucide:plus" className="w-4 h-4" />
                Create Policy
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <BackButton />

      <Card className="mt-4">
        <CardHeader className="flex flex-col gap-3 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <Icon
                icon="lucide:file-text"
                className="w-8 h-8 text-primary shrink-0"
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {policy.title || POLICY_LABELS[policy.type]}
              </h1>
            </div>
            {isAdmin && (
              <Button
                color="primary"
                variant="flat"
                size="sm"
                onPress={handleEdit}
                startContent={<Icon icon="lucide:pencil" className="w-4 h-4" />}
              >
                Edit
              </Button>
            )}
          </div>

          {policy.updatedAt && (
            <div className="flex items-center gap-2 text-sm text-default-500 w-full">
              <Icon icon="lucide:calendar" className="w-4 h-4" />
              <span>Last updated: {formatDate(toDate(policy.updatedAt))}</span>
              {policy.lastUpdatedByName && (
                <>
                  <span>•</span>
                  <span>by {policy.lastUpdatedByName}</span>
                </>
              )}
            </div>
          )}
        </CardHeader>

        <Divider />

        <CardBody className="py-6">
          <div className="max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer hover:[&_a]:text-primary-600 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_li]:mb-1 [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {policy.content}
            </ReactMarkdown>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
