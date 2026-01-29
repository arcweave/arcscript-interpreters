using System;
using System.Collections.Generic;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Project
{
public partial class Options
{
    public Element Element { get; set; }
    public List<Path> Paths { get; set; }
    public bool HasPaths { get; }
    public bool HasOptions { get; }
}

public partial class Path
{
    public string label { get; set; }
    public Element TargetElement { get; set; }
    public List<Connection> _connections { get; set; }

    bool IPath.IsValid => throw new NotImplementedException();

    public void AppendConnection(Connection connection)
    {
        throw new NotImplementedException();
    }

    public void ExecuteAppendedConnectionLabels()
    {
        throw new NotImplementedException();
    }
}
}

