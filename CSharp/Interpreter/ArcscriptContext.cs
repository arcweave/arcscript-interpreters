using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Arcweave.Project;

namespace Arcweave.Interpreter
{
    public enum ReferenceKind { Variable, EnumMember }

    public sealed class ArcscriptReference
    {
        public ReferenceKind Kind { get; }
        public string VariableId { get; }
        public string EnumId { get; }
        public string MemberId { get; }
        public Type Type { get; }
        public object Value { get; }

        internal ArcscriptReference(ReferenceKind kind, Type type, string variableId = null,
            string enumId = null, string memberId = null, object value = null)
        {
            Kind = kind;
            Type = type;
            VariableId = variableId;
            EnumId = enumId;
            MemberId = memberId;
            Value = value;
        }
    }

    // A validated snapshot of declarations, shared by parsing and execution.
    public sealed class ArcscriptContext
    {
        private static readonly HashSet<string> ReservedNames = new HashSet<string>("abs max min random roll round sqr sqrt visits show resetVisits reset resetAll if else elseif endif and or is not true false abstract as assert async auto await base bool break byte case catch char checked class const constexpr const_cast continue decimal default delegate delete do double dynamic elif enum event explicit export extends extern false final finally fixed float for foreach friend from func get global goto if implicit import in inline int interface internal is lock long match mutable namespace native new noexcept not not_eq null nullptr object operator or or_eq out override params pass private protected public readonly ref register reinterpret_cast return sbyte sealed set short signal signed sizeof stackalloc static static_assert static_cast string struct super switch template this thread_local throw throws trait try typedef typeid typename typeof uint ulong unchecked union unsafe unsigned using ushort var virtual void volatile wchar_t when where while with yield alignas alignof and_eq asm bitand bitor char8_t char16_t char32_t compl concept co_await co_return co_yield consteval constinit decltype dynamic_cast requires xor xor_eq class_name breakpoint preload self PI TAU INF NAN tool onready setget remote master puppet remotesync mastersync puppetsync".Split(' '));
        private readonly Dictionary<(string Scope, string Name), ArcscriptReference> _references = new Dictionary<(string, string), ArcscriptReference>();
        private readonly Dictionary<string, Type> _enumTypes = new Dictionary<string, Type>();
        public bool HasEnums => _enumTypes.Count > 0;

        public ArcscriptContext(IReadOnlyDictionary<string, EnumDefinition> definitions = null,
            IEnumerable<Variable> variables = null, IEnumerable<string> scopeNames = null)
        {
            definitions = definitions ?? new Dictionary<string, EnumDefinition>();
            var variableList = (variables ?? Enumerable.Empty<Variable>()).ToList();
            var scopes = new HashSet<string>(scopeNames ?? Enumerable.Empty<string>());
            foreach (var variable in variableList)
                if (variable.Parent != null) scopes.Add(variable.Parent.CustomId);
            var names = new HashSet<string>();
            foreach (var entry in definitions)
            {
                var definition = entry.Value;
                AssertName(definition.Name);
                if (string.IsNullOrEmpty(entry.Key) || entry.Key != definition.Id || !names.Add(definition.Name))
                    throw new ParseException("Enum IDs and names must be unique and match their keys");
                if (scopes.Contains(definition.Name))
                    throw new ParseException($"Enum {definition.Name} conflicts with a variable scope");
                if ((definition.Type != "string" && definition.Type != "integer") || definition.Members.Count == 0)
                    throw new ParseException($"Enum {definition.Name} must have string or integer members");
                var type = definition.Type == "string" ? typeof(string) : typeof(int);
                _enumTypes.Add(entry.Key, type);
                var memberIds = new HashSet<string>();
                var memberNames = new HashSet<string>();
                var values = new HashSet<object>();
                foreach (var member in definition.Members)
                {
                    AssertName(member.Name);
                    if (string.IsNullOrEmpty(member.Id) || !memberIds.Add(member.Id) || !memberNames.Add(member.Name) || !values.Add(member.Value))
                        throw new ParseException($"Enum {definition.Name} has duplicate or missing members");
                    if ((definition.Type == "string" && !(member.Value is string)) ||
                        (definition.Type == "integer" && !(member.Value is int)))
                        throw new ParseException($"Invalid backing value for {definition.Name}.{member.Name}");
                    _references.Add((definition.Name, member.Name),
                        new ArcscriptReference(ReferenceKind.EnumMember, type,
                            enumId: entry.Key, memberId: member.Id, value: member.Value));
                }
            }
            foreach (var variable in variableList)
            {
                if (variable.EnumId != null && (!_enumTypes.TryGetValue(variable.EnumId, out var type) || type != variable.Type))
                    throw new ParseException($"Invalid enum reference for variable {variable.Name}");
                var name = (variable.Parent?.CustomId, variable.Name);
                // Preserve the existing first-match behavior for ordinary variable names.
                if (!_references.ContainsKey(name))
                    _references.Add(name, new ArcscriptReference(ReferenceKind.Variable, variable.Type,
                        variableId: variable.Id, enumId: variable.EnumId));
            }
        }

        private static void AssertName(string name)
        {
            if (name == null || !Regex.IsMatch(name, @"\A[A-Za-z][A-Za-z0-9_]*\z") || name.Contains("__") || ReservedNames.Contains(name))
                throw new ParseException($"Invalid or reserved enum identifier {name}");
        }

        public ArcscriptReference Resolve(string name)
        {
            var dot = name.IndexOf('.');
            var key = dot < 0 ? (null, name) : (name.Substring(0, dot), name.Substring(dot + 1));
            return _references.TryGetValue(key, out var reference) ? reference : null;
        }

        public Type EnumType(string id) => _enumTypes[id];
    }
}
