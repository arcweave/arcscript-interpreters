using System.Collections.Generic;
using System.Linq;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Project
{
public partial class Project
{
    public List<Variable> Variables { get; }
    public List<Board> Boards { get;  }
    public List<Component> Components { get; }
    public Project(List<Board> boards, List<Variable> variables, List<Component> components = null)
    {
        Variables = variables;
        Boards = boards;
        Components = components ?? new List<Component>();
    }
    public Element ElementWithId(string id) => GetNodeWithID<Element>(id);

    public Variable GetVariable(string name, string scope = null)
    {
        if (scope == null)
        {
            return Variables.FirstOrDefault(variable => variable.Name == name);
        }
        var container = Boards.Cast<IHasVariables>()
            .Concat(Components)
            .FirstOrDefault(container => container.CustomId == scope);
        return container?.Variables.FirstOrDefault(variable => variable.Name == name);
    }

    public IEnumerable<Variable> GetAllVariables() => Variables
        .Concat(Boards.SelectMany(board =>
            board.Variables ?? Enumerable.Empty<Variable>()))
        .Concat(Components.SelectMany(component =>
            component.Variables ?? Enumerable.Empty<Variable>()));
    
    public T GetNodeWithID<T>(string id) where T : INode {
        T result = default(T);
        foreach ( var board in Boards ) {
            result = board.NodeWithID<T>(id);
            if ( result != null ) { return result; }
        }
        return result;
    }
}
}
