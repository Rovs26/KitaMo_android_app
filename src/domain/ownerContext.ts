type ContextBusiness = {
  id: string;
};

type ContextBranch = {
  id: string;
  businessId: string;
  active: boolean;
};

export function resolveStoredBusiness<T extends ContextBusiness>(businesses: T[], storedBusinessId?: string | null) {
  if (!storedBusinessId) {
    return null;
  }

  return businesses.find((business) => business.id === storedBusinessId) ?? null;
}

export function resolveStoredBranch<T extends ContextBranch>(
  branches: T[],
  businessId: string,
  storedBranchId?: string | null,
) {
  if (!storedBranchId) {
    return null;
  }

  return branches.find(
    (branch) => branch.id === storedBranchId && branch.businessId === businessId && branch.active,
  ) ?? null;
}

