using System;
using System.Collections.Generic;
using System.Linq;
using Arcweave.Project;

namespace Arcweave.Interpreter
{
    public enum ReferenceKind { Variable }

    public sealed class ArcscriptReference
    {
        public ReferenceKind Kind { get; }
        public string VariableId { get; }
        public Type Type { get; }

        internal ArcscriptReference(ReferenceKind kind, Type type, string variableId)
        {
            Kind = kind;
            Type = type;
            VariableId = variableId;
        }
    }

    // A snapshot of declarations, shared by parsing and execution.
    public sealed class ArcscriptContext
    {
        private readonly Dictionary<string, ArcscriptReference> _references = new Dictionary<string, ArcscriptReference>();

        public ArcscriptContext(IEnumerable<Variable> variables = null)
        {
            foreach (var variable in variables ?? Enumerable.Empty<Variable>())
            {
                var name = variable.Parent == null ? variable.Name : variable.Parent.CustomId + "." + variable.Name;
                // Preserve the existing first-match behavior for ordinary variable names.
                if (!_references.ContainsKey(name))
                    _references.Add(name, new ArcscriptReference(ReferenceKind.Variable, variable.Type, variable.Id));
            }
        }

        public ArcscriptReference Resolve(string name)
        {
            return _references.TryGetValue(name, out var reference) ? reference : null;
        }
    }
}
