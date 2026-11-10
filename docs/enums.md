# Arcscript enum contract

This implements interpreter stage 1 of Arcweave's `docs/arcscript-enums-plan.md`.
TypeScript, C#, and C++ share the grammar and [enum fixtures](../tests/enums.json).
Application persistence, editors, exports, native enum generation, plugin distribution,
and package publishing are separate integration/release work.

## Definitions and declarations

Enum definitions are project-wide and keyed by stable enum ID. Members are an
ordered array with stable IDs, script names, and primitive backing values:

```json
{
  "quest": {
    "id": "quest",
    "name": "QuestStatus",
    "type": "string",
    "members": [
      { "id": "inactive", "name": "Inactive", "value": "inactive" },
      { "id": "active", "name": "Active", "value": "active" }
    ]
  }
}
```

Each definition has at least one member and one backing type: `string` or
`integer`. Integers use the signed 32-bit range, −2147483648 through 2147483647,
matching C# `int` and the supported C++ targets' `int`. Member IDs, member names,
and backing values must be unique within a definition. Definition IDs must match
their collection keys; definition names must be unique across the project.
Reordering members does not change their values or identity.

Enum and member names use the portable subset `[A-Za-z][A-Za-z0-9_]*`. Arcscript
keywords/functions and C#, C++, and GDScript reserved words are rejected. Leading
underscores, consecutive underscores (including C#'s reserved `value__` member),
and `$` are excluded from this subset. Ordinary variable identifiers
keep their existing rules. Enum names cannot match board/component **custom IDs**
(the script scope names). A global variable may share an enum's name because
unqualified variable lookup and qualified member lookup are distinct.

Supply every board/component scope through `scopeNames`, including scopes with no
variables. All runtimes also discover scopes on their variable definitions; C#
also discovers board/component custom IDs from its project. The host must check
these collisions when creating or renaming either side of the namespace.

An enum variable retains its backing primitive type and adds an `enumId`:

```json
{
  "id": "status",
  "name": "questStatus",
  "type": "string",
  "enumId": "quest",
  "defaultValue": "inactive"
}
```

Definitions and variable references are validated before execution. Missing enum
references and incompatible declared backing types are parse errors. Selected
member IDs belong to authoring storage/export metadata, not runtime values.

## Script rules

| Operation | Behavior |
| --- | --- |
| `questStatus = QuestStatus.Active` | Assigns the backing string `"active"`. |
| `questStatus = otherStatus` | Valid when both variables declare the same enum ID. |
| `Board.questStatus = Component.questStatus` | Uses the same rules as globals. |
| `questStatus = (QuestStatus.Active)` | Parentheses preserve the declared enum. |
| `questStatus = "active"` | Parse error, even when the literal is a member value. |
| `difficulty = Difficulty.Easy + 1` | Parse error: computed assignments are deferred. |
| `difficulty += Difficulty.Easy` | Parse error: compound assignments are deferred. |
| `QuestStatus.Active = ...` | Parse error: enum members are read-only. |
| `reset(QuestStatus.Active)` / `resetAll(QuestStatus.Active)` | Parse error: these functions accept mutable variables. |
| `questStatus == QuestStatus.Active` | Ordinary primitive equality. `!=`, `is`, and `is not` also work. |
| `questStatus == DoorStatus.Active` | Parse error, even if backing strings match. |
| `difficulty >= Difficulty.Normal` | Integer ordering is supported. String-enum ordering is rejected. |
| `difficulty == 2` | Parse error: comparisons with constant expressions require a named member. |
| `show(QuestStatus.Active)` | Displays `active`, with no enum wrapper or label. |
| `number = Difficulty.Hard + 1` | Ordinary variables and expression operators retain primitive behavior. |

Only a direct member/declared variable reference, optionally parenthesized, carries
an enum type during semantic validation. Computed expressions produce ordinary
primitive values. Direct enum comparisons reject differing enum IDs and raw or
computed constant expressions on the other side. Calls to `abs`, `max`, `min`,
`round`, `sqr`, and `sqrt` are constant expressions when every argument is
constant, including nested calls and enum members. Calls that depend on variables,
randomness, or visit counts remain dynamic. Classification never executes a function.
Ordinary variable operands are allowed; their values have no tracked enum origin.
Logical operators retain their
primitive truthiness behavior. These rules do not add general static typing to
Arcscript.

Validation checks every assignment and comparison while parsing, without evaluating expressions, invoking
functions, writing state, or emitting events. It rejects invalid assignments and
comparisons in unreachable branches and short-circuited expressions too. Runtime
execution begins only after validation succeeds.

## Declaration context

Each parse/validation or execution operation builds one `ArcscriptContext` from
the supplied declarations. Parsing and execution share that context. Its resolver
distinguishes mutable variables from enum members and records stable variable,
enum, and member IDs together with their backing types. Member bindings also hold
their primitive constant values.

The context snapshots declaration metadata. Changing source declarations does
not alter bindings in an active operation; subsequent operations rebuild and
validate the context. TypeScript and C# read their supplied definitions on each
operation. C++ owns its enum definitions and rebuilds the context from those
definitions and its current variable declarations.

Visitors read and write variables by resolved ID. Mutable runtime state holds
variable values and changes separately from enum declarations. The parser's
existing semantic hooks use the same resolver for existence, mutability, enum
assignment, and comparison checks, preserving validation at the offending source
location.

## State and host boundaries

Defaults, current values, overrides, resets, returned changes, and saved runtime
state remain primitive. Enum constants never appear in variable changes or resets.
`reset` and `resetAll` restore the host-supplied primitive defaults using each
runtime's existing state lifecycle.

The application/plugin must resolve stored member IDs and validate membership
when supplying defaults, debugger/API writes, plugin setters, or restored values.
The interpreters do not evaluate or validate incoming runtime-value membership.
Static same-enum assignment checks assume those boundaries supplied valid values.
Unknown values from old saves must remain available to recovery APIs, but the host
must block script execution until they have been repaired or reset. A typed getter
must report an unknown value instead of choosing a member silently.

## Interpreter APIs

### TypeScript

```ts
import { Interpreter, type ArcscriptEnumDefs } from '@arcweave/arcscript';

const enums: ArcscriptEnumDefs = {
  quest: {
    id: 'quest', name: 'QuestStatus', type: 'string',
    members: [
      { id: 'inactive', name: 'Inactive', value: 'inactive' },
      { id: 'active', name: 'Active', value: 'active' },
    ],
  },
};
const interpreter = new Interpreter({
  enums,
  scopeNames: ['Board', 'Component'],
  state: {
    status: {
      id: 'status', name: 'questStatus', type: 'string', enumId: 'quest',
      defaultValue: 'inactive',
    },
  },
});
interpreter.parse('<pre><code>questStatus = QuestStatus.Active</code></pre>');
const { changes } = interpreter.runScript(
  '<pre><code>questStatus = QuestStatus.Active</code></pre>'
);
// changes: { status: 'active' }
```

`enums` and `scopeNames` are optional. Public definition and option types are
exported from the package. Existing variable/scope rewriting leaves enum
references intact; enum rename/conversion rewriting belongs to the lifecycle stage.

### C#

Use `EnumDefinition` / `EnumMemberDefinition` from `Arcweave.Interpreter`, with
`Type` set to `"string"` or `"integer"` and member `Value` boxed as `string` or
`int`. Set `Variable.EnumId` on global and scoped variables. Supply definitions
as the optional `enums` argument to `AwInterpreter`:

```csharp
var interpreter = new AwInterpreter(project, enums: definitions);
interpreter.Parse("<pre><code>questStatus = QuestStatus.Active</code></pre>");
var result = interpreter.RunScript(
    "<pre><code>questStatus = QuestStatus.Active</code></pre>");
// result.Changes["status"] is the string "active".
```

`Parse` is the public validation-only API. JSON adapters must convert integer
member values to `int`; libraries that default JSON integers to `long` must
range-check before conversion. Existing constructor calls remain valid.

### C++

Use `EnumDefinition` / `EnumMemberDefinition` from `ArcscriptEnums.h`, with `type`
set to `"string"` or `"integer"` and `std::any` values containing `std::string`
or `int`. Set `Variable::enumId` and pass the definition map as the optional fifth
argument to `ArcscriptTranspiler`; `scopeNames` is the optional sixth argument.

```cpp
Arcweave::ArcscriptTranspiler interpreter("", variables, visits, onEvent, enums);
interpreter.validate("<pre><code>questStatus = QuestStatus.Active</code></pre>");
auto result = interpreter.runScript(
    "<pre><code>questStatus = QuestStatus.Active</code></pre>");
// result.changes["status"] contains std::string("active").
```

The exported bridge adds `runScriptWithEnumsExport`, taking the existing bridge
arguments followed by definitions, a variable-ID-to-enum-ID map, and optional
scope names. `UVariable`, the existing `runScriptExport` signature, and primitive
`UTranspilerOutput` layout are unchanged. Native C++ callers must rebuild against
the updated headers/library because the native `Variable`/state classes grow.

## Export and native mapping contract for integration

Export a root-level, ID-keyed `enums` collection in plain JSON and each engine
format. Export global variables with primitive `type` and resolved `value`, plus
`enumId` and selected `memberId`. Scoped variable attributes retain their envelope:
`attribute.value.type`, `attribute.value.data`, `attribute.value.enumId`, and
`attribute.value.memberId`; string-backed attributes also use `plain: true`.
Importers check that both primitive fields agree with the referenced member.

Native generation is an editor/import-time operation. Integer native members use
their explicit backing values. String native members use nonnegative signed
32-bit codes from a persisted mapping manifest keyed by stable enum/member IDs,
plus a generated native-code-to-string map. On first import, allocate codes in
member-ID order; subsequent imports allocate from a retained high-water mark.
Keep deleted codes reserved. Commit/retain this manifest with generated files;
regeneration must never derive codes from display order or reuse deleted codes.
A missing manifest for an existing generated mapping requires explicit recovery,
not automatic renumbering. The manifest is plugin metadata, not runtime state.

This base contract does not promise Unreal Blueprint exposure: signed 32-bit
enums cannot generally be exposed as Blueprint `uint8` enums. A Blueprint subset
and compatible native generation policy must be agreed in the plugin stage.

Generated typed accessors validate the requested enum ID and backing membership,
including the variable's scope. Provide checked setters and `TryGetEnum` recovery
for unknown saved values. Compare runtime definition IDs/types/member mappings
against compiled mappings before execution. Renames require regeneration;
deletions and backing-value/type edits require an explicit compatibility/migration
policy. Runtime downloads cannot introduce new compiled native types.

The application/plugin release must select format versions, minimum compatible
plugin releases, and save-migration behavior before shipping enum exports. Older
interpreters cannot execute `Enum.Member` merely because exported values remain
primitive. These rollout policies, Unity/Godot/Unreal builds, and their generated
code are outside this interpreter change.
