import React from "react";
import {
  Input,
  TextArea,
  DatePicker,
  DateField,
  Calendar,
  TextField,
  FieldError,
} from "@heroui/react";
import { Label } from "react-aria-components";
import type { DateValue } from "@internationalized/date";
import { MarkdownEditor } from "@/components/markdown-editor";

interface BasicInfoSectionProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  detailsMarkdown: string;
  setDetailsMarkdown: (v: string) => void;
  date: DateValue | null;
  setDate: (v: DateValue | null) => void;
  errors: Record<string, string>;
  onPopoutOpen: () => void;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  title,
  setTitle,
  description,
  setDescription,
  detailsMarkdown,
  setDetailsMarkdown,
  date,
  setDate,
  errors,
  onPopoutOpen,
}) => {
  return (
    <div className="space-y-6 min-w-0">
      <TextField
        isRequired
        isInvalid={!!errors.title}
        value={title}
        onChange={setTitle}
      >
        <Label>Tournament Title</Label>
        <Input placeholder="Enter tournament title" />
        <FieldError>{errors.title}</FieldError>
      </TextField>
      <TextField
        isRequired
        isInvalid={!!errors.description}
        value={description}
        onChange={setDescription}
      >
        <Label>Description</Label>
        <TextArea placeholder="Enter tournament description" />
        <FieldError>{errors.description}</FieldError>
      </TextField>
      <div className="min-w-0">
        <MarkdownEditor
          value={detailsMarkdown}
          onChange={setDetailsMarkdown}
          placeholder="Use markdown for rich tournament details (e.g. rules, schedule, notes)"
          minRows={10}
          onPopout={onPopoutOpen}
        />
      </div>
      <DatePicker
        value={date}
        onChange={setDate}
        isRequired
        isInvalid={!!errors.date}
        className="w-full"
      >
        <Label>Tournament Date</Label>
        <DateField.Group fullWidth>
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        {errors.date && <FieldError>{errors.date}</FieldError>}
        <DatePicker.Popover>
          <Calendar aria-label="Tournament date">
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" aria-label="Previous month" />
              <Calendar.NavButton slot="next" aria-label="Next month" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(d) => <Calendar.Cell date={d} />}
              </Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </div>
  );
};
