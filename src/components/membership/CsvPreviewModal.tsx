import { Button } from "@heroui/react";
import type { UserProfilePayload } from "@/api/users";

interface CsvPreviewModalProps {
  open: boolean;
  rows: UserProfilePayload[];
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
}

export function CsvPreviewModal({
  open,
  rows,
  onClose,
  onUpload,
  uploading,
}: CsvPreviewModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-2xl z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">CSV Upload Preview</h3>
          <button className="text-default-500" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="max-h-96 overflow-auto border rounded mb-4">
          <table className="w-full text-sm">
            <thead className="bg-default-50">
              <tr>
                {rows.length > 0 &&
                  Object.keys(rows[0]).map((k) => (
                    <th key={k} className="p-2 text-left">
                      {k}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b">
                  {Object.values(r).map((v, j) => (
                    <td key={j} className="p-2 truncate max-w-xs">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={onUpload} color="secondary">
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}
