interface RegistrationMember {
  id?: string;
}

interface RegistrationData {
  ownerId?: string;
  team?: RegistrationMember[];
}

export function collectRegisteredUserIds(
  registrationDocs: Array<{
    data: () => RegistrationData;
  }>,
): Set<string> {
  const registeredUserIds = new Set<string>();

  for (const registrationDoc of registrationDocs) {
    const { ownerId, team } = registrationDoc.data();

    if (ownerId) {
      registeredUserIds.add(ownerId);
    }

    if (!Array.isArray(team)) {
      continue;
    }

    for (const member of team) {
      if (member.id) {
        registeredUserIds.add(member.id);
      }
    }
  }

  return registeredUserIds;
}
