import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { forwardRef } from "react";

interface DirectoryHeaderProps {
  isAdmin: boolean;
  onAdd: () => void;
  onBulk: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DirectoryHeader = forwardRef<HTMLInputElement, DirectoryHeaderProps>(function DirectoryHeader({ isAdmin, onAdd, onBulk, onFileChange }, ref) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold leading-tight">Membership Directory</h1>
      {isAdmin && (
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          <Button color="primary" startContent={<PlusIcon className="w-4 h-4" />} onPress={onAdd} className="font-medium w-full sm:w-auto">Add Member</Button>
          <Button onPress={onBulk} variant="flat" className="w-full sm:w-auto">Bulk Upload</Button>
        </div>
      )}
    </div>
  );
});
