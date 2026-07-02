export const ownerSetupFieldsMigration = {
  id: "002_owner_setup_fields",
  up: `
    ALTER TABLE businesses ADD COLUMN notes TEXT;
    ALTER TABLE branches ADD COLUMN notes TEXT;
  `,
} as const;
