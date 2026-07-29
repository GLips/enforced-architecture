// EXPECT+1: a route reaching straight past the feature layer to the DB
import { db } from "@/infrastructure/db";

export const Route = () => db;
