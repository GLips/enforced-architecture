// EXPECT+1: a client component importing server-only infrastructure
import { db } from "@/infrastructure/db";

export const Panel = () => db;
