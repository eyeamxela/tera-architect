import { randomUUID } from 'node:crypto';
import { connectDatabase, one } from './db.ts';

const email = process.env.BUILD_OWNER_EMAIL?.trim().toLowerCase();
const name = process.env.BUILD_OWNER_NAME?.trim();
const studio = process.env.BUILD_STUDIO_NAME?.trim();
const org = process.env.BUILD_ORGANIZATION_ID;
if (
  !process.env.DATABASE_URL ||
  !email ||
  !name ||
  !studio ||
  !org ||
  !/^\S+@\S+\.\S+$/.test(email)
)
  throw new Error(
    'Set DATABASE_URL, BUILD_ORGANIZATION_ID (UUID), BUILD_OWNER_EMAIL, BUILD_OWNER_NAME and BUILD_STUDIO_NAME. Run migrations first.',
  );
const db = await connectDatabase({
  connectionString: process.env.DATABASE_URL,
});
try {
  await db.transaction(async (tx) => {
    if (await one(tx, 'SELECT id FROM build_organizations WHERE id=$1', [org]))
      throw new Error(
        'Workspace already exists. Bootstrap does not overwrite a workspace.',
      );
    if (await one(tx, 'SELECT id FROM build_people WHERE email=$1', [email]))
      throw new Error(
        'Owner identity already exists. Review membership before provisioning another workspace.',
      );
    const user = randomUUID();
    await tx.query(
      'INSERT INTO build_organizations(id,name,brand) VALUES($1,$2,$3)',
      [
        org,
        studio,
        JSON.stringify({
          name: 'TERA',
          descriptor: 'ARCHITECT EDITION',
          studio,
          lead: name,
        }),
      ],
    );
    await tx.query(
      'INSERT INTO build_people(id,email,display_name) VALUES($1,$2,$3)',
      [user, email, name],
    );
    await tx.query(
      "INSERT INTO build_memberships(organization_id,user_id,role) VALUES($1,$2,'owner')",
      [org, user],
    );
  });
  console.log(
    'Workspace created. The owner can now verify their email in TERA. No invitation email was sent.',
  );
} finally {
  await db.close();
}
