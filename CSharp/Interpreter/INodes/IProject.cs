#if GODOT
using Godot.Collections;
#else
using System.Collections.Generic;
#endif
using Arcweave.Project;

namespace Arcweave.Interpreter.INodes
{
    public interface IProject
    {
#if GODOT
        public Array<Arcweave.Project.Variable> Variables { get; }
#else
        public List<Arcweave.Project.Variable> Variables { get; }
#endif
        public Dictionary<string, Element> Elements { get; }
        public Arcweave.Project.Element ElementWithId(string id);

        public Arcweave.Project.Variable GetVariable(string name);
    }
}
