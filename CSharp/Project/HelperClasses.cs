namespace Arcweave.Project;

public partial class Options
{
    public Element Element { get; set; }
    public List<Path> Paths { get; set; }
}

public partial class Path
{
    public string label { get; set; }
    public Element TargetElement { get; set; }
    public List<Connection> _connections { get; set; }
    public void AppendConnection(Connection connection)
    {
        throw new NotImplementedException();
    }

    public void ExecuteAppendedConnectionLabels()
    {
        throw new NotImplementedException();
    }
}