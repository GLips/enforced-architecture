// EXPECT+1: the plain read the rule's header names
const key = process.env.STRIPE_KEY;

export const charge = () => key;
