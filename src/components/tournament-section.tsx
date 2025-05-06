import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { testTournamentItems } from "@/data/test-tournaments";
import { TournamentCard } from "./tournament-card";

export function TournamentSection() {
  return (
    <section className="px-4 py-20 bg-background" id="tournaments">

      {/* Tournament section Type 1 */}
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">2025 Tournaments</h2>
          <p className="text-default-600 max-w-2xl mx-auto">
            Discover the features that make our platform stand out from the competition
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testTournamentItems.map((tournament) => (
            <Card key={tournament.title} isHoverable>
              <CardBody className="text-center p-6">
                {/* <Icon icon={tournament.icon} className="w-12 h-12 mx-auto mb-4 text-primary" /> */}
                <h3 className="text-xl font-semibold mb-2">{tournament.title}</h3>
                <p className="text-default-600">{tournament.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Tournament section Type 2 */}
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">2025 Featured Tournaments</h2>
          <p className="text-default-600 max-w-2xl mx-auto">
            Discover the features that make our platform stand out from the competition
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {testTournamentItems.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament}
          />
        ))}
        </div>
      </div>
    </section>
  );
}