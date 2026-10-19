import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

import type { User } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import type { WrappedCardSpec } from "@/components/season-wrapped/build-cards";
import { CountUp } from "@/components/season-wrapped/count-up";
import { siteConfig } from "@/config/site";
import {
  MAJOR_KIND,
  type MajorCard,
  type SeasonWrappedMember,
  type SeasonWrappedSeason,
  type TributeCard,
} from "@@/seasonWrapped/types";

/*
 * Card markup mirrors the approved mockup; styles live in wrapped.css
 * (wr-* classes, sized in mockup pixels and scaled to the card).
 */

// Wrapped dates are date-only (midnight UTC), so always format in UTC.
const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function monthName(month: number, long = false): string {
  return (long ? MONTH_LONG : MONTH_SHORT).format(new Date(Date.UTC(2000, month, 1)));
}

function shortDate(iso: string): string {
  return DAY.format(new Date(`${iso}T00:00:00Z`));
}

export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** Animation order for list items, read by wrapped.css as e.g. var(--i). */
function order(vars: Record<`--${string}`, number>): CSSProperties {
  return vars as CSSProperties;
}

/** First name on one line, the rest on the next (mockup style). */
function TwoLineName({ name }: { name: string }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <>
      {first}
      {rest.length > 0 && (
        <>
          <br />
          {rest.join(" ")}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Avatars: real photos where the member has one, initials otherwise
// ---------------------------------------------------------------------------

export const WrappedUsersContext = createContext<ReadonlyMap<string, User>>(new Map());

function WrAvatar({ uid, name, className }: { uid?: string; name: string; className?: string }) {
  const users = useContext(WrappedUsersContext);
  const user = uid ? users.get(uid) : undefined;
  const cls = clsx("wr-av", className);
  return user ? <UserAvatar user={user} className={cls} /> : <UserAvatar name={name} className={cls} />;
}

/**
 * One avatar per player, overlapping for teams. `ids` may be shorter than
 * `names` (older championship records have names only); those get initials.
 */
function WrAvatarStack({ ids = [], names }: { ids?: readonly string[]; names: readonly string[] }) {
  const count = Math.max(ids.length, names.length);
  if (count === 0) return null;
  return (
    <span className="wr-stack">
      {Array.from({ length: count }, (_, i) => (
        <WrAvatar key={ids[i] ?? `name-${i}`} uid={ids[i]} name={names[i] ?? names.join(" ")} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface Progress {
  index: number;
  total: number;
}

interface ShellProps {
  className: string;
  brand: string;
  progress: Progress;
  /** Right side of the brand row; defaults to the card number. */
  brandRight?: string;
  children: ReactNode;
}

function CardShell({ className, brand, brandRight, progress, children }: ShellProps) {
  return (
    <div className={clsx("wr-card", className)}>
      <div className="wr-ticks" aria-hidden>
        {Array.from({ length: progress.total }).map((_, i) => (
          <i key={i} className={i <= progress.index ? "on" : undefined} />
        ))}
      </div>
      <div className="wr-brand">
        <span>{brand}</span>
        <span>{brandRight ?? String(progress.index).padStart(2, "0")}</span>
      </div>
      {children}
    </div>
  );
}

interface CardProps {
  story: SeasonWrappedMember;
  progress: Progress;
}

// ---------------------------------------------------------------------------
// The member's season
// ---------------------------------------------------------------------------

function IntroCard({ story, progress }: CardProps) {
  return (
    <CardShell className="wr-c-intro" brand="RGC Wrapped" brandRight={String(story.year)} progress={progress}>
      <div className="wr-intro-who">
        <WrAvatarStack ids={[story.uid]} names={[story.displayName]} />
        <p className="wr-label">Your season, {story.firstName}</p>
      </div>
      <p className="wr-yr">{story.year}</p>
      <p className="wr-big">
        {story.played ? (
          <>
            was a<br />good one.
          </>
        ) : (
          <>
            at the
            <br />
            club.
          </>
        )}
      </p>
      <svg className="wr-flag" viewBox="0 0 70 150" aria-hidden>
        <rect x="8" y="10" width="3" height="140" fill="#fbf8f0" />
        <path d="M11 10 L62 26 L11 42 Z" fill="#d4553a" />
      </svg>
      <p className="wr-foot">First your season, then the club&apos;s. Tap to start.</p>
    </CardShell>
  );
}

function EventsCard({ story, progress }: CardProps) {
  const events = story.events!;
  return (
    <CardShell className="wr-c-show" brand="Showing up" progress={progress}>
      <p className="wr-big wr-num">
        <CountUp text={String(events.played)} />
      </p>
      <p className="wr-copy">
        {events.played === 1 ? "tournament" : "tournaments"} played, out of {events.calendar} on the {story.year} calendar.
      </p>
      <div
        className="wr-months"
        style={{ gridTemplateColumns: `repeat(${events.months.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={events.months.map((m) => `${monthName(m.month, true)}: ${m.played} of ${m.total}`).join(", ")}
      >
        {events.months.map((m, mi) => (
          <div key={m.month} style={order({ "--m": mi })}>
            <div className="wr-pips">
              {Array.from({ length: m.total }).map((_, i) => (
                <i key={i} className={i < m.played ? "me" : undefined} style={order({ "--p": i })} />
              ))}
            </div>
            <span>{monthName(m.month)}</span>
          </div>
        ))}
      </div>
      {events.busiestMonth !== undefined && (
        <p className="wr-copy-sm">
          {monthName(events.busiestMonth, true)} was your busiest month.
          {events.playedMoreCount !== undefined &&
            (events.playedMoreCount === 0
              ? " Nobody played more events."
              : ` Only ${events.playedMoreCount} ${events.playedMoreCount === 1 ? "member" : "members"} played more.`)}
        </p>
      )}
      <p className="wr-foot">
        That&apos;s {events.played} of the {events.calendar} sign-up sheets with your name on them.
      </p>
    </CardShell>
  );
}

function CrewCard({ story, progress }: CardProps) {
  const crew = story.crew!;
  const partner = crew.topPartner;
  return (
    <CardShell className="wr-c-crew" brand="Your crew" progress={progress}>
      {partner ? (
        <>
          <p className="wr-label wr-mt-6">
            Your most frequent partner
          </p>
          <div className="wr-duo">
            <WrAvatar uid={story.uid} name={story.displayName} className="wr-av-a" />
            <WrAvatar uid={partner.uid} name={partner.displayName} className="wr-av-b" />
          </div>
          <p className="wr-big">
            <TwoLineName name={partner.displayName} />
          </p>
          <p className="wr-copy">
            {partner.events} events together.
            {partner.paidTogether > 0 &&
              ` ${partner.paidTogether === 1 ? "One" : partner.paidTogether} of them ended in the money.`}
          </p>
        </>
      ) : (
        <p className="wr-big wr-mt-6">
          Good
          <br />
          company
        </p>
      )}
      <div className="wr-tally">
        <div>
          <b className="wr-num">
            <CountUp text={String(crew.distinctTeammates)} delay={350} />
          </b>
          <span>different teammates</span>
        </div>
        <div>
          <b className="wr-num">
            <CountUp text={String(story.events?.played ?? 0)} delay={450} />
          </b>
          <span>events played</span>
        </div>
      </div>
      {crew.goldTeeEvents > 0 && (
        <p className="wr-foot">
          You played the gold tees in {crew.goldTeeEvents} {crew.goldTeeEvents === 1 ? "event" : "events"}.
        </p>
      )}
    </CardShell>
  );
}

/** Rows that fit under the rank line before the "more" row. */
const MONEY_ROWS = 7;

function MoneyCard({ story, progress }: CardProps) {
  const money = story.money!;
  const amount = Math.round(money.total).toLocaleString("en-US");
  const shown = money.paidEvents.slice(0, MONEY_ROWS);
  const more = money.paidEvents.length - shown.length;
  return (
    <CardShell className="wr-c-money" brand="Money list" progress={progress}>
      <p className={clsx("wr-big wr-num", amount.length >= 5 && "xlong", amount.length === 4 && "long")}>
        <sup>$</sup>
        <CountUp text={amount} duration={1100} />
      </p>
      {money.rankLabel ? (
        <div className="wr-rank">
          <b className="wr-num">#{money.rankLabel}</b>
          <span>
            of {money.rankedMembers} members on the {story.year} money list
          </span>
        </div>
      ) : (
        <div className="wr-rank">
          <span>
            won across {money.paidEvents.length} {money.paidEvents.length === 1 ? "event" : "events"} in {story.year}
          </span>
        </div>
      )}
      <ul className="wr-finishes">
        {shown.map((e, i) => (
          <li key={`${e.tournamentTitle}-${e.result}`} style={order({ "--i": i })}>
            <span>{e.tournamentTitle}</span>
            <span className="pl">
              {e.result} · {formatMoney(e.amount)}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li style={order({ "--i": shown.length })}>
            <span>
              and {more} more {more === 1 ? "payout" : "payouts"}
            </span>
          </li>
        )}
      </ul>
      <p className="wr-foot">Includes placings, closest to the pin, match play rounds and season awards, the same totals as the Money List page.</p>
    </CardShell>
  );
}

function ClosestToPinCard({ story, progress }: CardProps) {
  const ctp = story.closestToPin!;
  // Balls drop in hole order: closest to the pins first, then aces.
  const ctpHoles = [...new Set(ctp.holes.map((h) => h.hole))].sort((a, b) => a - b);
  const aceHoles = [...new Set(ctp.aces.flatMap((a) => (a.hole ? [a.hole] : [])))].sort((a, b) => a - b);
  const rows = [
    ...(ctpHoles.length > 0 ? [{ label: "CTP", cls: "hit", holes: ctpHoles, first: 0 }] : []),
    ...(aceHoles.length > 0 ? [{ label: "ACE", cls: "ace", holes: aceHoles, first: ctpHoles.length }] : []),
  ];
  const nine = (start: number) => Array.from({ length: 9 }, (_, i) => start + i);
  const cardLabel = [
    ctpHoles.length > 0 && `Closest to the pin on hole ${ctpHoles.join(", ")}`,
    aceHoles.length > 0 && `hole in one on hole ${aceHoles.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ");
  return (
    <CardShell className="wr-c-ctp" brand="Dialed in" progress={progress}>
      {ctp.count > 0 ? (
        <p className="wr-big">
          {ctp.count} closest
          <br />
          to the pin
        </p>
      ) : (
        <p className="wr-big">
          One for
          <br />
          the books
        </p>
      )}
      {rows.length > 0 && (
        <div className="wr-scorecard" role="img" aria-label={cardLabel}>
          {[1, 10].map((start) => (
            <div key={start}>
              <div className="row hd">
                <span>HOLE</span>
                {nine(start).map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              {rows.map((row) => (
                <div key={row.label} className="row">
                  <span>{row.label}</span>
                  {nine(start).map((h) => (
                    <span key={h} className={row.holes.includes(h) ? row.cls : undefined}>
                      {row.holes.includes(h) && (
                        <i className="ball" style={order({ "--i": row.first + row.holes.indexOf(h) })}>
                          ●
                        </i>
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {ctp.count > 0 && (
        <p className="wr-copy-sm">
          {ctp.holes.map((h) => `Hole ${h.hole} at ${h.tournamentTitle}`).join(" and ")}.
        </p>
      )}
      {ctp.aces.map((ace) => (
        <div key={ace.date} className="wr-ace">
          {/* No hole recorded, so no scorecard ball: the ball rolls into this cup instead (wrapped.css). */}
          {!ace.hole && (
            <svg className="wr-cup" viewBox="0 0 30 32" aria-hidden>
              <ellipse cx="15" cy="27" rx="14" ry="4" fill="#2c8a4b" />
              <ellipse cx="15" cy="27" rx="3.4" ry="1.4" fill="#0b1a12" />
              <rect x="14.3" y="3" width="1.4" height="24" fill="#fbf8f0" />
              <path d="M15.7 3 L25 6.5 L15.7 10 Z" fill="#d4553a" />
              <circle className="ball" cx="15" cy="27" r="1.9" fill="#fbf8f0" />
            </svg>
          )}
          <b>Ace</b>
          <span>
            Hole in one{ace.hole ? ` on hole ${ace.hole}` : ""}, {shortDate(ace.date)}
            {ace.tournamentTitle ? ` at ${ace.tournamentTitle}` : ""}.
          </span>
        </div>
      ))}
    </CardShell>
  );
}

function BracketCard({ story, progress }: CardProps) {
  const run = story.bracket!;
  const reached =
    run.reached === "Champions"
      ? "You won it."
      : `You made the ${run.reached === "Final" ? "final" : run.reached.toLowerCase()}.`;
  return (
    <CardShell className="wr-c-bracket" brand="Match play" progress={progress}>
      <p className="wr-big wr-num">
        <CountUp text={`${run.wins}–${run.losses}`} />
      </p>
      <p className="wr-copy">
        in the {run.tournamentTitle}. {reached}
      </p>
      <ul className="wr-bk">
        {run.matches.map((m, i) => (
          <li key={i} className={m.bye ? "bye" : m.won ? "won" : "lost"} style={order({ "--i": i })}>
            <span className="r">{m.roundLabel}</span>
            {m.opponent ? <WrAvatarStack ids={m.opponentIds} names={m.opponent.split(" & ")} /> : <span />}
            <span className="who">
              {m.bye ? "Bye" : m.won ? `def. ${m.opponent ?? "opponent"}` : `lost to ${m.opponent ?? "opponent"}`}
            </span>
            <span className={m.won ? "w" : "l"}>
              {m.won && !m.bye && (
                <svg className="wr-check" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2 6.5 5 9.5 10 2.5" />
                </svg>
              )}
              {m.bye ? "–" : m.won ? "W" : "L"}
            </span>
          </li>
        ))}
      </ul>
      {run.byes > 0 && <p className="wr-foot">Byes count toward rounds advanced but not toward the win–loss record.</p>}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// The club's season
// ---------------------------------------------------------------------------

interface ClubCardProps {
  season: SeasonWrappedSeason;
  progress: Progress;
}

function ClubCard({ season, progress }: ClubCardProps) {
  const c = season.club;
  const champs = c.majors.find((m) => m.kind === MAJOR_KIND.CLUB_CHAMPIONSHIP)?.flights ?? [];
  const tiles = [
    { value: String(c.tournamentCount), label: "tournaments" },
    { value: String(c.playerCount), label: "members played" },
    { value: String(c.holesInOne), label: c.holesInOne === 1 ? "hole in one" : "holes in one" },
    { value: String(c.teamsRegistered), label: "teams registered" },
    // Last tile spans both columns so five tiles fill the grid evenly.
    { value: formatMoney(c.prizeMoneyPaid), label: "paid out in prizes", wide: true },
  ];
  return (
    <CardShell className="wr-c-club" brand="The club" progress={progress}>
      <p className="wr-big">RGC in {season.year}</p>
      <div className="wr-clubgrid">
        {tiles.map((t) => (
          <div key={t.label} className={t.wide ? "wide" : undefined}>
            <b className="wr-num">{t.value}</b>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
      {champs.length > 0 && (
        <ul className="wr-champs">
          {champs.map((f) => (
            <li key={f.championshipType}>
              <WrAvatarStack ids={f.winnerIds} names={f.winnerNames} />
              <span>
                <span className="fl">{f.label}</span>
                {f.winnerNames.join(" & ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function PodiumCard({ season, progress }: ClubCardProps) {
  const c = season.club;
  // Podium order on screen: 2nd, 1st, 3rd.
  const slots = [
    // `delay` matches each block's rise in wrapped.css.
    { entry: c.podium[1], cls: "p2", delay: 400 },
    { entry: c.podium[0], cls: "p1", delay: 650 },
    { entry: c.podium[2], cls: "p3", delay: 150 },
  ].filter((s) => s.entry);
  return (
    <CardShell className="wr-c-podium" brand="Money list" progress={progress}>
      <p className="wr-label wr-mt-6">
        {season.year} top earners
      </p>
      <p className="wr-big">The podium</p>
      <ol className="wr-podium" aria-label={`Top ${c.podium.length} on the ${season.year} money list`}>
        {slots.map(({ entry, cls, delay }) => (
          <li key={entry.uid} className={cls}>
            <WrAvatar uid={entry.uid} name={entry.displayName} className="wr-av-a" />
            <span className="nm">{entry.displayName}</span>
            <span className="amt wr-num">
              <CountUp text={formatMoney(entry.total)} delay={delay} duration={750} />
            </span>
            <span className="blk">{entry.rank}</span>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

const FLIGHT_TEE: Record<string, string> = {
  "club-champion": "blue",
  "club-tee-champion": "white",
  "senior-club-champion": "gold",
};

function MajorCardView({
  major,
  story,
  progress,
  variant,
}: {
  major: MajorCard;
  story: SeasonWrappedMember;
  progress: Progress;
  variant: number;
}) {
  const you = story.majorResults[major.key];
  const isClub = major.kind === MAJOR_KIND.CLUB_CHAMPIONSHIP;
  const winners = major.winnerNames ?? [];
  const longestWord = Math.max(...major.label.split(/\s+/).map((w) => w.length));
  return (
    <CardShell
      className={clsx("wr-c-major", isClub ? "club" : ["v2", "v3", ""][variant % 3])}
      brand="The majors"
      progress={progress}
    >
      <p className="wr-when">Major{major.date ? ` · ${shortDate(major.date)}` : ""}</p>
      {/* Soft hyphen so "Championship" breaks as Champ-ionship, as in the mockup. */}
      <p className={clsx("wr-big", !isClub && longestWord >= 11 && "xlong", !isClub && longestWord >= 9 && longestWord < 11 && "long")}>
        {major.label.replace("Championship", "Champ\u00ADionship")}
      </p>

      {isClub ? (
        <ul className="wr-flights">
          {(major.flights ?? []).map((f) => (
            <li key={f.championshipType} className="wr-flight">
              <span className={clsx("tee", FLIGHT_TEE[f.championshipType])} aria-hidden />
              <span className="fl">{f.label}</span>
              <WrAvatarStack ids={f.winnerIds} names={f.winnerNames} />
              <b>{f.winnerNames.join(" & ")}</b>
              {f.runnerUpNames.length > 0 && <span className="ru">Runner-up: {f.runnerUpNames.join(" & ")}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="wr-champ">
            {/* Both players for team events like Team Match Play. */}
            <WrAvatarStack ids={major.winnerIds} names={winners} />
            <div>
              <span>{winners.length > 1 ? "Champions" : "Champion"}</span>
              <b>{winners.join(" & ")}</b>
            </div>
          </div>
          <dl className="wr-facts">
            {(major.runnerUpNames?.length ?? 0) > 0 && (
              <div>
                <dt>{major.runnerUpNames!.length > 1 ? "Runners-up" : "Runner-up"}</dt>
                <dd>
                  <WrAvatarStack ids={major.runnerUpIds} names={major.runnerUpNames!} />
                  <span>{major.runnerUpNames!.join(" & ")}</span>
                </dd>
              </div>
            )}
            {major.winningScore && (
              <div>
                <dt>Winning score</dt>
                <dd>{major.winningScore}</dd>
              </div>
            )}
            {major.fieldSize && (
              <div>
                <dt>Field</dt>
                <dd>{major.fieldSize}</dd>
              </div>
            )}
            {major.weather && (
              <div>
                <dt>Conditions</dt>
                <dd>
                  {Math.round(major.weather.temperature)}°, {Math.round(major.weather.windSpeed)} mph
                </dd>
              </div>
            )}
          </dl>
        </>
      )}

      {you && <span className="wr-you">You · {you}</span>}
    </CardShell>
  );
}

function TributeCardView({ tribute, progress }: { tribute: TributeCard; progress: Progress }) {
  return (
    <CardShell className="wr-c-tribute" brand="Thank you" progress={progress}>
      <p className="wr-big">{tribute.heading}</p>
      <div className="wr-who">
        <b>{tribute.name}</b>
        <span>{tribute.role}</span>
      </div>
      <p className="wr-copy">{tribute.message}</p>
      <div className="wr-yrs">
        <b>{tribute.stat}</b>
        <span>{tribute.statLabel}</span>
      </div>
      <p className="wr-foot">{tribute.signoff}</p>
    </CardShell>
  );
}

function shareStats(story: SeasonWrappedMember): { value: string; label: string }[] {
  const s = story.share;
  const stats = [
    s.events > 0 && { value: String(s.events), label: s.events === 1 ? "event" : "events" },
    s.total > 0 && { value: formatMoney(s.total), label: s.rankLabel ? `won · #${s.rankLabel}` : "won" },
    s.closestToPins > 0 && { value: String(s.closestToPins), label: s.closestToPins === 1 ? "CTP" : "CTPs" },
    s.topPartner && { value: s.topPartner.split(/\s+/).map((p, i) => (i === 0 ? `${p[0]}.` : p)).join(" "), label: "top partner" },
  ].filter((x): x is { value: string; label: string } => !!x);
  return stats.length > 0 ? stats.slice(0, 4) : [{ value: String(story.year), label: "RGC member" }];
}

function ShareCard({
  story,
  progress,
  shareSlot,
}: CardProps & { shareSlot?: ReactNode }) {
  return (
    <CardShell className="wr-c-share" brand="That's a wrap" progress={progress}>
      <div className="wr-sharecard">
        <p className="wr-label">RGC Wrapped {story.year}</p>
        <p className="nm">
          <TwoLineName name={story.displayName} />
        </p>
        <div className="g">
          {shareStats(story).map((s) => (
            <div key={s.label}>
              <b className="wr-num">{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      {shareSlot}
      <Link to={siteConfig.pages.membership.link} className="wr-renew">
        Renew for {story.year + 1} when registration opens →
      </Link>
    </CardShell>
  );
}

interface WrappedCardProps {
  spec: WrappedCardSpec;
  season: SeasonWrappedSeason;
  story: SeasonWrappedMember;
  index: number;
  total: number;
  /** Share buttons rendered on the last card. */
  shareSlot?: ReactNode;
}

export function WrappedCard({ spec, season, story, index, total, shareSlot }: WrappedCardProps) {
  const progress = { index, total };
  switch (spec.id) {
    case "intro":
      return <IntroCard story={story} progress={progress} />;
    case "events":
      return <EventsCard story={story} progress={progress} />;
    case "crew":
      return <CrewCard story={story} progress={progress} />;
    case "money":
      return <MoneyCard story={story} progress={progress} />;
    case "closest-to-pin":
      return <ClosestToPinCard story={story} progress={progress} />;
    case "bracket":
      return <BracketCard story={story} progress={progress} />;
    case "club":
      return <ClubCard season={season} progress={progress} />;
    case "podium":
      return <PodiumCard season={season} progress={progress} />;
    case "tribute":
      return <TributeCardView tribute={spec.tribute} progress={progress} />;
    case "share":
      return <ShareCard story={story} progress={progress} shareSlot={shareSlot} />;
    default: {
      const others = season.club.majors.filter((m) => m.kind === MAJOR_KIND.MAJOR);
      return (
        <MajorCardView major={spec.major} story={story} progress={progress} variant={others.indexOf(spec.major)} />
      );
    }
  }
}
