// controllers/ is permitted too, for projects with no repo layer.
import { db } from "@/infrastructure/db";
export const list = () => db;
