import React from "react";
import { Button } from "@heroui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownEditor } from "@/components/markdown-editor";

interface DetailsPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
}

export const DetailsPopout: React.FC<DetailsPopoutProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-background dark:bg-default/60 rounded-lg p-4 w-full max-w-5xl z-10 max-h-[80vh]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Details (Popout Editor)</h3>
          <Button variant="tertiary" onPress={onClose}>
            Close
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[70vh]">
          <div className="col-span-1 h-full">
            <MarkdownEditor
              value={value}
              onChange={onChange}
              minRows={20}
              forceEdit
              hidePreviewToggle
              fillHeight
              label="Editor"
              placeholder="Edit tournament details (markdown)"
            />
          </div>
          <div className="col-span-1 border rounded-md p-3 bg-surface-secondary h-full overflow-auto prose dark:prose-invert">
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <div className="text-muted italic">No content</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
