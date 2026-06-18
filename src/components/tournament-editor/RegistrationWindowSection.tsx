import React from "react";
import {
  Button,
  Card,
  Checkbox,
  DateField,
  DateRangePicker,
  FieldError,
  RangeCalendar,
  TimeField,
} from "@heroui/react";
import {
  DateFormatter,
  getLocalTimeZone,
  parseDateTime,
  type CalendarDateTime,
  type DateValue,
} from "@internationalized/date";
import { Label } from "react-aria-components";
import type { TimeValue } from "react-aria-components";

interface RegistrationWindowSectionProps {
  registrationStart: CalendarDateTime | null;
  setRegistrationStart: (v: CalendarDateTime | null) => void;
  registrationEnd: CalendarDateTime | null;
  setRegistrationEnd: (v: CalendarDateTime | null) => void;
  registrationOpeningNotificationEnabled: boolean;
  setRegistrationOpeningNotificationEnabled: (value: boolean) => void;
  tournamentDate: DateValue | null;
  errors: Record<string, string>;
}

const pad2 = (value: number): string => String(value).padStart(2, "0");

const formatDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
): string => {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:00:00`;
};

const parseCalendarDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
): CalendarDateTime => {
  return parseDateTime(formatDateTime(year, month, day, hour));
};

export const RegistrationWindowSection: React.FC<
  RegistrationWindowSectionProps
> = ({
  registrationStart,
  setRegistrationStart,
  registrationEnd,
  setRegistrationEnd,
  registrationOpeningNotificationEnabled,
  setRegistrationOpeningNotificationEnabled,
  tournamentDate,
  errors,
}) => {
  const rangeValue =
    registrationStart && registrationEnd
      ? { start: registrationStart, end: registrationEnd }
      : null;

  const setRecommendedWindow = () => {
    if (!tournamentDate) return;

    const tournamentJsDate = new Date(
      Date.UTC(tournamentDate.year, tournamentDate.month - 1, tournamentDate.day)
    );
    const utcDay = tournamentJsDate.getUTCDay();
    const daysFromMonday = (utcDay + 6) % 7;

    const mondayTournamentWeekUtc = new Date(
      Date.UTC(
        tournamentJsDate.getUTCFullYear(),
        tournamentJsDate.getUTCMonth(),
        tournamentJsDate.getUTCDate() - daysFromMonday,
      ),
    );

    const mondayWeekBeforeUtc = new Date(
      Date.UTC(
        mondayTournamentWeekUtc.getUTCFullYear(),
        mondayTournamentWeekUtc.getUTCMonth(),
        mondayTournamentWeekUtc.getUTCDate() - 7,
      ),
    );

    const tuesdayTournamentWeekUtc = new Date(
      Date.UTC(
        mondayTournamentWeekUtc.getUTCFullYear(),
        mondayTournamentWeekUtc.getUTCMonth(),
        mondayTournamentWeekUtc.getUTCDate() + 1,
      ),
    );

    setRegistrationStart(
      parseCalendarDateTime(
        mondayWeekBeforeUtc.getUTCFullYear(),
        mondayWeekBeforeUtc.getUTCMonth() + 1,
        mondayWeekBeforeUtc.getUTCDate(),
        8,
      ),
    );
    setRegistrationEnd(
      parseCalendarDateTime(
        tuesdayTournamentWeekUtc.getUTCFullYear(),
        tuesdayTournamentWeekUtc.getUTCMonth() + 1,
        tuesdayTournamentWeekUtc.getUTCDate(),
        8,
      ),
    );
  };

  return (
    <Card className="overflow-hidden">
      <Card.Content className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="text-sm font-semibold leading-tight">
            Registration Window
          </h3>
        </div>

        <div className="grid min-w-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-6">
          <p className="min-w-0 text-sm leading-snug text-muted">
            Monday 8:00 AM (week before) to Tuesday 8:00 AM (tournament week)
          </p>

          <div className="min-w-0 lg:justify-self-end">
            <Button
              size="sm"
              variant="secondary"
              onPress={setRecommendedWindow}
              isDisabled={!tournamentDate}
              className="w-full sm:w-auto"
            >
              Use Recommended Window
            </Button>
          </div>

          <div className="min-w-0 space-y-3 overflow-hidden lg:col-span-2">
            <DateRangePicker
              value={rangeValue}
              onChange={(value) => {
                if (!value?.start || !value?.end) {
                  setRegistrationStart(null);
                  setRegistrationEnd(null);
                  return;
                }

                setRegistrationStart(value.start as CalendarDateTime);
                setRegistrationEnd(value.end as CalendarDateTime);
              }}
              granularity="minute"
              isInvalid={!!errors.registrationWindow}
              className="w-full min-w-0"
            >
              {({ state }) => (
                <>

            <Checkbox
              isSelected={registrationOpeningNotificationEnabled}
              onChange={setRegistrationOpeningNotificationEnabled}
              id="registration-opening-notification-enabled"
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="registration-opening-notification-enabled">
                  Send push notification when registration opens
                </Label>
                <p className="text-xs text-muted">
                  Disable this for tournaments you use to test registration behavior.
                </p>
              </Checkbox.Content>
            </Checkbox>
                  <Label>Registration range</Label>
                  <DateField.Group
                    fullWidth
                    className="min-w-0 overflow-hidden"
                  >
                    <DateField.InputContainer className="min-w-0 overflow-hidden">
                      <DateField.Input slot="start">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateRangePicker.RangeSeparator />
                      <DateField.Input slot="end">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                    </DateField.InputContainer>
                    <DateField.Suffix>
                      <DateRangePicker.Trigger>
                        <DateRangePicker.TriggerIndicator />
                      </DateRangePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>

                  {errors.registrationWindow && (
                    <FieldError>{errors.registrationWindow}</FieldError>
                  )}

                  <DateRangePicker.Popover className="flex w-fit min-w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-4">
                    <RangeCalendar
                      aria-label="Registration date range"
                      className="w-full"
                    >
                      <RangeCalendar.Header>
                        <RangeCalendar.YearPickerTrigger>
                          <RangeCalendar.YearPickerTriggerHeading />
                          <RangeCalendar.YearPickerTriggerIndicator />
                        </RangeCalendar.YearPickerTrigger>
                        <RangeCalendar.NavButton
                          slot="previous"
                          aria-label="Previous month"
                        />
                        <RangeCalendar.NavButton
                          slot="next"
                          aria-label="Next month"
                        />
                      </RangeCalendar.Header>
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridHeader>
                          {(day) => (
                            <RangeCalendar.HeaderCell>
                              {day}
                            </RangeCalendar.HeaderCell>
                          )}
                        </RangeCalendar.GridHeader>
                        <RangeCalendar.GridBody>
                          {(calendarDate) => (
                            <RangeCalendar.Cell date={calendarDate} />
                          )}
                        </RangeCalendar.GridBody>
                      </RangeCalendar.Grid>
                      <RangeCalendar.YearPickerGrid>
                        <RangeCalendar.YearPickerGridBody>
                          {({ year }) => (
                            <RangeCalendar.YearPickerCell year={year} />
                          )}
                        </RangeCalendar.YearPickerGridBody>
                      </RangeCalendar.YearPickerGrid>
                    </RangeCalendar>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <Label>Start Time</Label>
                        <TimeField
                          aria-label="Registration start time"
                          granularity="minute"
                          value={state.timeRange?.start ?? null}
                          onChange={(value) => {
                            if (!value || !state.timeRange?.end) return;
                            state.setTimeRange({
                              start: value as TimeValue,
                              end: state.timeRange.end as TimeValue,
                            });
                          }}
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
                      <div className="flex items-center justify-between">
                        <Label>End Time</Label>
                        <TimeField
                          aria-label="Registration end time"
                          granularity="minute"
                          value={state.timeRange?.end ?? null}
                          onChange={(value) => {
                            if (!value || !state.timeRange?.start) return;
                            state.setTimeRange({
                              start: state.timeRange.start as TimeValue,
                              end: value as TimeValue,
                            });
                          }}
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
                      <span className="mt-1 text-xs text-muted">
                        Selected:{" "}
                        {state.value?.start && state.value?.end
                          ? new DateFormatter("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).formatRange(
                              state.value.start.toDate(getLocalTimeZone()),
                              state.value.end.toDate(getLocalTimeZone()),
                            )
                          : "No date selected"}
                      </span>
                    </div>
                  </DateRangePicker.Popover>
                </>
              )}
            </DateRangePicker>

            <p className="text-xs text-muted">
              Times are displayed in your local timezone and saved in UTC.
            </p>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
};
