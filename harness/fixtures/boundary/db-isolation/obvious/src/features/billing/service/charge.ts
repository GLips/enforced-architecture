// EXPECT+1: a service layer reaching past repo/ straight to the DB
import { db } from "@/infrastructure/db";

export const charge = () => db;
