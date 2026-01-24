using Arcweave.Interpreter.INodes;

namespace Arcweave.Project;

public partial class Attribute
{
    public string Name { get; }
    public IAttribute.DataType Type { get; }
    public IAttribute.ContainerType containerType { get; }
    public string containerId { get; }
}