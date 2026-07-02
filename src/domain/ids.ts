export type LocalIdKind =
  | "business"
  | "branch"
  | "product"
  | "sale"
  | "sale_item"
  | "receipt"
  | "movement"
  | "alert"
  | "queue_item"
  | "batch"
  | "setting";

function shortRandom() {
  return Math.random().toString(36).slice(2, 8);
}

export function makeLocalId(kind: LocalIdKind) {
  return `local_${kind}_${Date.now().toString(36)}_${shortRandom()}`;
}

export const makeBusinessId = () => makeLocalId("business");
export const makeBranchId = () => makeLocalId("branch");
export const makeProductId = () => makeLocalId("product");
export const makeSaleId = () => makeLocalId("sale");
export const makeSaleItemId = () => makeLocalId("sale_item");
export const makeReceiptId = () => makeLocalId("receipt");
export const makeMovementId = () => makeLocalId("movement");
export const makeAlertId = () => makeLocalId("alert");
export const makeQueueItemId = () => makeLocalId("queue_item");
export const makeBatchId = () => makeLocalId("batch");
export const makeSettingId = () => makeLocalId("setting");
