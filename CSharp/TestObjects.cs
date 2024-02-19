namespace Arcweave;

public struct TestVariable
{
    public string id;
    public string name;
    public string type;
    public object value;
}

public struct TestCase
{
    public string code;
    public Dictionary<string, object> changes;
    public string? output;
    public string elementId;
    public object result;
    public Dictionary<string, int>? visits;
}

public struct TestFile
{
    public Dictionary<string, TestVariable> initialVars;
    public List<TestCase> cases;
}