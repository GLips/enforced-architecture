// Support for the portal barrel: the names its wildcard hides.
export const portalRoutePrefix = "/portal";

export function listPortalRoutes(names: readonly string[]): string[] {
  const routes = names.map((name) => `${portalRoutePrefix}/${name}`);
  return routes;
}
