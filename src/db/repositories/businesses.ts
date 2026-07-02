import { z } from "zod";

import { makeBusinessId } from "@/domain/ids";
import type { Business, BusinessType, LanguagePreference, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, type RepositoryDatabase } from "./shared";

const createBusinessSchema = z.object({
  id: z.string().optional(),
  businessName: z.string().min(1),
  businessType: z.string().min(1),
  ownerName: z.string().min(1),
  barangay: z.string().min(1),
  contactNumber: z.string().nullable().optional(),
  preferredLanguage: z.enum(["Taglish", "Filipino", "English"]).default("Taglish"),
  currency: z.literal("PHP").default("PHP"),
});

export type CreateBusinessInput = z.input<typeof createBusinessSchema>;

type BusinessRow = {
  id: string;
  business_name: string;
  business_type: BusinessType;
  owner_name: string;
  barangay: string;
  contact_number: string | null;
  preferred_language: LanguagePreference;
  currency: "PHP";
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    businessName: row.business_name,
    businessType: row.business_type,
    ownerName: row.owner_name,
    barangay: row.barangay,
    contactNumber: row.contact_number,
    preferredLanguage: row.preferred_language,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createBusiness(input: CreateBusinessInput, db?: RepositoryDatabase) {
  const parsed = createBusinessSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const business: Business = {
    id: parsed.id ?? makeBusinessId(),
    businessName: parsed.businessName,
    businessType: parsed.businessType as BusinessType,
    ownerName: parsed.ownerName,
    barangay: parsed.barangay,
    contactNumber: parsed.contactNumber ?? null,
    preferredLanguage: parsed.preferredLanguage,
    currency: parsed.currency,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO businesses (
        id, business_name, business_type, owner_name, barangay, contact_number,
        preferred_language, currency, created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      business.id,
      business.businessName,
      business.businessType,
      business.ownerName,
      business.barangay,
      business.contactNumber,
      business.preferredLanguage,
      business.currency,
      business.createdAt,
      business.updatedAt,
      business.syncStatus,
      business.deletedAt,
    ],
  );

  return business;
}

export async function getBusinessById(id: string, db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<BusinessRow>("SELECT * FROM businesses WHERE id = ? AND deleted_at IS NULL", [id]);
  return row ? mapBusiness(row) : null;
}

export async function listBusinesses(db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<BusinessRow>(
    "SELECT * FROM businesses WHERE deleted_at IS NULL ORDER BY created_at ASC",
  );
  return rows.map(mapBusiness);
}

export async function countBusinesses(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM businesses WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
