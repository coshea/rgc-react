import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { Icon } from "@iconify/react";

interface DirectoryHeaderProps {
  isAdmin: boolean;
  onAdd: () => void;
  onFindDuplicates?: () => void;
}

export function DirectoryHeader({
  isAdmin,
  onAdd,
  onFindDuplicates,
}: DirectoryHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold leading-tight">
        Membership Directory
      </h1>
      {isAdmin && (
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          {onFindDuplicates && (
            <Button
              color="warning"
              variant="flat"
              startContent={<Icon icon="lucide:users" className="w-4 h-4" />}
              onPress={onFindDuplicates}
              className="font-medium w-full sm:w-auto"
            >
              Find Duplicates
            </Button>
          )}
          <Button
            color="primary"
            startContent={<PlusIcon className="w-4 h-4" />}
            onPress={onAdd}
            className="font-medium w-full sm:w-auto"
          >
            Add Member
          </Button>
        </div>
      )}
    </div>
  );
}
