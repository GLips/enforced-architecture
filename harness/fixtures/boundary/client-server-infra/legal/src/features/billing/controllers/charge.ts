// Server contexts import infrastructure freely: that is what they are for.
import { db } from "@/infrastructure/db";
import { mailer } from "@/infrastructure/mailer";

export const charge = () => [db, mailer];
