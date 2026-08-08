import { definePlugin } from "@oxlint/plugins";
import { barrelDirectionRule } from "./api/barrel-direction.ts";
import { clientServerInfraRule } from "./boundary/client-server-infra.ts";
import { dbIsolationRule } from "./boundary/db-isolation.ts";
import { deprecatedPathsRule } from "./structure/deprecated-paths.ts";
import { derivedStateRule } from "./react/derived-state.ts";
import { domainPublicApiRule } from "./api/domain-public-api.ts";
import { domainPurityRule } from "./boundary/domain-purity.ts";
import { envAccessRule } from "./boundary/env-access.ts";
import { featurePublicApiRule } from "./api/feature-public-api.ts";
import { noArbitraryClassValuesRule } from "./style/no-arbitrary-class-values.ts";
import { noAsyncEffectRule } from "./react/no-async-effect.ts";
import { noDeprecatedInputValidatorRule } from "./structure/no-deprecated-input-validator.ts";
import { noDirectFetchRule } from "./react/no-direct-fetch.ts";
import { noInlineColorRule } from "./style/no-inline-color.ts";
import { noInlineFontSizeRule } from "./style/no-inline-font-size.ts";
import { noInlineStylePropRule } from "./style/no-inline-style-prop.ts";
import { noNestedTernaryRule } from "./health/no-nested-ternary.ts";
import { noOpaqueRecordRule } from "./health/no-opaque-record.ts";
import { noPlainExportInServerFnModuleRule } from "./structure/no-plain-export-in-server-fn-module.ts";
import { noRawPrimitivesRule } from "./style/no-raw-primitives.ts";
import { noRawResultRule } from "./structure/no-raw-result.ts";
import { noTestImportsRule } from "./boundary/no-test-imports.ts";
import { routeThinnessRule } from "./boundary/route-thinness.ts";
import { schemaPlacementRule } from "./structure/schema-placement.ts";
import { sdkContainmentRule } from "./boundary/sdk-containment.ts";
import { serverFnPlacementRule } from "./structure/server-fn-placement.ts";
import { serverFnValidationRule } from "./structure/server-fn-validation.ts";
import { serverImportContextRule } from "./api/server-import-context.ts";
import { serverNoUpwardRule } from "./boundary/server-no-upward.ts";
import { sharedPurityRule } from "./boundary/shared-purity.ts";
import { sharedUiPurityRule } from "./boundary/shared-ui-purity.ts";
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
    "domain-public-api": domainPublicApiRule,
    "feature-public-api": featurePublicApiRule,
    "server-import-context": serverImportContextRule,
    "client-server-infra": clientServerInfraRule,
    "db-isolation": dbIsolationRule,
    "domain-purity": domainPurityRule,
    "env-access": envAccessRule,
    "no-test-imports": noTestImportsRule,
    "route-thinness": routeThinnessRule,
    "sdk-containment": sdkContainmentRule,
    "server-no-upward": serverNoUpwardRule,
    "shared-purity": sharedPurityRule,
    "shared-ui-purity": sharedUiPurityRule,
    "no-nested-ternary": noNestedTernaryRule,
    "no-opaque-record": noOpaqueRecordRule,
    "derived-state": derivedStateRule,
    "no-async-effect": noAsyncEffectRule,
    "no-direct-fetch": noDirectFetchRule,
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
