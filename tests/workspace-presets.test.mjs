import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultWorkspaceSettings, modulesForPreset, workspaceLanding, isSalesOnlyRoute,
  WORKSPACE_MODULE_IDS, WORKSPACE_PRESET_IDS, WORKSPACE_PRESETS,
} from "../lib/workspaces/presets.ts";

test("existing workspaces use a non-destructive Sales default", () => {
  assert.deepEqual(defaultWorkspaceSettings(), {
    preset: "sales", enabledModules: ["sales"],
    configVersion: 0, updatedAt: 0, updatedBy: "",
  });
});

test("presets return independent mutable module arrays and never classify organizations", () => {
  for (const preset of WORKSPACE_PRESET_IDS) {
    const first = modulesForPreset(preset);
    const second = modulesForPreset(preset);
    assert.deepEqual(first, second);
    first.push("sales");
    assert.deepEqual(second, [...WORKSPACE_PRESETS[preset].defaultModules]);
    assert.ok(WORKSPACE_PRESETS[preset].contactLabel);
    for (const id of second) assert.ok(WORKSPACE_MODULE_IDS.includes(id));
  }
  assert.equal(WORKSPACE_PRESETS.commerce.contactLabel, "Customers");
  assert.equal(WORKSPACE_PRESETS.sales.contactLabel, "Contacts");
  assert.equal(WORKSPACE_PRESETS.commerce.defaultModules.includes("sales"), false);
});

test("workspace entry uses existing real screens, with no simulated dashboard", () => {
  assert.equal(workspaceLanding(modulesForPreset("sales")), "/companies");
  assert.equal(workspaceLanding(modulesForPreset("commerce")), "/contacts");
  assert.equal(workspaceLanding(["lifecycle", "sales"]), "/companies");
});

test("Sales-only routes require an enabled Sales presentation module", () => {
  for (const path of ["/companies", "/deals", "/deals/abc", "/forecast", "/pipelines", "/sequences", "/reports/quarter", "/reports/slipping"]) {
    assert.equal(isSalesOnlyRoute(path), true, path);
  }
  for (const path of ["/", "/workspace", "/contacts", "/activities", "/team", "/settings", "/help", "/company", "/reports-legacy"]) {
    assert.equal(isSalesOnlyRoute(path), false, path);
  }
});
