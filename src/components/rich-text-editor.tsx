import React from "react";
import { Textarea, Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  minRows?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Write your content here... (Markdown supported)",
  label = "Content",
  minRows = 10,
}) => {
  const [showPreview, setShowPreview] = React.useState(false);

  const insertMarkdown = (before: string, after = "") => {
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newValue =
      value.substring(0, start) +
      before +
      selectedText +
      after +
      value.substring(end);

    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {/* Markdown Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border border-divider rounded-lg bg-default-50">
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("**", "**")}
          aria-label="Bold"
        >
          <Icon icon="lucide:bold" />
        </Button>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("*", "*")}
          aria-label="Italic"
        >
          <Icon icon="lucide:italic" />
        </Button>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("# ")}
          aria-label="Heading"
        >
          <Icon icon="lucide:heading" />
        </Button>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("\n- ")}
          aria-label="List"
        >
          <Icon icon="lucide:list" />
        </Button>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("[", "](url)")}
          aria-label="Link"
        >
          <Icon icon="lucide:link" />
        </Button>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("`", "`")}
          aria-label="Code"
        >
          <Icon icon="lucide:code" />
        </Button>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => insertMarkdown("> ")}
          aria-label="Quote"
        >
          <Icon icon="lucide:quote" />
        </Button>

        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="flat"
            onPress={() => setShowPreview(!showPreview)}
            startContent={
              <Icon icon={showPreview ? "lucide:edit" : "lucide:eye"} />
            }
          >
            {showPreview ? "Edit" : "Preview"}
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      {showPreview ? (
        <Card>
          <div className="p-4 min-h-[300px] prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value || "*No content to preview*"}
            </ReactMarkdown>
          </div>
        </Card>
      ) : (
        <Textarea
          value={value}
          onValueChange={onChange}
          placeholder={placeholder}
          minRows={minRows}
          classNames={{
            input: "font-mono text-sm",
          }}
        />
      )}

      <p className="text-xs text-foreground-500">
        Supports Markdown formatting. Use the toolbar buttons or type markdown
        directly.
      </p>
    </div>
  );
};
