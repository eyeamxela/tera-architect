import { randomUUID } from 'node:crypto';
import { BuildService } from './service.ts';
import { one } from './db.ts';
import { makeJob } from '../app/data.ts';
import { draftFromJob } from './contracts.ts';

export const localAccounts = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Morgan · Owner',
    email: 'owner@build.test',
    role: 'owner',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Taylor · Project lead',
    email: 'lead@build.test',
    role: 'lead',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Riley · Crew',
    email: 'crew@build.test',
    role: 'crew',
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Alex · Client',
    email: 'client@build.test',
    role: 'client',
  },
];
export const localOrg = '20000000-0000-4000-8000-000000000001';
export async function seedLocal(service: BuildService) {
  if (
    await one(service.db, 'SELECT id FROM build_organizations WHERE id=$1', [
      localOrg,
    ])
  )
    return;
  await service.db.transaction(async (tx) => {
    await tx.query(
      'INSERT INTO build_organizations(id,name,brand) VALUES($1,$2,$3)',
      [
        localOrg,
        'Example Studio',
        JSON.stringify({
          name: 'TERA',
          descriptor: 'PROJECTS & CLIENTS',
          studio: 'Example Studio',
          lead: 'Project team',
        }),
      ],
    );
    for (const a of localAccounts) {
      await tx.query(
        'INSERT INTO build_people(id,email,display_name) VALUES($1,$2,$3)',
        [a.id, a.email, a.name.split(' · ')[0]],
      );
      if (a.role !== 'client')
        await tx.query(
          'INSERT INTO build_memberships(organization_id,user_id,role) VALUES($1,$2,$3)',
          [localOrg, a.id, a.role],
        );
    }
  });
  const owner = await service.actor(localAccounts[0].id);
  const landscape = await service.createProject(
    owner,
    {
      name: 'Creekside Homestead',
      client: 'Alex & Sam',
      location: 'Ojai Valley, CA',
      acres: 42.6,
      template: 'landscape',
      draft: draftFromJob(makeJob()),
    },
    randomUUID(),
  );
  await service.publish(
    owner,
    landscape.id,
    { expectedVersion: 1 },
    randomUUID(),
  );
  for (const a of localAccounts.slice(1, 3))
    await service.assign(owner, landscape.id, a.id, randomUUID());
  await service.invite(
    owner,
    landscape.id,
    'client@build.test',
    'Alex',
    randomUUID(),
  );
  const empty = makeJob(true);
  const renovation = await service.createProject(
    owner,
    {
      name: 'Courtyard Studio',
      client: 'Jordan Lee',
      location: 'Ventura, CA',
      acres: 0,
      template: 'general',
      draft: {
        ...draftFromJob(empty),
        image: '',
        items: [
          {
            id: 'design',
            name: 'Design & documentation',
            description:
              'Site visit, concept options, and a coordinated scope package.',
            quantity: 1,
            unit: 'package',
            rate: 3500,
            included: true,
          },
          {
            id: 'finishes',
            name: 'Finish installation',
            description:
              'Prepare surfaces and install the selected finishes. Materials to be confirmed.',
            quantity: 420,
            unit: 'sq ft',
            rate: 18,
            included: true,
          },
        ],
      },
    },
    randomUUID(),
  );
  await service.publish(
    owner,
    renovation.id,
    { expectedVersion: 1 },
    randomUUID(),
  );
  await service.captureUpdate(
    owner,
    landscape.id,
    {
      text: 'Local example project. Rates, imagery, and quantities are illustrative.',
      visibility: 'internal',
    },
    randomUUID(),
  );
}
