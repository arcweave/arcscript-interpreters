namespace Arcweave;

public struct TestVariable
{
    public string id;
    public string name;
    public string type;
    public object value;
}

public struct EventData
{
    public string name;
    public Dictionary<string, object> args;
}

public struct TestCase
{
    public string code;
    public Dictionary<string, object> changes;
    public string? output;
    public string elementId;
    public object result;
    public string? error;
    public Dictionary<string, int>? visits;
    public List<EventData>? events;
}

public struct TestFile
{
    public Dictionary<string, TestVariable> initialVars;
    public List<TestCase> cases;
}