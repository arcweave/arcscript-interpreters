using System.Collections.Generic;
using System.Linq;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Project
{
    public partial class Board
    {
        public string Id { get; set; }
        public List<INode> Nodes { get; set; }
        
        public Board(string id, List<INode> nodes)
        {
            Id = id;
            Nodes = nodes;
        }
        
        public T NodeWithID<T>(string id) where T : INode => Nodes.OfType<T>().FirstOrDefault(x => x.Id == id);
    }
}