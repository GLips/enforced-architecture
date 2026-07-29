// A .server.ts file is a server context whatever directory it sits in.
import { db } from "@/infrastructure/db";
export const load = () => db;
