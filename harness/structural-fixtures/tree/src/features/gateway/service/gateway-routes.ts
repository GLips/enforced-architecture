// Support for the gateway barrel: the names its wildcard hides. Two of them,
// because "the barrel advertises no names" only bites when there is more than
// one name to advertise.
export const gatewayRoutePrefix = "/gateway";

export function listGatewayRoutes(names: readonly string[]): string[] {
  const routes = names.map((name) => `${gatewayRoutePrefix}/${name}`);
  return routes;
}
