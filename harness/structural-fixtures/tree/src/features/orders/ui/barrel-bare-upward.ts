// FIRES layer-direction: the feature's own barrel named as the DIRECTORY, with
// no module part for the resolver to take literally.
//
// Its two neighbours spell `/index.ts` and so are file requests. This one is a
// directory request, which is the only shape a `package.json` beside it can
// redirect — and this feature carries one, pointing at `service/inventory.ts`.
// Honour it and the target stops being the barrel: the edge becomes ui → service,
// which runs downward and is silent, and the sharpest upward edge a feature can
// contain is legalised by a JSON file the adopter wrote. That is why
// `module-resolution.ts` empties `mainFields` rather than taking oxc's default.
export { placeOrder } from "@/features/orders";
