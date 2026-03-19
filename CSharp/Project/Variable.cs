using System;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Project
{
public partial class Variable
{
    public string Name { get; set; }
    public string Id { get; }
    public object Value { get; set; }
    public object ObjectValue => Value;
    public IHasVariables Parent { get; set; }
    public System.Type Type { get; }
    private object _defaultValue;
    public object DefaultValue => _defaultValue;
    public Variable(string id, string name, object value)
    {
        Id = id;
        Name = name;
        Value = value;
        _defaultValue = value;
        Type = value.GetType();
    }
    public Variable(string id, string name, object value, IHasVariables parent)
    {
        Id = id;
        Name = name;
        Value = value;
        _defaultValue = value;
        Type = value.GetType();
        Parent = parent;
    }
    public void ResetToDefaultValue()
    {
        Value = _defaultValue;
    }
    
    public Variable Clone()
    {
        var other = (Variable)MemberwiseClone();

        if (Type == typeof(string))
        {
            other.Value = (string)Value;
            other._defaultValue = (string)_defaultValue;
        }
        else if (Type == typeof(int))
        {
            other.Value = (int)Value;
            other._defaultValue = (int)_defaultValue;
        }
        else if (Type == typeof(double))
        {
            other.Value = (double)Value;
            other._defaultValue = (double)_defaultValue;
        }
        else if (Type == typeof(bool))
        {
            other.Value = (bool)Value;
            other._defaultValue = (bool)_defaultValue;
        }
        return other;
    }
}
}
