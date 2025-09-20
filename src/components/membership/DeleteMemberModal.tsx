import { Button } from "@heroui/react";
import type { User } from "@/api/users";

interface DeleteMemberModalProps {
  user: User | null;
  selfId?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteMemberModal({ user, selfId, onCancel, onConfirm }: DeleteMemberModalProps) {
  if (!user) return null;
  const selfDelete = user.id === selfId;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-sm z-10">
        <h3 className="text-lg font-medium mb-2">Delete Member</h3>
        <p className="text-sm text-default-600 mb-4">
          {selfDelete ? (
            <span>You can't delete your own profile.</span>
          ) : (
            <span>Are you sure you want to permanently delete <span className="font-medium">{user.displayName || user.email || 'this user'}</span>? This action cannot be undone.</span>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="flat" onPress={onCancel}>Cancel</Button>
          {!selfDelete && <Button color="danger" onPress={onConfirm}>Delete</Button>}
        </div>
      </div>
    </div>
  );
}
