using Arcweave.Interpreter.INodes;

namespace Arcweave.Project;

public partial class Connection
{
    public string Id { get; }
    public string RawLabel { get; }
    public string RuntimeLabel { get; }
    public INode Source { get; }
    public INode Target { get; }
    public Project Project { get; }
    public void Set(string label, INode source, INode target)
    {
        throw new NotImplementedException();
    }

    public void RunLabelScript()
    {
        throw new NotImplementedException();
    }

    public Path ResolvePath(Path p)
    {
        throw new NotImplementedException();
    }
}