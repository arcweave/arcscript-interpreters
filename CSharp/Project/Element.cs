namespace Arcweave.Project;

public partial class Element
{
    public string Id { get; }
    public Project Project { get; }
    
    public Path ResolvePath(Path path)
    {
        throw new NotImplementedException();
    }

    public List<Attribute> Attributes { get; }
    public void AddAttribute(Attribute attribute)
    {
        throw new NotImplementedException();
    }

    public int Visits { get; set; }
    public string Title { get; }
    public string RawContent { get; }
    public List<Connection> Outputs { get; }
    public void RunContentScript()
    {
        throw new NotImplementedException();
    }

    public Options GetOptions()
    {
        throw new NotImplementedException();
    }
}