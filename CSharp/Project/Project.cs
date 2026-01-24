namespace Arcweave.Project;

public partial class Project
{
    public List<Variable> Variables { get; }
    public Dictionary<string, Element> Elements { get;  }
    public Project(List<Variable> variables, Dictionary<string, Element> elements)
    {
        Variables = variables;
        Elements = elements;
    }
    public Element ElementWithId(string id)
    {
        if (Elements.ContainsKey(id))
        {
            return Elements[id];
        }

        return null;
    }

    public Variable GetVariable(string name)
    {
        return Variables.FirstOrDefault(variable => variable.Name == name);
    }
}