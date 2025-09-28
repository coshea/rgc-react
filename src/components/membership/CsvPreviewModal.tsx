import { Button } from "@heroui/react";
import type { UserProfilePayload } from "@/api/users";

interface CsvPreviewModalProps {
  open: boolean;
  rows: UserProfilePayload[];
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
  progress?: { processed: number; total: number };
}

export function CsvPreviewModal({
  open,
  rows,
  onClose,
  onUpload,
  uploading,
  progress,
}: CsvPreviewModalProps) {
  if (!open) return null;
  const pct =
    uploading && progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-2xl z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">CSV Upload Preview</h3>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Close"
            onPress={onClose}
            className="text-default-500"
          >
            ×
          </Button>
        </div>
        <p className="text-xs text-default-500 mb-2">
          Preview uses structured First/Last columns. If a legacy full name was
          provided, it is split automatically. Rows lacking both first and last
          will fall back to the legacy value in the Full column only.
        </p>
        <div className="max-h-96 overflow-auto border rounded mb-4">
          <table className="w-full text-sm">
            <thead className="bg-default-50">
              <tr>
                <th className="p-2 text-left">First Name</th>
                <th className="p-2 text-left">Last Name</th>
                <th className="p-2 text-left">Full (Derived)</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Phone</th>
                <th className="p-2 text-left">GHIN</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const legacy = (r as any).displayName || "";
                const first = (r as any).firstName || "";
                const last = (r as any).lastName || "";
                let full = [first, last].filter(Boolean).join(" ");
                if (!full && legacy) full = legacy; // legacy fallback
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2 truncate max-w-[8rem]">{first}</td>
                    <td className="p-2 truncate max-w-[8rem]">{last}</td>
                    <td className="p-2 truncate max-w-[10rem]">{full}</td>
                    <td className="p-2 truncate max-w-[14rem]">
                      {r.email || ""}
                    </td>
                    <td className="p-2 truncate max-w-[10rem]">
                      {r.phone || ""}
                    </td>
                    <td className="p-2 truncate max-w-[6rem]">
                      {r.ghinNumber || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {uploading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1 text-default-500">
              <span>Uploading...</span>
              {progress?.total ? (
                <span>
                  {progress.processed}/{progress.total} ({pct}%)
                </span>
              ) : null}
            </div>
            <div className="h-2 w-full rounded bg-default-100 overflow-hidden">
              <div
                className="h-full bg-secondary transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="flat" onPress={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onPress={onUpload} color="secondary" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}
