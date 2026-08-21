// FIRES barrel-purity: the chain below reaches `postgres` through a SIDE-EFFECT
// import, which is the one import form that binds no name.
export { registerSideEffects } from "./service/register.ts";
