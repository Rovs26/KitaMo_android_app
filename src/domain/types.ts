export type PaymentMethod = "cash" | "GCash" | "Maya" | "bank transfer" | "other";

export type SyncStatus = "local" | "pending" | "synced" | "failed";

export type BusinessType =
  | "sari-sari store"
  | "karinderia"
  | "street food"
  | "kiosk"
  | "school canteen"
  | "small booth"
  | "other";

export type LanguagePreference = "Taglish" | "Filipino" | "English";
export type ProductType = "retail item" | "cooked food" | "ingredient-based item" | "service/other";
export type UnitType = "piece" | "bottle" | "pack" | "sachet" | "kilo" | "serving" | "case" | "tray" | "other";
export type PaymentStatus = "paid" | "unpaid" | "pending" | "failed";

export type LocalEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt: string | null;
};

export type Business = LocalEntity & {
  businessName: string;
  businessType: BusinessType;
  ownerName: string;
  barangay: string;
  contactNumber: string | null;
  notes: string | null;
  preferredLanguage: LanguagePreference;
  currency: "PHP";
};

export type Branch = LocalEntity & {
  businessId: string;
  branchName: string;
  location: string | null;
  branchType: "stall" | "branch" | "kiosk" | "booth" | "home kitchen" | "pop-up";
  active: boolean;
  notes: string | null;
};

export type Product = LocalEntity & {
  businessId: string;
  branchId: string | null;
  name: string;
  category: string;
  price: number;
  cost: number;
  stockQty: number;
  unitType: UnitType;
  lowStockThreshold: number;
  bundleQuantity: number | null;
  bundlePrice: number | null;
  bundleLabel: string | null;
  active: boolean;
  productType: ProductType;
};

export type Sale = LocalEntity & {
  businessId: string;
  branchId: string | null;
  transactionNo: string;
  happenedAt: string;
  amount: number;
  discount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  externalReferenceNumber: string | null;
  notes: string | null;
};

export type SaleItem = LocalEntity & {
  saleId: string;
  businessId: string;
  branchId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  bundleApplied: boolean;
  discountAmount: number;
};

export type InventoryMovementType =
  | "stock_in"
  | "stock_out_sale"
  | "manual_adjustment"
  | "cooked"
  | "spoilage"
  | "return_to_supplier"
  | "customer_return";

export type InventoryMovement = LocalEntity & {
  businessId: string;
  branchId: string | null;
  productId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  reason: string;
  linkedSaleId: string | null;
  unitCost: number | null;
  totalCost: number | null;
};

export type OwnerAlertSeverity = "info" | "warning" | "critical";
export type OwnerAlertStatus = "active" | "resolved";

export type OwnerAlert = LocalEntity & {
  businessId: string;
  branchId: string | null;
  productId: string | null;
  alertType: string;
  title: string;
  message: string;
  severity: OwnerAlertSeverity;
  status: OwnerAlertStatus;
  source: string;
};

export type RecipeBatch = LocalEntity & {
  businessId: string;
  branchId: string | null;
  recipeName: string;
  batches: number;
  expectedServings: number;
  actualServings: number;
  totalBatchCost: number;
  notes: string | null;
};

export type AppSettingKey =
  | "themeMode"
  | "activeBusinessId"
  | "activeBranchId"
  | "hasCompletedFirstRun"
  | "hasSeededDemoData";

export type AppSetting = {
  id: string;
  key: AppSettingKey;
  value: string;
  valueType: "string" | "boolean" | "number" | "json";
  createdAt: string;
  updatedAt: string;
};
