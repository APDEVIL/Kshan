/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ambulanceSim from "../ambulanceSim.js";
import type * as audit from "../audit.js";
import type * as demoData from "../demoData.js";
import type * as directory from "../directory.js";
import type * as dispatch from "../dispatch.js";
import type * as geo from "../geo.js";
import type * as hazards from "../hazards.js";
import type * as intakeAgent from "../intakeAgent.js";
import type * as lib from "../lib.js";
import type * as llm from "../llm.js";
import type * as patients from "../patients.js";
import type * as routing from "../routing.js";
import type * as scenario from "../scenario.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as simulation from "../simulation.js";
import type * as sttAgent from "../sttAgent.js";
import type * as traffic from "../traffic.js";
import type * as triageAgent from "../triageAgent.js";
import type * as triageAgentQueries from "../triageAgentQueries.js";
import type * as views from "../views.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ambulanceSim: typeof ambulanceSim;
  audit: typeof audit;
  demoData: typeof demoData;
  directory: typeof directory;
  dispatch: typeof dispatch;
  geo: typeof geo;
  hazards: typeof hazards;
  intakeAgent: typeof intakeAgent;
  lib: typeof lib;
  llm: typeof llm;
  patients: typeof patients;
  routing: typeof routing;
  scenario: typeof scenario;
  seed: typeof seed;
  sessions: typeof sessions;
  simulation: typeof simulation;
  sttAgent: typeof sttAgent;
  traffic: typeof traffic;
  triageAgent: typeof triageAgent;
  triageAgentQueries: typeof triageAgentQueries;
  views: typeof views;
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
