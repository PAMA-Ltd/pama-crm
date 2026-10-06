import { defineSchema, defineTable } from "convex/server";
import { companyFields } from "./companyModel";

export default defineSchema({
  companies: defineTable(companyFields).index("by_normalized_name", [
    "normalizedName",
  ]),
});
