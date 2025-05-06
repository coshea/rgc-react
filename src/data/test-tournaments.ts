import { TournamentItem } from "@/types/tournament";
import { UserGroupIcon } from "heroicons-react/24/solid";

export const testTournamentItems: TournamentItem[] = [
  {
    title: "Two Man Best Ball",
    date: new Date("2024-05-15T08:00:00Z"), // Use Date objects
    description: "Annual spring tournament to kick off the season.",
    players: 1,
    completed: true,
    icon: "/logos/spring-champ.png", // Example path
    href: "/tournaments/spring-2024",
    prizePool: 5000,
    id: 0,
  },
  {
    title: "Member-Guest Invitational",
    date: new Date("2024-07-20T09:00:00Z"),
    description: "Bring a guest and compete in a two-day event.",
    players: 4,
    completed: false,
    icon: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=groups",
    href: "/tournaments/member-guest-2024",
    prizePool: 10000,
    id: 1,
  },
  {
    title: "Club Championship",
    date: new Date("2024-09-10T07:30:00Z"),
    description: "Determine the club champion for the year.",
    players: 2,
    completed: false,
    icon: "/logos/club-champ.svg", // Example path

    // href is optional, so not included here
    prizePool: 7500,
    id: 2,
  },
  {
    title: "End of Season Scramble",
    date: new Date("2023-10-28T10:00:00Z"),
    description: "A fun, relaxed scramble format to close the season.",
    players: 4,
    completed: true,
    // logo is optional
    href: "/tournaments/scramble-2023",
    id: 3,
    prizePool: 100,
  },
  {
    title: "Junior Open",
    date: new Date("2024-06-25T11:00:00Z"),
    description: "Tournament for players under 18.",
    players: 4,
    completed: false,
    icon: "/logos/junior-open.png",
    href: "/tournaments/junior-open-2024",
    prizePool: 500,
    id: 4,
  },
];
