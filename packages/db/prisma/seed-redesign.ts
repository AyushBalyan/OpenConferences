/**
 * Seed for the redesign database: one invented organisation with one invented
 * conference. Nothing here comes from a real conference or organiser, and the
 * conference uses only default settings.
 *
 * Safe to run again: it creates what is missing and changes nothing else.
 * Loading the database client refuses any DATABASE_URL that is not local.
 */
import { generateId, prisma, withTenantContext } from '../src/index.js';

const ORGANISATION = {
  slug: 'example-research-society',
  name: 'Example Research Society',
};

const CONFERENCE = {
  slug: 'example-conference',
  name: 'Example Conference on Open Research',
};

async function main(): Promise<void> {
  const result = await withTenantContext({}, async (tx) => {
    let organisationCreated = false;
    let organisation = await tx.organization.findFirst({
      where: { slug: ORGANISATION.slug, deletedAt: null },
    });
    if (!organisation) {
      organisation = await tx.organization.create({
        data: { id: generateId(), ...ORGANISATION },
      });
      organisationCreated = true;
    }

    let conferenceCreated = false;
    let conference = await tx.conference.findFirst({
      where: { organizationId: organisation.id, slug: CONFERENCE.slug, deletedAt: null },
    });
    if (!conference) {
      conference = await tx.conference.create({
        data: {
          id: generateId(),
          organizationId: organisation.id,
          authorJoinToken: generateId(),
          ...CONFERENCE,
        },
      });
      conferenceCreated = true;
    }

    return { organisation, organisationCreated, conference, conferenceCreated };
  });

  const state = (created: boolean): string => (created ? 'created' : 'already present');
  console.log(
    `Organisation "${result.organisation.name}" ${state(result.organisationCreated)}; ` +
      `conference "${result.conference.name}" ${state(result.conferenceCreated)}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
