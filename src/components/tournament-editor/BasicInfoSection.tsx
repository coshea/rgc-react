import React from "react";
import {
  Card,
  Input,
  TextArea,
  DatePicker,
  DateField,
  Calendar,
  TimeField,
  TextField,
  FieldError,
} from "@heroui/react";
import type { TimeValue } from "react-aria-components";
import { Label } from "react-aria-components";
import type { DateValue, CalendarDateTime } from "@internationalized/date";
import { MarkdownEditor } from "@/components/markdown-editor";

interface BasicInfoSectionProps {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  detailsMarkdown: string;
  onDetailsMarkdownChange: (v: string) => void;
  date: DateValue | null;
  onDateChange: (v: DateValue | null) => void;
  registrationStart: CalendarDateTime | null;
  onRegistrationStartChange: (v: CalendarDateTime | null) => void;
  registrationEnd: CalendarDateTime | null;
  onRegistrationEndChange: (v: CalendarDateTime | null) => void;
  errors: {
    title?: string;
    description?: string;
    date?: string;
    registrationWindow?: string;
  };
  onOpenDetailsPopout: () => void;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  detailsMarkdown,
  onDetailsMarkdownChange,
  date,
  onDateChange,
  registrationStart,
  onRegistrationStartChange,
  registrationEnd,
  onRegistrationEndChange,
  errors,
  onOpenDetailsPopout,
}) => {
  return (
    <div className="space-y-6 min-w-0">
      <TextField
        isRequired
        isInvalid={!!errors.title}
        value={title}
        onChange={onTitleChange}
      >
        <Label>Tournament Title</Label>
        <Input placeholder="Enter tournament title" />
        <FieldError>{errors.title}</FieldError>
      </TextField>

      <TextField
        isRequired
        isInvalid={!!errors.description}
        value={description}
        onChange={onDescriptionChange}
      >
        <Label>Description</Label>
        <TextArea placeholder="Enter tournament description" />
        <FieldError>{errors.description}</FieldError>
      </TextField>

      <div className="min-w-0">
        <MarkdownEditor
          value={detailsMarkdown}
          onChange={onDetailsMarkdownChange}
          placeholder="Use markdown for rich tournament details (e.g. rules, schedule, notes)"
          minRows={10}
          onPopout={onOpenDetailsPopout}
        />
      </div>

      <DatePicker
        value={date}
        onChange={onDateChange}
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

      <Card>
        <Card.Content className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Registration Window</h3>
            <span className="text-xs text-muted">Stored in UTC</span>
          </div>
          <div className="space-y-3">
            <DatePicker
              value={registrationStart}
              onChange={(v) =>
                onRegistrationStartChange(v as CalendarDateTime | null)
              }
              granularity="minute"
              isInvalid={!!errors.registrationWindow}
            >
              {({ state }) => (
                <>
                  <Label>Opens</Label>
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
                  <DatePicker.Popover className="flex flex-col gap-3">
                    <Calendar aria-label="Registration open date">
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton
                          slot="previous"
                          aria-label="Previous month"
                        />
                        <Calendar.NavButton
                          slot="next"
                          aria-label="Next month"
                        />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => (
                            <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                          )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(d) => <Calendar.Cell date={d} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => (
                            <Calendar.YearPickerCell year={year} />
                          )}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                    <div className="flex items-center justify-between px-2">
                      <Label className="text-sm">Time</Label>
                      <TimeField
                        aria-label="Opens time"
                        granularity="minute"
                        value={state.timeValue}
                        onChange={(v) =>
                          v && state.setTimeValue(v as TimeValue)
                        }
                      >
                        <TimeField.Group variant="secondary">
                          <TimeField.Input>
                            {(segment) => (
                              <TimeField.Segment segment={segment} />
                            )}
                          </TimeField.Input>
                        </TimeField.Group>
                      </TimeField>
                    </div>
                  </DatePicker.Popover>
                </>
              )}
            </DatePicker>

            <DatePicker
              value={registrationEnd}
              onChange={(v) =>
                onRegistrationEndChange(v as CalendarDateTime | null)
              }
              granularity="minute"
              isInvalid={!!errors.registrationWindow}
            >
              {({ state }) => (
                <>
                  <Label>Closes</Label>
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
                  {errors.registrationWindow && (
                    <FieldError>{errors.registrationWindow}</FieldError>
                  )}
                  <DatePicker.Popover className="flex flex-col gap-3">
                    <Calendar aria-label="Registration close date">
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton
                          slot="previous"
                          aria-label="Previous month"
                        />
                        <Calendar.NavButton
                          slot="next"
                          aria-label="Next month"
                        />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => (
                            <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                          )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(d) => <Calendar.Cell date={d} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => (
                            <Calendar.YearPickerCell year={year} />
                          )}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                    <div className="flex items-center justify-between px-2">
                      <Label className="text-sm">Time</Label>
                      <TimeField
                        aria-label="Closes time"
                        granularity="minute"
                        value={state.timeValue}
                        onChange={(v) =>
                          v && state.setTimeValue(v as TimeValue)
                        }
                      >
                        <TimeField.Group variant="secondary">
                          <TimeField.Input>
                            {(segment) => (
                              <TimeField.Segment segment={segment} />
                            )}
                          </TimeField.Input>
                        </TimeField.Group>
                      </TimeField>
                    </div>
                  </DatePicker.Popover>
                </>
              )}
            </DatePicker>

            <p className="text-xs text-muted">
              Times are displayed in your local timezone and saved in UTC.
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
