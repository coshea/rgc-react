import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PolicyType, POLICY_LABELS } from "@/types/policy";
import BackButton from "@/components/back-button";
import { usePageTracking } from "@/hooks/usePageTracking";

export const PoliciesListPage: React.FC = () => {
  const navigate = useNavigate();

  usePageTracking("Policies");

  const policies = [
    {
      type: PolicyType.HandicapPolicy,
      icon: "lucide:calculator",
      description:
        "Club policy on posting scores and maintaining accurate handicaps",
    },
    {
      type: PolicyType.LocalRules,
      icon: "lucide:map-pin",
      description:
        "Local rules and special regulations for Ridgefield Golf Course",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <BackButton />

      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-bold mb-2">Club Policies & Rules</h1>
        <p className="text-default-600">
          Review official club policies and course-specific rules
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {policies.map((policy) => (
          <Card
            key={policy.type}
            isPressable
            onPress={() => navigate(`/policies/${policy.type}`)}
            className="hover:scale-[1.02] transition-transform"
          >
            <CardBody className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon icon={policy.icon} className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {POLICY_LABELS[policy.type]}
                  </h3>
                  <p className="text-sm text-default-600">
                    {policy.description}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                    <span>View policy</span>
                    <Icon icon="lucide:arrow-right" className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
