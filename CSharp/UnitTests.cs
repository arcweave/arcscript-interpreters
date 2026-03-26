using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Newtonsoft.Json;
using Arcweave.Interpreter;
using Arcweave.Interpreter.INodes;
using Arcweave.Project;

namespace Arcweave
{
public class Tests
{

    private static Project.Project CreateProject(TestFile testFile, TestCase testCase)
    {
        var variables = new Dictionary<string, Variable>();
        var boards = new Dictionary<string, Board>();
        foreach (var variable in testFile.initialVars.Values)
        {
            Variable v;
            if (variable.defaultValue is long l)
            {
                v = new Variable(variable.id, variable.name, (int)l);
            }
            else
            {
                v = new Variable(variable.id, variable.name, variable.defaultValue);
            }

            if (variable.cType == null || variable.cType == "global")
            {
                variables[variable.id] = v;
            }
            else if (variable.cType == "boards")
            {
                if (!boards.ContainsKey(variable.scope))
                {
                    boards[variable.scope] = new Board(variable.scope, new List<INode>(), variable.scope);
                }
                boards[variable.scope].AddVariable(v);
            }
        }
        
        if (testCase.values != null)
        {
            foreach (var scopeKvp in testCase.values)
            {
                foreach (var varDef in scopeKvp.Value)
                {
                    var varId = varDef.Key;
                    var varValue = varDef.Value;
                    if (scopeKvp.Key == "global")
                    {
                        variables[varId].Value = varValue;
                    }
                    else
                    {
                        throw new NotImplementedException("Only global scope variable updates is supported in CreateProject");
                    }
                }
            }
        }
        
        var nodes = new List<INode>();
        
        if (testCase.visits != null)
        {
            foreach (var kvp in testCase.visits)
            {
                var element = new Element(kvp.Key)
                {
                    Visits = kvp.Value
                };
                nodes.Add(element);
            }
        }
        var board = new Board("testBoardId", nodes);
        boards["testBoardId"] = board;

        var project = new Project.Project(boards.Values.ToList(), variables.Values.ToList());

        return project;
    }

    private static IEnumerable<TestCaseData> GetValidTestData()
    {
        var tests = LoadJson("../../../__tests__/valid.json");

        foreach (var testCase in tests.cases)
        {
            Project.Project project = CreateProject(tests, testCase);
            yield return new TestCaseData(project, testCase, tests.initialVars);
        }
    }

    private static IEnumerable<TestCaseData> GetConditionsTestData()
    {
        var tests = LoadJson("../../../__tests__/conditions.json");

        foreach (var testCase in tests.cases)
        {
            Project.Project project = CreateProject(tests, testCase);
            yield return new TestCaseData(project, testCase, tests.initialVars);
        }
    }

    private static IEnumerable<TestCaseData> GetStringConcatTestData()
    {
        var tests = LoadJson("../../../__tests__/stringConcat.json");

        foreach (var testCase in tests.cases)
        {
            Project.Project project = CreateProject(tests, testCase);
            yield return new TestCaseData(project, testCase, tests.initialVars);
        }
    }

    private static IEnumerable<TestCaseData> GetRuntimeErrorTestData()
    {
        var tests = LoadJson("../../../__tests__/runtimeErrors.json");

        foreach (var testCase in tests.cases)
        {
            Project.Project project = CreateProject(tests, testCase);
            yield return new TestCaseData(project, testCase, tests.initialVars);
        }
    }

    private static IEnumerable<TestCaseData> GetParseErrorTestData()
    {
        var tests = LoadJson("../../../__tests__/parseErrors.json");
        
        foreach (var testCase in tests.cases)
        {
            Project.Project project = CreateProject(tests, testCase);
            yield return new TestCaseData(project, testCase, tests.initialVars);
        }
    }

    private static IEnumerable<TestCaseData> GetMemberTestData()
    {
        var tests = LoadJson("../../../__tests__/member.json");

        foreach (var testCase in tests.cases)
        {
            Project.Project project = CreateProject(tests, testCase);
            yield return new TestCaseData(project, testCase, tests.initialVars);
        }
    }

    private static TestFile LoadJson(string filePath)
    {
        using var r = new StreamReader(filePath);
        var json = r.ReadToEnd();
        return JsonConvert.DeserializeObject<TestFile>(json);
    }

    private static Dictionary<string, object>? ChangesByName(Project.Project project, Dictionary<string, TestVariable> initialVars,
        Dictionary<string, object>? changes)
    {
        if (changes == null || changes.Count == 0)
        {
            return null;
        }

        var changesByName = new Dictionary<string, object>();
        foreach (var varChange in changes)
        {
            changesByName[initialVars[varChange.Key].name] = varChange.Value;
        }

        return changesByName;
    }

    [Test]
    [TestCaseSource(nameof(GetValidTestData))]
    public void ValidTests(Project.Project project, TestCase testCase, Dictionary<string, TestVariable> initialVars)
    {
        Console.WriteLine("Testing Case: " + testCase.code);
        
        List<EventData> events = new List<EventData>();

        void OnEvent(string eventName)
        {
            var eventData = new EventData { name = eventName, args = new Dictionary<string, object>() };
            events.Add(eventData);
        }

        var i = new AwInterpreter(project, testCase.elementId, OnEvent);
        var output = i.RunScript(testCase.code);

        if (testCase.output != null)
        {
            Assert.That(output.Output, Is.EqualTo(testCase.output));
        }
        
        if (testCase.changes != null)
        {
            Assert.That(output.Changes, Is.EqualTo(testCase.changes));
        }
        
        if (testCase.events != null)
        {
            Assert.That(events.Count, Is.EqualTo(testCase.events.Count));
            for (int index = 0; index < events.Count; index++)
            {
                var expectedEvent = testCase.events[index];
                Assert.That(events[index].name, Is.EqualTo(expectedEvent.name));
                Assert.That(events[index].args, Is.EqualTo(expectedEvent.args));
            }
        }
    }

    [Test]
    [TestCaseSource(nameof(GetConditionsTestData))]
    public void ConditionTests(Project.Project project, TestCase testCase, Dictionary<string, TestVariable> initialVars)
    {
        Console.WriteLine("Testing Case: " + testCase.code);
        
        var i = new AwInterpreter(project, testCase.elementId);
        var output = i.RunScript(testCase.code);

        Assert.That(output.Result, Is.EqualTo(testCase.result));
    }

    [Test]
    [TestCaseSource(nameof(GetStringConcatTestData))]
    public void StringConcatTests(Project.Project project, TestCase testCase, Dictionary<string, TestVariable> initialVars)
    {
        Console.WriteLine("Testing Case: " + testCase.code);
        var i = new AwInterpreter(project, testCase.elementId);
        var output = i.RunScript(testCase.code);

        if (testCase.output != null)
        {
            Assert.That(output.Output, Is.EqualTo(testCase.output));
        }
        
        if (testCase.changes != null)
        {
            Assert.That(output.Changes, Is.EqualTo(testCase.changes));
        }
    }

    [Test]
    [TestCaseSource(nameof(GetRuntimeErrorTestData))]
    public void RuntimeErrorTests(Project.Project project, TestCase testCase, Dictionary<string, TestVariable> initialVars)
    {
        Console.WriteLine("Testing Case: " + testCase.code);
        var i = new AwInterpreter(project, testCase.elementId);
        Assert.Throws<RuntimeException>(() => i.RunScript(testCase.code));
    }

    [Test]
    [TestCaseSource(nameof(GetParseErrorTestData))]
    public void ParseErrorTests(Project.Project project, TestCase testCase, Dictionary<string, TestVariable> initialVars)
    {
        Console.WriteLine("Testing Case: " + testCase.code);
        var i = new AwInterpreter(project, testCase.elementId);
        Assert.Throws<ParseException>(() => i.RunScript(testCase.code));
    }

    [Test]
    [TestCaseSource(nameof(GetMemberTestData))]
    public void MemberTests(Project.Project project, TestCase testCase, Dictionary<string, TestVariable> initialVars)
    {
        Console.WriteLine("Testing Case: " + testCase.code);
        var i = new AwInterpreter(project, testCase.elementId);
        var output = i.RunScript(testCase.code);

        if (testCase.output != null)
        {
            Assert.That(output.Output, Is.EqualTo(testCase.output));
        }
        
        if (testCase.changes != null)
        {
            Assert.That(output.Changes, Is.EqualTo(testCase.changes));
        }
    }
}
}

