/**
 * Augments HeroUI v3 component types to re-add props removed from the public
 * API in v3.  These declaration-merges keep v2 call-sites compiling during the
 * gradual migration without touching every file.
 *
 * @deprecated Each augmented prop should be migrated to native v3 API before
 *   the migration is complete.
 */
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import type { Key } from "react-aria-components";

declare module "@heroui/react" {
  // ── Button ─────────────────────────────────────────────────────────────────
  interface ButtonRootProps {
    /** @deprecated v3 – move icon into children */
    startContent?: ReactNode;
    /** @deprecated v3 – move icon into children */
    endContent?: ReactNode;
    /** @deprecated v3 – no radius prop */
    radius?: string;
    /** @deprecated v3 – use isDisabled */
    disabled?: boolean;
    /** @deprecated v3 – no isLoading */
    isLoading?: boolean;
    /** @deprecated v3 – use onPress */
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    /** @deprecated v3 – React Router to prop forwarded via as={Link} */
    to?: string;
    title?: string;
  }

  // ── Chip ──────────────────────────────────────────────────────────────────
  interface ChipRootProps<
    E extends keyof React.JSX.IntrinsicElements = "span",
  > {
    /** @deprecated v3 – no startContent */
    startContent?: ReactNode;
    /** @deprecated v3 – no endContent */
    endContent?: ReactNode;
    /** @deprecated v3 – no radius */
    radius?: string;
    onPress?: () => void;
    onValueChange?: (value: boolean) => void;
    errorMessage?: ReactNode;
  }

  // ── Card ──────────────────────────────────────────────────────────────────
  interface CardRootProps<E extends keyof React.JSX.IntrinsicElements = "div"> {
    /** @deprecated v3 – no shadow prop */
    shadow?: string;
    /** @deprecated v3 – Card isn't pressable; use onClick or wrap in Button */
    onPress?: () => void;
    /** @deprecated v3 – no polymorphic as prop */
    as?: React.ElementType;
    /** @deprecated v3 – no router to prop */
    to?: string;
    title?: string;
    isPressable?: boolean;
    isHoverable?: boolean;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  interface InputRootProps {
    placeholder?: string;
    /** @deprecated v3 – use onChange */
    onValueChange?: (value: string) => void;
    isInvalid?: boolean;
    errorMessage?: ReactNode;
    description?: ReactNode;
    startContent?: ReactNode;
    endContent?: ReactNode;
    isRequired?: boolean;
    isReadOnly?: boolean;
    isDisabled?: boolean;
    min?: number | string;
    max?: number | string;
    step?: string | number;
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    /** @deprecated v3 – use isDisabled */
    disabled?: boolean;
    classNames?: Record<string, string>;
    /** @deprecated v3 – no isClearable */
    isClearable?: boolean;
    onClear?: () => void;
    radius?: string;
    /** @deprecated v3 – Input variant is constrained; augmented for compat */
    variant?: string;
    autoFocus?: boolean;
    autoComplete?: string;
    inputMode?: string;
    labelPlacement?: string;
  }

  // ── TextArea ──────────────────────────────────────────────────────────────
  interface TextAreaRootProps {
    placeholder?: string;
    /** @deprecated v3 – use onChange */
    onValueChange?: (value: string) => void;
    isInvalid?: boolean;
    errorMessage?: ReactNode;
    description?: ReactNode;
    startContent?: ReactNode;
    endContent?: ReactNode;
    isRequired?: boolean;
    minRows?: number;
    maxRows?: number;
    classNames?: Record<string, string>;
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    ref?: React.Ref<HTMLTextAreaElement>;
    /** @deprecated v3 */
    disabled?: boolean;
    isDisabled?: boolean;
  }

  // ── Select ────────────────────────────────────────────────────────────────
  interface SelectRootProps<
    T extends object = object,
    M extends "single" | "multiple" = "single",
  > {
    isInvalid?: boolean;
    errorMessage?: ReactNode;
    placeholder?: string;
    label?: ReactNode;
    disallowEmptySelection?: boolean;
    isRequired?: boolean;
    /** v3 controlled value (single Key, or array of Keys for multi-select, or null) */
    value?: Key | Key[] | null;
    /** v3 change handler – receives the selected Key (or Key[] for multi-select) directly */
    onChange?: (value: Key | Key[] | null) => void;
    /** @deprecated v3 – use value instead */
    selectedKey?: Key | null;
    /** @deprecated v3 – use onChange instead */
    onSelectionChange?: (key: Key | null) => void;
  }

  // ── RadioGroup ────────────────────────────────────────────────────────────
  interface RadioGroupRootProps {
    label?: ReactNode;
    /** @deprecated v3 – use onChange */
    onValueChange?: (value: string) => void;
    size?: string;
    orientation?: string;
    isInvalid?: boolean;
    errorMessage?: ReactNode;
    value?: string;
    defaultValue?: string;
    classNames?: Record<string, string>;
  }

  // ── Switch ────────────────────────────────────────────────────────────────
  interface SwitchRootProps {
    /** @deprecated v3 – use onChange */
    onValueChange?: (value: boolean) => void;
    classNames?: Record<string, string>;
  }

  // ── Checkbox ──────────────────────────────────────────────────────────────
  interface CheckboxRootProps {
    /** @deprecated v3 – use isSelected from react-aria (should already work) */
    isSelected?: boolean;
    /** @deprecated v3 – use onChange */
    onValueChange?: (value: boolean) => void;
    classNames?: Record<string, string>;
    /** @deprecated v3 – CheckboxVariants has no size; augmented for compat */
    size?: string;
    isRequired?: boolean;
    className?: string;
  }

  // ── Spinner ───────────────────────────────────────────────────────────────
  interface SpinnerRootProps<
    E extends keyof React.JSX.IntrinsicElements = "span",
  > {
    /** @deprecated v3 – no label prop */
    label?: ReactNode;
  }

  // ── DatePicker ────────────────────────────────────────────────────────────
  interface DatePickerRootProps<
    T extends import("@internationalized/date").DateValue,
  > {
    label?: ReactNode;
    description?: ReactNode;
    minValue?: import("@internationalized/date").CalendarDate;
    classNames?: Record<string, string>;
    isInvalid?: boolean;
    errorMessage?: ReactNode;
    isRequired?: boolean;
  }

  // ── Accordion ─────────────────────────────────────────────────────────────

  // ── Dropdown ──────────────────────────────────────────────────────────────
  interface DropdownRootProps {
    placement?: string;
  }

  interface DropdownItemProps {
    startContent?: ReactNode;
    endContent?: ReactNode;
    onPress?: () => void;
    id?: string;
    textValue?: string;
    isReadOnly?: boolean;
    closeOnSelect?: boolean;
    description?: ReactNode;
    shortcut?: ReactNode;
    href?: string;
    color?: string;
    variant?: string;
  }

  interface DropdownSectionProps {
    title?: ReactNode;
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  interface TableRootProps<
    E extends keyof React.JSX.IntrinsicElements = "div",
  > {
    /** @deprecated v3 */
    removeWrapper?: boolean;
    /** @deprecated v3 */
    isStriped?: boolean;
    classNames?: Record<string, string>;
    /** @deprecated v3 */
    emptyContent?: ReactNode;
    selectionMode?: string;
  }

  interface TableBodyProps<T extends object = object> {
    emptyContent?: ReactNode;
  }

  interface TableRowProps<T extends object = object> {
    role?: string;
    tabIndex?: number;
    onClick?: () => void;
    onKeyDown?: (e: KeyboardEvent<HTMLTableRowElement>) => void;
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  interface AvatarRootProps {
    /** @deprecated v3 */
    showFallback?: boolean;
    /** @deprecated v3 */
    radius?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    isBordered?: boolean;
    classNames?: Record<string, string>;
    /** @deprecated v3 – Avatar no longer has a name prop */
    name?: string;
    color?: string;
    src?: string;
    alt?: string;
    as?: React.ElementType;
  }

  // ── Alert ─────────────────────────────────────────────────────────────────
  interface AlertRootProps<
    E extends keyof React.JSX.IntrinsicElements = "div",
  > {
    color?: string;
    variant?: string;
    title?: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    onClose?: () => void;
    isClosable?: boolean;
    startContent?: ReactNode;
    endContent?: ReactNode;
  }

  // ── Link ──────────────────────────────────────────────────────────────────
  interface LinkRootProps {
    /** @deprecated v3 */
    isExternal?: boolean;
    /** @deprecated v3 */
    isBlock?: boolean;
    /** @deprecated v3 */
    showAnchorIcon?: boolean;
    /** @deprecated v3 */
    underline?: string;
    /** @deprecated v3 */
    anchorIcon?: ReactNode;
    size?: string;
    color?: string;
    as?: React.ElementType;
    isDisabled?: boolean;
    classNames?: Record<string, string>;
  }

  // ── ComboBox ──────────────────────────────────────────────────────────────
  interface ComboBoxRootProps<T extends object = object> {
    label?: ReactNode;
    placeholder?: string;
    onValueChange?: (value: string) => void;
    isInvalid?: boolean;
    errorMessage?: ReactNode;
    startContent?: ReactNode;
    endContent?: ReactNode;
    description?: ReactNode;
    isRequired?: boolean;
  }
}
