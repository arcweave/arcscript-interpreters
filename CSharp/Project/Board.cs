using System.Collections.Generic;
using System.Linq;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Project
{
    public partial class Board
    {
        public string Id { get; set; } 
        public string CustomId { get; }
#if GODOT
        [Export] public Array<Element> Elements { get; private set; }
#else
        public List<INode> Nodes { get; private set; }
        public List<Variable> Variables { get; private set; }
#endif
        public Board(string id, List<INode> nodes, string customId = null)
        {
            Id = id;
            Nodes = nodes;
            CustomId = customId;
            Variables = new List<Variable>();
        }

        public Board(string id, List<INode> nodes, List<Variable> variables, string customId = null)
        {
            Id = id;
            Nodes = nodes;
            foreach (var variable in variables)
            {
                variable.Parent = this;
            }
            Variables = variables;
            CustomId = customId;
        }
        
        public T NodeWithID<T>(string id) where T : INode => Nodes.OfType<T>().FirstOrDefault(x => x.Id == id);

        public void AddVariable(Variable variable)
        { 
            variable.Parent = this;
            Variables.Add(variable);
        }
    }
}