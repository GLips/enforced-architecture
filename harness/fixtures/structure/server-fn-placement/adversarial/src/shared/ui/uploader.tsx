import { createServerFn } from "@tanstack/react-start";

// EXPECT+2: nested inside another call, where a top-level-only scan misses it
export const makeUploader = () =>
  createServerFn({ method: "POST" }).handler(async () => null);
