// A named framework entrypoint, where SDK setup has nowhere else to go.
import { captureException } from "@sentry/react";
export const Root = () => captureException;
