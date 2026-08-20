import { definePlugin } from "@oxlint/plugins";
import { ambientGlobalsRule } from "./boundary/ambient-globals.ts";
import { barrelDirectionRule } from "./api/barrel-direction.ts";
import { clientServerInfraRule } from "./boundary/client-server-infra.ts";
import { dbIsolationRule } from "./boundary/db-isolation.ts";
import { importPolicyRule } from "./boundary/import-policy.ts";
import { deprecatedPathsRule } from "./placement/deprecated-paths.ts";
import { derivedStateRule } from "./react/derived-state.ts";
import { hookCountRule } from "./react/hook-count.ts";
import { noArbitraryClassValuesRule } from "./style/no-arbitrary-class-values.ts";
import { noAsyncEffectRule } from "./react/no-async-effect.ts";
import { noDeprecatedInputValidatorRule } from "./placement/no-deprecated-input-validator.ts";
import { noDirectFetchRule } from "./react/no-direct-fetch.ts";
import { propCountRule } from "./react/prop-count.ts";
import { singleComponentExportRule } from "./react/single-component-export.ts";
import { noDisableValidationRule } from "./effect/no-disable-validation.ts";
import { noEffectCatchAllCauseRule } from "./effect/no-effect-catchallcause.ts";
import { noNestedLayerProvideRule } from "./effect/no-nested-layer-provide.ts";
import { noServiceOptionRule } from "./effect/no-service-option.ts";
import { noSilentErrorSwallowRule } from "./effect/no-silent-error-swallow.ts";
import { noSqlTypeParameterRule } from "./effect/no-sql-type-parameter.ts";
import { noInlineColorRule } from "./style/no-inline-color.ts";
import { noInlineFontSizeRule } from "./style/no-inline-font-size.ts";
import { noInlineStylePropRule } from "./style/no-inline-style-prop.ts";
import { noNestedTernaryRule } from "./health/no-nested-ternary.ts";
import { noOpaqueRecordRule } from "./types/no-opaque-record.ts";
import { noPlainExportInServerFnModuleRule } from "./placement/no-plain-export-in-server-fn-module.ts";
import { noRawPrimitivesRule } from "./style/no-raw-primitives.ts";
import { noRawResultRule } from "./placement/no-raw-result.ts";
import { noBroadParametersRule } from "./types/no-broad-parameters.ts";
import { noChainedTypeAssertionsRule } from "./types/no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./types/no-conditional-empty-object-spread.ts";
import { noKnownValueWideningRule } from "./types/no-known-value-widening.ts";
import { noModuleMockingRule } from "./testing/no-module-mocking.ts";
import { noVacantSymbolNamesRule } from "./naming/no-vacant-symbol-names.ts";
import { noReflectAccessRule } from "./types/no-reflect-access.ts";
import { noRuntimeTypeofRule } from "./types/no-runtime-typeof.ts";
import { noTypeArgumentAssertionRule } from "./types/no-type-argument-assertion.ts";
import { noUnknownReturnsRule } from "./types/no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./types/no-unknown-type-aliases.ts";
import { noWidenThenAssertRule } from "./types/no-widen-then-assert.ts";
import { requireSafetyCommentRule } from "./types/require-safety-comment.ts";
import { noTestImportsRule } from "./boundary/no-test-imports.ts";
import { routeThinnessRule } from "./boundary/route-thinness.ts";
import { schemaPlacementRule } from "./placement/schema-placement.ts";
import { sdkContainmentRule } from "./boundary/sdk-containment.ts";
import { serverFnPlacementRule } from "./placement/server-fn-placement.ts";
import { serverFnValidationRule } from "./placement/server-fn-validation.ts";
import { serverImportContextRule } from "./api/server-import-context.ts";
import { serverNoUpwardRule } from "./boundary/server-no-upward.ts";
import { vendorComponentContainmentRule } from "./style/vendor-component-containment.ts";

// The catalog's rules, registered as one oxlint JS plugin. Copy this file into the project
// alongside the rules taken from the catalog, drop the registrations for rules not adopted, and
// point `.oxlintrc.json` at it:
//
//   { "jsPlugins": ["./oxlint/plugin.ts"],
//     "rules": { "arch/db-isolation": "error", … } }
//
// Registration and activation are separate, and both are silent when missed: a rule absent from
// this file is a rule the linter never loads, and a rule present here but missing from
// `.oxlintrc.json` never runs either. `harness/run-rule-fixtures.ts` fails the build on the first;
// the second is the project's own to watch.
//
// Rule keys match their file names, so a diagnostic id (`arch(db-isolation)`) is also the path to
// the rule that raised it. Rename `meta.name` to whatever prefix reads best in the project's
// diagnostics; every rule key in `.oxlintrc.json` inherits it.
export default definePlugin({
  meta: { name: "arch" },
  rules: {
    "barrel-direction": barrelDirectionRule,
    "server-import-context": serverImportContextRule,
    "ambient-globals": ambientGlobalsRule,
    "client-server-infra": clientServerInfraRule,
    "db-isolation": dbIsolationRule,
    "import-policy": importPolicyRule,
    "no-test-imports": noTestImportsRule,
    "route-thinness": routeThinnessRule,
    "sdk-containment": sdkContainmentRule,
    "server-no-upward": serverNoUpwardRule,
    "no-nested-ternary": noNestedTernaryRule,
    "no-opaque-record": noOpaqueRecordRule,
    "no-broad-parameters": noBroadParametersRule,
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-module-mocking": noModuleMockingRule,
    "no-vacant-symbol-names": noVacantSymbolNamesRule,
    "no-reflect-access": noReflectAccessRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-type-argument-assertion": noTypeArgumentAssertionRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-safety-comment": requireSafetyCommentRule,
    "derived-state": derivedStateRule,
    "hook-count": hookCountRule,
    "no-async-effect": noAsyncEffectRule,
    "no-direct-fetch": noDirectFetchRule,
    "prop-count": propCountRule,
    "single-component-export": singleComponentExportRule,
    "no-disable-validation": noDisableValidationRule,
    "no-effect-catchallcause": noEffectCatchAllCauseRule,
    "no-nested-layer-provide": noNestedLayerProvideRule,
    "no-service-option": noServiceOptionRule,
    "no-silent-error-swallow": noSilentErrorSwallowRule,
    "no-sql-type-parameter": noSqlTypeParameterRule,
    "deprecated-paths": deprecatedPathsRule,
    "no-deprecated-input-validator": noDeprecatedInputValidatorRule,
    "no-plain-export-in-server-fn-module": noPlainExportInServerFnModuleRule,
    "no-raw-result": noRawResultRule,
    "schema-placement": schemaPlacementRule,
    "server-fn-placement": serverFnPlacementRule,
    "server-fn-validation": serverFnValidationRule,
    "no-arbitrary-class-values": noArbitraryClassValuesRule,
    "no-inline-color": noInlineColorRule,
    "no-inline-font-size": noInlineFontSizeRule,
    "no-inline-style-prop": noInlineStylePropRule,
    "no-raw-primitives": noRawPrimitivesRule,
    "vendor-component-containment": vendorComponentContainmentRule,
  },
});
