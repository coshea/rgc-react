import { useEffect, useState } from "react";
import { Button, Chip, ListBox, Modal } from "@heroui/react";

import { HomePopupPreviewCard } from "@/components/admin-dashboard/home-popup/home-popup-preview-card";
import { audienceLabel } from "@/components/admin-dashboard/home-popup/labels";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  HOME_POPUP_TEMPLATES,
  type HomePopupTemplate,
} from "@/utils/homePopup";

interface HomePopupTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: HomePopupTemplate) => void;
  /** Highlighted when the picker opens. */
  initialId?: string;
}

/** Picks a starting point. Phones get the list only; tapping a row uses it. */
export function HomePopupTemplatePicker({
  isOpen,
  onClose,
  onSelect,
  initialId,
}: HomePopupTemplatePickerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selectedId, setSelectedId] = useState(
    initialId ?? HOME_POPUP_TEMPLATES[0].id,
  );

  useEffect(() => {
    if (isOpen) setSelectedId(initialId ?? HOME_POPUP_TEMPLATES[0].id);
  }, [isOpen, initialId]);

  const selected =
    HOME_POPUP_TEMPLATES.find((t) => t.id === selectedId) ??
    HOME_POPUP_TEMPLATES[0];

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container placement="auto" size="lg" scroll="inside">
        <Modal.Dialog className="sm:max-w-4xl">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading className="text-lg font-semibold">
              Start from a template
            </Modal.Heading>
            <p className="text-sm text-muted">
              Fills in the message, button and suggested audience. You can
              change any of it.
            </p>
          </Modal.Header>
          <Modal.Body className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ListBox
              aria-label="Templates"
              selectionMode="single"
              selectedKeys={[selectedId]}
              onSelectionChange={(keys) => {
                const [key] = keys === "all" ? [] : [...keys];
                if (typeof key === "string") setSelectedId(key);
              }}
              onAction={(key) => {
                // Phones have no preview pane, so a tap there means "use it".
                const template = HOME_POPUP_TEMPLATES.find((t) => t.id === key);
                if (template && !isDesktop) {
                  onSelect(template);
                }
              }}
            >
              {HOME_POPUP_TEMPLATES.map((t) => (
                <ListBox.Item
                  key={t.id}
                  id={t.id}
                  textValue={t.name}
                  className="min-h-14"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span>{t.name}</span>
                    <span className="text-xs text-muted">{t.hint}</span>
                  </div>
                  <Chip size="sm" variant="soft" className="shrink-0">
                    {audienceLabel(t.audience)}
                  </Chip>
                </ListBox.Item>
              ))}
            </ListBox>
            <div className="hidden flex-col gap-3 rounded-2xl bg-default/50 p-4 md:flex">
              <span className="text-xs text-muted">How it will look</span>
              <HomePopupPreviewCard popup={selected} />
              {selected.ctaLink && (
                <p className="text-sm text-muted">
                  Button goes to{" "}
                  <code className="font-mono text-foreground">
                    {selected.ctaLink}
                  </code>
                </p>
              )}
              <p className="mt-auto rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                Text in [BRACKETS] has to be filled in before you can publish.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer className="hidden md:flex md:justify-end">
            <Button variant="tertiary" onPress={onClose}>
              Cancel
            </Button>
            <Button onPress={() => onSelect(selected)}>Use template</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
