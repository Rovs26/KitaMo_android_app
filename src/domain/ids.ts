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
  | "setting"
  | "ingredient"
  | "ingredient_lot"
  | "ingredient_movement"
  | "recipe"
  | "recipe_line"
  | "production_batch"
  | "production_usage"
  | "sale_usage"
  | "transfer"
  | "fixed_cost"
  | "fixed_cost_payment";

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
export const makeIngredientId = () => makeLocalId("ingredient");
export const makeIngredientLotId = () => makeLocalId("ingredient_lot");
export const makeIngredientMovementId = () => makeLocalId("ingredient_movement");
export const makeRecipeId = () => makeLocalId("recipe");
export const makeRecipeLineId = () => makeLocalId("recipe_line");
export const makeProductionBatchId = () => makeLocalId("production_batch");
export const makeProductionUsageId = () => makeLocalId("production_usage");
export const makeSaleUsageId = () => makeLocalId("sale_usage");
export const makeTransferId = () => makeLocalId("transfer");
export const makeFixedCostId = () => makeLocalId("fixed_cost");
export const makeFixedCostPaymentId = () => makeLocalId("fixed_cost_payment");
