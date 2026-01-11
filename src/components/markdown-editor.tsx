import React from "react";
import { Textarea, Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  /** When true, the editor/preview will expand to available parent height */
  fillHeight?: boolean;
  /** Called when user clicks the popout button in the toolbar */
  onPopout?: () => void;
  /** When true, force the editor mode (disable preview) */
  forceEdit?: boolean;
  /** Hide the preview toggle button */
  hidePreviewToggle?: boolean;
}

const BUTTONS: Array<{
  icon: string;
  label: string;
  insert: (
    current: string,
    selection: string,
    pos: number
  ) => { text: string; cursorOffset?: number };
}> = [
  {
    icon: "lucide:bold",
    label: "Bold",
    insert: (_cur, sel) => {
      const content = sel || "bold text";
      return { text: `**${content}**` };
    },
  },
  {
    icon: "lucide:italic",
    label: "Italic",
    insert: (_cur, sel) => {
      const content = sel || "italic";
      return { text: `*${content}*` };
    },
  },
  {
    icon: "lucide:list",
    label: "Bullet List",
    insert: () => ({ text: "\n- Item 1\n- Item 2\n- Item 3\n" }),
  },
  {
    icon: "lucide:list-ordered",
    label: "Numbered List",
    insert: () => ({ text: "\n1. First\n2. Second\n3. Third\n" }),
  },
  {
    icon: "lucide:link",
    label: "Link",
    insert: () => ({ text: "[link text](https://example.com)" }),
  },
  {
    icon: "lucide:code",
    label: "Inline Code",
    insert: (_cur, sel) => ({ text: `\`${sel || "code"}\`` }),
  },
  {
    icon: "lucide:quote",
    label: "Blockquote",
    insert: () => ({ text: "\n> Quoted text\n" }),
  },
  {
    icon: "lucide:table",
    label: "Table",
    insert: () => ({
      text: "\n| Col 1 | Col 2 |\n| ----- | ----- |\n| Val 1 | Val 2 |\n",
    }),
  },
  {
    icon: "lucide:check-square",
    label: "Task List",
    insert: () => ({ text: "\n- [ ] Task one\n- [x] Task done\n" }),
  },
];

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  label = "Details (Markdown)",
  placeholder = "Use markdown for rich tournament details...",
  minRows = 6,
  forceEdit = false,
  hidePreviewToggle = false,
  fillHeight = false,
  onPopout,
}) => {
  const [preview, setPreview] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  function applyInsertion(insertFn: (typeof BUTTONS)[number]["insert"]) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const { text, cursorOffset } = insertFn(value, selected, start);
    const newVal = before + text + after;
    onChange(newVal);
    requestAnimationFrame(() => {
      const pos = before.length + (cursorOffset ?? text.length);
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  const wrapperClass = fillHeight ? "flex flex-col h-full" : "space-y-2";

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-1 flex-wrap">
          {BUTTONS.map((b) => (
            <Tooltip key={b.label} content={b.label}>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => applyInsertion(b.insert)}
                aria-label={b.label}
              >
                <Icon icon={b.icon} className="w-4 h-4" />
              </Button>
            </Tooltip>
          ))}
          {!hidePreviewToggle && (
            <Button
              size="sm"
              variant="flat"
              onPress={() => setPreview((p) => !p)}
              aria-label="Toggle preview"
            >
              {preview ? "Edit" : "Preview"}
            </Button>
          )}
          {onPopout && (
            <Tooltip content="Popout">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onPopout}
                aria-label="Open popout editor"
              >
                <Icon icon="lucide:expand" className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <div className={fillHeight ? "flex-1 min-h-0" : ""}>
        {forceEdit ? (
          fillHeight ? (
            <textarea
              ref={textareaRef}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full font-mono text-sm p-2 border rounded-md resize-none"
            />
          ) : (
            <Textarea
              ref={textareaRef}
              placeholder={placeholder}
              minRows={minRows}
              value={value}
              onValueChange={onChange}
              classNames={{ input: `font-mono text-sm` }}
            />
          )
        ) : !preview ? (
          fillHeight ? (
            <textarea
              ref={textareaRef}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full font-mono text-sm p-2 border rounded-md resize-none"
            />
          ) : (
            <Textarea
              ref={textareaRef}
              placeholder={placeholder}
              minRows={minRows}
              value={value}
              onValueChange={onChange}
              classNames={{ input: `font-mono text-sm` }}
            />
          )
        ) : (
          <div
            className={`border rounded-md p-3 bg-content2 overflow-auto prose dark:prose-invert text-sm ${fillHeight ? "h-full" : "max-h-80"}`}
          >
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <div className="text-foreground-500 italic">No content</div>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-foreground-500">
        Supports Markdown & GFM (tables, strikethrough, task lists).
      </p>
    </div>
  );
};

export default MarkdownEditor;
