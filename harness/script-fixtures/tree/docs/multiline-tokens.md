# Layer glossary

One layer per line, name and owner separated by a tab, because the terminal
table this was pasted from used tabs and nobody reflowed it.

ui	rendering
controllers	transport
service	orchestration
repo	persistence
infrastructure	adapters
domains	rules
shared	primitives

Ordering:

- ui
- controllers
- service
- repo

Everything above the line it sits on may import everything below it, and
nothing may import upward.
