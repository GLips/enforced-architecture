// Support for the legal barrel: the names it lists out one by one.
export type SurfaceLabel = string;

export const sameName = "surface";

export function labelFor(id: string): SurfaceLabel {
  const [head = id] = id.split(":");
  return head;
}

export function slugFor(id: string): string {
  const slug = id.toLowerCase().split(" ").join("-");
  return slug;
}
