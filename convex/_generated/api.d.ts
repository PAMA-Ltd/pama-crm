/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as activities from "../activities.js";
import type * as authz from "../authz.js";
import type * as companies from "../companies.js";
import type * as companyModel from "../companyModel.js";
import type * as contacts from "../contacts.js";
import type * as crmModels from "../crmModels.js";
import type * as deals from "../deals.js";
import type * as emailSequences from "../emailSequences.js";
import type * as mcp from "../mcp.js";
import type * as mcpMail from "../mcpMail.js";
import type * as mcpPagination from "../mcpPagination.js";
import type * as mcpSecurity from "../mcpSecurity.js";
import type * as mcpExpanded from "../mcpExpanded.js";
import type * as mcpAuth from "../mcpAuth.js";
import type * as mcpTokens from "../mcpTokens.js";
import type * as organizations from "../organizations.js";
import type * as pipelines from "../pipelines.js";
import type * as reports from "../reports.js";
import type * as teams from "../teams.js";
import type * as workspaceModels from "../workspaceModels.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  activities: typeof activities;
  authz: typeof authz;
  companies: typeof companies;
  companyModel: typeof companyModel;
  contacts: typeof contacts;
  crmModels: typeof crmModels;
  deals: typeof deals;
  emailSequences: typeof emailSequences;
  mcp: typeof mcp;
  mcpMail: typeof mcpMail;
  mcpPagination: typeof mcpPagination;
  mcpSecurity: typeof mcpSecurity;
  mcpExpanded: typeof mcpExpanded;
  mcpAuth: typeof mcpAuth;
  mcpTokens: typeof mcpTokens;
  organizations: typeof organizations;
  pipelines: typeof pipelines;
  reports: typeof reports;
  teams: typeof teams;
  workspaceModels: typeof workspaceModels;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
