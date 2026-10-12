import { definePlugin } from "@oxlint/plugins";
import { ambientGlobalsRule } from "./boundary/ambient-globals.ts";
import { barrelDirectionRule } from "./api/barrel-direction.ts";
import { clientServerInfraRule } from "./boundary/client-server-infra.ts";
import { dbIsolationRule } from "./boundary/db-isolation.ts";
import { importPolicyRule } from "./boundary/import-policy.ts";
import { deprecatedPathsRule } from "./placement/deprecated-paths.ts";
import { hookCountRule } from "./react/hook-count.ts";
import { mutationRefreshKeysRule } from "./react/mutation-refresh-keys.ts";
import { accumulatorCountRule } from "./health/accumulator-count.ts";
import { cognitiveComplexityRule } from "./health/cognitive-complexity.ts";
import { noLongCommentsRule } from "./health/no-long-comments.ts";
import { returnWidthRule } from "./health/return-width.ts";
import { noArbitraryClassValuesRule } from "./style/no-arbitrary-class-values.ts";
import { noAsyncEffectRule } from "./react/no-async-effect.ts";
import { noDeprecatedInputValidatorRule } from "./placement/no-deprecated-input-validator.ts";
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
import { noPlainExportInServerFnModuleRule } from "./placement/no-plain-export-in-server-fn-module.ts";
import { noRawPrimitivesRule } from "./style/no-raw-primitives.ts";
import { noRawResultRule } from "./placement/no-raw-result.ts";
import { noChainedTypeAssertionsRule } from "./types/no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./types/no-conditional-empty-object-spread.ts";
import { noModuleMockingRule } from "./testing/no-module-mocking.ts";
import { noVacantSymbolNamesRule } from "./naming/no-vacant-symbol-names.ts";
import { noReflectAccessRule } from "./types/no-reflect-access.ts";
import { noTypeArgumentAssertionRule } from "./types/no-type-argument-assertion.ts";
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
// alongside the rules; `oxlint.config.ts` imports it and reads the list below.
//
// THIS FILE IS THE SOURCE OF THE RULE LIST, and the config no longer restates it. Its severity
// table is keyed by `keyof typeof archPlugin.rules`, so a rule added here and not given a severity
// is a type error, and a severity given to a name absent here cannot be written. A load-time
// assertion repeats both checks for a project that never typechecks its config.
//
// Registration and activation are still separate, and the failure that used to be SILENT is the one
// that changed. A rule registered here and never enabled was loaded and never run — no warning, no
// output, exit 0. It now refuses the config. The other direction was always fatal.
//
// So the two are copied together and neither is pruned: dropping a registration here is dropping a
// rule from the project, which is a decision about the architecture rather than a config edit.
//
// Rule keys match their file names, so a diagnostic id (`arch(db-isolation)`) is also the path to
// the rule that raised it. Rename `meta.name` to whatever prefix reads best in the project's
// diagnostics; the config reads the prefix from `meta.name` rather than spelling it, so every key
// follows.
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
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-module-mocking": noModuleMockingRule,
    "accumulator-count": accumulatorCountRule,
    "cognitive-complexity": cognitiveComplexityRule,
    "no-long-comments": noLongCommentsRule,
    "return-width": returnWidthRule,
    "no-vacant-symbol-names": noVacantSymbolNamesRule,
    "no-reflect-access": noReflectAccessRule,
    "no-type-argument-assertion": noTypeArgumentAssertionRule,
    "require-safety-comment": requireSafetyCommentRule,
    "hook-count": hookCountRule,
    "mutation-refresh-keys": mutationRefreshKeysRule,
    "no-async-effect": noAsyncEffectRule,
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
