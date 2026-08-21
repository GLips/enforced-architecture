// LEGAL neighbours for `types/no-widen-then-assert`.
import type { SettlementUser } from "./wta-roundtrip.ts";

// A genuine boundary: `JSON.parse` returns `any`, so nothing was known before
// the annotation and the assertion afterwards is a parse decision, not a round
// trip. This is the case that separates the check from a ban on assertions.
export function parseSettlementUser(text: string): SettlementUser {
  const raw: unknown = JSON.parse(text);
  return raw as SettlementUser;
}

// Across a closure the two lines have different authors, so the flow is not one
// this check can call pointless.
export function acrossAClosure(loaded: SettlementUser): () => SettlementUser {
  const widened: unknown = loaded;
  return () => widened as SettlementUser;
}

// A reassigned binding is not a flow either: the value at the assertion may not
// be the value that was widened.
export function reassigned(loaded: SettlementUser, other: SettlementUser): SettlementUser {
  let widened: unknown = loaded;
  widened = other;
  return widened as SettlementUser;
}

// Asserting to another broad type is not a recovery, so there is nothing to
// report: the value is still opaque afterwards.
export function stillOpaque(loaded: SettlementUser): object {
  const widened: unknown = loaded;
  return widened as object;
}

// THE DIVERGENCE ROW, and this is the file that pins it. An open dictionary with
// a PRECISE value type is `types/no-known-value-widening`'s finding — what it
// watches is the keys — and it is not a widening target here or in
// `types/no-opaque-record`, both of which go on to ask whether the value is
// opaque too. Drift this check's reading to the key half alone and it agrees
// with a sibling it is meant to disagree with, and only this neighbour notices.
export type SettlementHandler = () => void;

export function preciseDictionary(handlers: Record<string, SettlementHandler>): SettlementHandler {
  const held: Record<string, SettlementHandler> = handlers;
  return held.start as SettlementHandler;
}
