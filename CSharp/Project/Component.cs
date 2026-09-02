using System;
using System.Collections.Generic;

namespace Arcweave.Project
{
public partial class Component
{
    public string CustomId { get; }
    public List<Attribute> Attributes { get; }
    public List<Variable> Variables { get; }

    public Component(string customId = null)
    {
        CustomId = customId;
        Attributes = new List<Attribute>();
        Variables = new List<Variable>();
    }

    public void AddAttribute(Attribute attribute)
    {
        Attributes.Add(attribute);
    }

    public void AddVariable(Variable variable)
    {
        variable.Parent = this;
        Variables.Add(variable);
    }
}
}
