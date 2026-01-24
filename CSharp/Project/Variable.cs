namespace Arcweave.Project;

public partial class Variable
{
    public string Name { get; set; }
    public object Value { get; set; }
    public object ObjectValue => Value;
    public Type Type { get; }
    private object _defaultValue;
    public object DefaultValue => _defaultValue;
    public Variable(string name, object value)
    {
        Name = name;
        Value = value;
        _defaultValue = value;
        Type = value.GetType();
    }
    public void ResetToDefaultValue()
    {
        Value = _defaultValue;
    }
}