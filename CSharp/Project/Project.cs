using System.Collections.Generic;
using System.Linq;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Project
{
public partial class Project
{
    public List<Variable> Variables { get; }
    public List<Board> Boards { get;  }
    public Project(List<Board> boards, List<Variable> variables)
    {
        Variables = variables;
        Boards = boards;
    }
    public Element ElementWithId(string id) => GetNodeWithID<Element>(id);

    public Variable GetVariable(string name, string scope = null)
    {
        if (scope == null)
        {
            return Variables.FirstOrDefault(variable => variable.Name == name);
        }
        var board = Boards.FirstOrDefault(board => board.Id == scope);
        if (board != null)
        {
            return board.Variables.FirstOrDefault(variable => variable.Name == name);
        }
        return null;
    }
    
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

