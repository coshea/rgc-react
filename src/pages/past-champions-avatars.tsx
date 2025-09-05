import { ChampionsList } from "@/components/champion-list-avatar";
import { testChampions } from "@/data/test-champions";
import { Link } from "@heroui/react";

interface PastChampionsProps {
  showAllYears?: boolean;
}

export default function PastChampionsWithAvatars({
  showAllYears = false,
}: PastChampionsProps) {
  const currentYear = new Date().getFullYear();
  const filteredChampions = showAllYears
    ? testChampions
    : testChampions.filter((champion) => champion.year === currentYear - 1);

  return (
    <div className="max-w-7xl mx-auto p-6 ">
      <div className="text-center mb-4">
        <h1 className="text-4xl font-bold mb-4">Past Champions</h1>
        <p className="text-default-600 max-w-2xl mx-auto">
          Celebrating our distinguished champions and runners-up across all
          major tournaments.
        </p>

        {!showAllYears && (
          <div className="text-center">
            <Link href="/past-champions" color="success" >
              View All Past Champions
            </Link>
          </div>
        )}
      </div>

      <ChampionsList champions={filteredChampions} />
    </div>
  );
}
