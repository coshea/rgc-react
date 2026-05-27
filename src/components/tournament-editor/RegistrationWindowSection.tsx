import React from "react";
import {
  Card,
  DatePicker,
  DateField,
  Calendar,
  TimeField,
  FieldError,
} from "@heroui/react";
import { Label } from "react-aria-components";
import type { TimeValue } from "react-aria-components";
import type { CalendarDateTime } from "@internationalized/date";

interface RegistrationWindowSectionProps {
  registrationStart: CalendarDateTime | null;
  setRegistrationStart: (v: CalendarDateTime | null) => void;
  registrationEnd: CalendarDateTime | null;
  setRegistrationEnd: (v: CalendarDateTime | null) => void;
  errors: Record<string, string>;
}

export const RegistrationWindowSection: React.FC<
  RegistrationWindowSectionProps
> = ({
  registrationStart,
  setRegistrationStart,
  registrationEnd,
  setRegistrationEnd,
  errors,
}) => {
  return (
    <Card>
      <Card.Content className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Registration Window</h3>
          <span className="text-xs text-muted">Stored in UTC</span>
        </div>
        <div className="space-y-3">
          <DatePicker
            value={registrationStart}
            onChange={(v) => setRegistrationStart(v as CalendarDateTime | null)}
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
                      <Calendar.NavButton slot="next" aria-label="Next month" />
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
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-sm">Time</Label>
                    <TimeField
                      aria-label="Opens time"
                      granularity="minute"
                      value={state.timeValue}
                      onChange={(v) => v && state.setTimeValue(v as TimeValue)}
                    >
                      <TimeField.Group variant="secondary">
                        <TimeField.Input>
                          {(segment) => <TimeField.Segment segment={segment} />}
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
            onChange={(v) => setRegistrationEnd(v as CalendarDateTime | null)}
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
                      <Calendar.NavButton slot="next" aria-label="Next month" />
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
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-sm">Time</Label>
                    <TimeField
                      aria-label="Closes time"
                      granularity="minute"
                      value={state.timeValue}
                      onChange={(v) => v && state.setTimeValue(v as TimeValue)}
                    >
                      <TimeField.Group variant="secondary">
                        <TimeField.Input>
                          {(segment) => <TimeField.Segment segment={segment} />}
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
  );
};
