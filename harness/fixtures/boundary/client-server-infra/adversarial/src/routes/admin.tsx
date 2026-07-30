// EXPECT+1: route modules are isomorphic
import { mailer } from "@/infrastructure/mailer";

export const loader = () => mailer;
