# Feature patterns

A feature starts as one directory with a barrel and grows a layer at a time. The
tiers below are the shapes this tree actually uses, and each one names the
trigger that graduates a feature into the next.

## Small

One directory, one barrel, no layers. Everything lives beside the barrel and the
feature is read top to bottom in a single sitting. Graduate when a second caller
needs the same query, or when the barrel starts re-exporting more than a screen
of names.

## Standard

Controllers, service, repo, ui. The service layer earns its place the moment two
repo calls have to happen in one order, and not before — a service that forwards
a single repo call is a trampoline, and the trampolines check will say so.

## Complex

Everything above plus a domain module for the rules that outlive the feature.
Pure functions, no infrastructure imports, tested without a database. Graduate
here when a second feature needs the same rule and copying it is the alternative
being considered.
