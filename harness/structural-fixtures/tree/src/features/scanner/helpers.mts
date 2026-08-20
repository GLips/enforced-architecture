// ADVERSARIAL: the same "governed by nothing" as `helpers.ts` beside it, in a
// file extension the tier's walkers once disagreed about.
//
// Six checks each spelled their own source glob and four of them stopped at
// `.ts`/`.tsx`, so this file was invisible to the path grammar while the import
// graph routed edges through it. One shared `SOURCE_FILE_GLOB` is what closes
// that, and this fixture is what says so: it goes silent the moment a walker
// narrows its extensions again.
export const scanModern = (): string => "modern";
