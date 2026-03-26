using System.Collections.Generic;

namespace Arcweave
{
    
public struct TestVariable
{
    public string id;
    public string name;
    public string type;
    public object defaultValue;
    public string cType;
    public string scope;
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
    public Dictionary<string, Dictionary<string, object>>? values;
    public List<EventData>? events;
}

public struct TestFile
{
    public Dictionary<string, TestVariable> initialVars;
    public List<TestCase> cases;
}
}

