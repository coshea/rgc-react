import React, { useState, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Chip,
  RadioGroup,
  Radio,
  Divider,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { User } from "@/api/users";
import {
  findDuplicates,
  suggestPrimaryUser,
  type DuplicateGroup,
} from "@/utils/duplicateDetection";
import { mergeUserIds } from "@/api/mergeUsers";
import { addToast } from "@/providers/toast";
import { auth, db } from "@/config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { UserAvatar } from "@/components/avatar";
import { UserSelect } from "@/components/UserSelect";

interface MergeDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onMergeComplete: () => void;
}

export const MergeDuplicatesModal: React.FC<MergeDuplicatesModalProps> = ({
  isOpen,
  onClose,
  users,
  onMergeComplete,
}) => {
  const [step, setStep] = useState<"scan" | "review" | "confirm" | "merging">(
    "scan"
  );
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(
    null
  );
  const [primaryUserId, setPrimaryUserId] = useState<string>("");
  const [merging, setMerging] = useState(false);
  const [manualUserA, setManualUserA] = useState<string>("");
  const [manualUserB, setManualUserB] = useState<string>("");

  const normalizeToSingleValue = (value: string | string[]): string =>
    Array.isArray(value) ? (value[0] ?? "") : value;

  const manualSelectionReady =
    Boolean(manualUserA) && Boolean(manualUserB) && manualUserA !== manualUserB;

  // Find all duplicate groups
  const duplicateGroups = useMemo(() => findDuplicates(users), [users]);
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const labelA = (a.displayName || a.email || "").toLowerCase();
      const labelB = (b.displayName || b.email || "").toLowerCase();
      return labelA.localeCompare(labelB);
    });
  }, [users]);
  const usersForManualA = useMemo(() => {
    if (!manualUserB) return sortedUsers;
    return sortedUsers.filter((user) => user.id !== manualUserB);
  }, [sortedUsers, manualUserB]);
  const usersForManualB = useMemo(() => {
    if (!manualUserA) return sortedUsers;
    return sortedUsers.filter((user) => user.id !== manualUserA);
  }, [sortedUsers, manualUserA]);

  const handleClose = () => {
    setStep("scan");
    setSelectedGroup(null);
    setPrimaryUserId("");
    setManualUserA("");
    setManualUserB("");
    setMerging(false);
    onClose();
  };

  // Start reviewing a specific duplicate group
  const handleReviewGroup = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    // Auto-suggest the primary user
    const suggested = suggestPrimaryUser(group.users);
    setPrimaryUserId(suggested.id);
    setStep("review");
  };

  const handleManualReview = () => {
    if (!manualSelectionReady) {
      addToast({
        title: "Selection Required",
        description: "Pick two different users to merge",
        color: "warning",
      });
      return;
    }

    const userA = users.find((user) => user.id === manualUserA);
    const userB = users.find((user) => user.id === manualUserB);

    if (!userA || !userB) {
      addToast({
        title: "Users Not Found",
        description:
          "One or both selected users are unavailable. Refresh the list and try again.",
        color: "danger",
      });
      return;
    }

    const describeUser = (user: User) =>
      user.displayName || user.email || user.id;

    const manualGroup: DuplicateGroup = {
      reason: "manual",
      users: [userA, userB],
      matchValue: `${describeUser(userA)} ↔ ${describeUser(userB)}`,
    };

    setSelectedGroup(manualGroup);
    const suggested = suggestPrimaryUser(manualGroup.users);
    setPrimaryUserId(suggested?.id ?? manualGroup.users[0]?.id ?? "");
    setStep("review");
  };

  // Proceed to confirmation step
  const handleProceedToConfirm = () => {
    if (!primaryUserId) {
      addToast({
        title: "Selection Required",
        description: "Please select which user to keep as primary",
        color: "warning",
      });
      return;
    }
    setStep("confirm");
  };

  // Execute the merge
  const handleConfirmMerge = async () => {
    if (!selectedGroup || !primaryUserId) return;

    const usersToMerge = selectedGroup.users.filter(
      (u) => u.id !== primaryUserId
    );

    setStep("merging");
    setMerging(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Not authenticated");
      }

      let totalChampionships = 0;
      let totalTournaments = 0;

      // Merge each duplicate user into the primary user
      for (const userToMerge of usersToMerge) {
        // Call the merge Cloud Function
        const result = await mergeUserIds(
          primaryUserId,
          userToMerge.id,
          idToken
        );
        totalChampionships += result.championshipsUpdated;
        totalTournaments += result.tournamentsUpdated;

        // Mark the merged user as migrated (soft delete)
        await updateDoc(doc(db, "users", userToMerge.id), {
          isMigrated: true,
        });
      }

      addToast({
        title: "Merge Complete",
        description: `Successfully merged ${usersToMerge.length} duplicate user${usersToMerge.length !== 1 ? "s" : ""}. Updated ${totalChampionships} championship${totalChampionships !== 1 ? "s" : ""} and ${totalTournaments} tournament${totalTournaments !== 1 ? "s" : ""}.`,
        color: "success",
      });

      onMergeComplete();
      handleClose();
    } catch (error) {
      console.error("Merge failed:", error);
      addToast({
        title: "Merge Failed",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during merge",
        color: "danger",
      });
      setStep("confirm");
      setMerging(false);
    }
  };

  // Go back to scan view
  const handleBackToScan = () => {
    setSelectedGroup(null);
    setPrimaryUserId("");
    setStep("scan");
  };

  // Render user card for selection
  const renderUserCard = (user: User, isPrimary: boolean) => {
    const primary = isPrimary && primaryUserId === user.id;

    return (
      <Card
        className={`${primary ? "border-2 border-primary" : "border border-default-200"}`}
      >
        <CardBody className="p-4">
          <div className="flex items-start gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-base truncate">
                  {user.displayName || "No Name"}
                </h4>
                {user.boardMember && (
                  <Chip size="sm" color="secondary" variant="flat">
                    Board
                  </Chip>
                )}
              </div>
              <div className="space-y-1 text-sm text-default-600">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:mail" className="w-4 h-4 shrink-0" />
                  <span className="truncate">{user.email || "No email"}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:phone" className="w-4 h-4 shrink-0" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.ghinNumber && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:hash" className="w-4 h-4 shrink-0" />
                    <span>GHIN: {user.ghinNumber}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:calendar" className="w-4 h-4 shrink-0" />
                  <span>
                    Last Paid: {user.lastPaidYear ? user.lastPaidYear : "Never"}
                  </span>
                </div>
                {user.createdAt && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:clock" className="w-4 h-4 shrink-0" />
                    <span>
                      Created:{" "}
toDate(user.createdAt)?.toLocaleDateString() ?? "Unknown"
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-default-400 break-all">
                ID: {user.id}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  const renderReasonChip = (reason: DuplicateGroup["reason"]) => {
    const color =
      reason === "email"
        ? "danger"
        : reason === "name"
          ? "warning"
          : "secondary";
    const label =
      reason === "email"
        ? "Same Email"
        : reason === "name"
          ? "Same Name"
          : "Manual Selection";

    return (
      <Chip size="sm" color={color} variant="flat">
        {label}
      </Chip>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      scrollBehavior="inside"
      isDismissable={!merging}
      hideCloseButton={merging}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:users" className="w-5 h-5 text-warning" />
                <span>Merge Duplicate Users</span>
              </div>
            </ModalHeader>

            <ModalBody>
              {/* Scan Step: Show duplicate groups and manual form */}
              {step === "scan" && (
                <div className="space-y-4">
                  {duplicateGroups.length === 0 ? (
                    <div className="text-center py-8">
                      <Icon
                        icon="lucide:check-circle"
                        className="w-12 h-12 mx-auto mb-3 text-success"
                      />
                      <h3 className="text-lg font-semibold mb-2">
                        No Duplicates Found
                      </h3>
                      <p className="text-default-600">
                        All users have unique emails and names.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-warning-50 dark:bg-warning-100/10 border border-warning-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Icon
                          icon="lucide:alert-triangle"
                          className="w-5 h-5 text-warning shrink-0 mt-0.5"
                        />
                        <div className="text-sm">
                          <p className="font-semibold text-warning-800 dark:text-warning-200 mb-1">
                            {duplicateGroups.length} Duplicate Group
                            {duplicateGroups.length !== 1 ? "s" : ""} Found
                          </p>
                          <p className="text-warning-700 dark:text-warning-300">
                            Users with matching emails or identical first and
                            last names may be duplicates.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Card className="border border-default-200">
                    <CardBody className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Icon
                          icon="lucide:sparkles"
                          className="w-5 h-5 text-primary shrink-0"
                        />
                        <div>
                          <h3 className="font-semibold">Manual Merge</h3>
                          <p className="text-sm text-default-600">
                            Pick any two users to merge, even if they were not
                            detected automatically.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <UserSelect
                          label="User A"
                          placeholder="Type to search members"
                          users={usersForManualA}
                          value={manualUserA}
                          onChange={(val) =>
                            setManualUserA(normalizeToSingleValue(val))
                          }
                        />

                        <UserSelect
                          label="User B"
                          placeholder="Type to search members"
                          users={usersForManualB}
                          value={manualUserB}
                          onChange={(val) =>
                            setManualUserB(normalizeToSingleValue(val))
                          }
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          color="primary"
                          variant="solid"
                          isDisabled={!manualSelectionReady}
                          onPress={handleManualReview}
                        >
                          Review Manual Selection
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {duplicateGroups.length > 0 && (
                    <div className="space-y-3">
                      {duplicateGroups.map((group, idx) => (
                        <Card key={idx} className="border border-default-200">
                          <CardBody className="p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {renderReasonChip(group.reason)}
                                  <span className="text-sm text-default-600">
                                    {group.users.length} users
                                  </span>
                                </div>
                                <p className="text-sm font-mono text-default-700">
                                  {group.matchValue}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                onPress={() => handleReviewGroup(group)}
                                endContent={
                                  <Icon
                                    icon="lucide:arrow-right"
                                    className="w-4 h-4"
                                  />
                                }
                              >
                                Review
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {group.users.map((user) => (
                                <div
                                  key={user.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <UserAvatar user={user} size="sm" />
                                  <span className="truncate">
                                    {user.displayName ||
                                      user.email ||
                                      "No name"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Review Step: Select primary user */}
              {step === "review" && selectedGroup && (
                <div className="space-y-4">
                  <div className="bg-primary-50 dark:bg-primary-100/10 border border-primary-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        icon="lucide:info"
                        className="w-5 h-5 text-primary shrink-0 mt-0.5"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-primary-800 dark:text-primary-200 mb-1">
                          Select Primary User
                        </p>
                        <p className="text-primary-700 dark:text-primary-300">
                          Choose which user record to keep. All tournament and
                          championship data from the other user(s) will be
                          merged into the primary user.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {renderReasonChip(selectedGroup.reason)}
                      <span className="text-sm text-default-600">
                        {selectedGroup.matchValue}
                      </span>
                    </div>
                  </div>

                  <RadioGroup
                    value={primaryUserId}
                    onValueChange={setPrimaryUserId}
                    classNames={{
                      wrapper: "gap-3",
                    }}
                  >
                    {selectedGroup.users.map((user) => (
                      <Radio
                        key={user.id}
                        value={user.id}
                        className="max-w-full"
                      >
                        {renderUserCard(user, true)}
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Confirm Step: Final confirmation before merge */}
              {step === "confirm" && selectedGroup && (
                <div className="space-y-4">
                  <div className="bg-danger-50 dark:bg-danger-100/10 border border-danger-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        icon="lucide:alert-triangle"
                        className="w-5 h-5 text-danger shrink-0 mt-0.5"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-danger-800 dark:text-danger-200 mb-1">
                          Confirm Merge Operation
                        </p>
                        <p className="text-danger-700 dark:text-danger-300">
                          This action cannot be undone. The duplicate user
                          record(s) will remain but will be marked as merged.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-success-600">
                      ✓ Primary User (Keep This One)
                    </h4>
                    {renderUserCard(
                      selectedGroup.users.find((u) => u.id === primaryUserId)!,
                      false
                    )}
                  </div>

                  <Divider />

                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-danger-600">
                      ✗ Duplicate User(s) (Merge Data From)
                    </h4>
                    <div className="space-y-2">
                      {selectedGroup.users
                        .filter((u) => u.id !== primaryUserId)
                        .map((user) => renderUserCard(user, false))}
                    </div>
                  </div>
                </div>
              )}

              {/* Merging Step: Show progress */}
              {step === "merging" && (
                <div className="text-center py-8">
                  <Spinner size="lg" className="mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Merging Users...
                  </h3>
                  <p className="text-default-600">
                    Updating championships and tournament records. Please wait.
                  </p>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              {step === "scan" && (
                <Button color="default" variant="flat" onPress={handleClose}>
                  Close
                </Button>
              )}

              {step === "review" && (
                <>
                  <Button
                    color="default"
                    variant="flat"
                    onPress={handleBackToScan}
                  >
                    Back
                  </Button>
                  <Button
                    color="primary"
                    onPress={handleProceedToConfirm}
                    isDisabled={!primaryUserId}
                  >
                    Continue
                  </Button>
                </>
              )}

              {step === "confirm" && (
                <>
                  <Button
                    color="default"
                    variant="flat"
                    onPress={() => setStep("review")}
                  >
                    Back
                  </Button>
                  <Button
                    color="danger"
                    onPress={handleConfirmMerge}
                    startContent={
                      <Icon icon="lucide:git-merge" className="w-4 h-4" />
                    }
                  >
                    Confirm Merge
                  </Button>
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
