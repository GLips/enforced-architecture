// Support for the kiosk barrel: a name this module offers as a STRING, which
// the language allows and no identifier pattern matches.
//
// It is not a barrel, so nothing here is this check's subject — how a module
// spells names among its own files is the module's business, exactly as in
// `surface/service/surface-internals.ts`. It exists so the barrel above has a
// real string-named export to re-name.
function openKiosk(id: string): string {
  return `kiosk:${id}:open`;
}

export { openKiosk as "kiosk-open" };
