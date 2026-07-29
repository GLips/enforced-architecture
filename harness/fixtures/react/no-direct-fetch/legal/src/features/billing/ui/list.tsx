import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api";
import { listInvoices } from "@/features/billing";

export const List = ({ id }: { id: string }) => {
  // The data-fetching layer, which is what the rule points people to.
  const { data } = useQuery({ queryKey: ["invoices", id], queryFn: () => listInvoices(id) });

  // A project's own wrapper, named so it reads as a call site and not the global.
  const refresh = () => apiFetch("/api/invoices");

  // Words that merely contain the name.
  const prefetched = { fetchedAt: Date.now(), refetchInterval: 500 };

  return { data, refresh, prefetched };
};
