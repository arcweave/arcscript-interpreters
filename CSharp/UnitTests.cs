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
    struct TestData
    {
        public readonly Dictionary<string, Variable> Variables;
        public readonly List<TestCase> Cases;

        public TestData(Dictionary<string, Variable> variables, List<TestCase> cases)
        {
            Variables = variables;
            Cases = cases;
        }
    }

    private static IEnumerable<TestCaseData> GetValidTestData()
    {
        var tests = LoadJson("../../../__tests__/valid.json");

        foreach (var testCase in tests.Cases)
        {
            yield return new TestCaseData(tests.Variables, testCase);
        }
    }

    private static IEnumerable<TestCaseData> GetConditionsTestData()
    {
        var tests = LoadJson("../../../__tests__/conditions.json");

        foreach (var validTestsCase in tests.Cases)
        {
            yield return new TestCaseData(tests.Variables, validTestsCase);
        }
    }

    private static IEnumerable<TestCaseData> GetStringConcatTestData()
    {
        var tests = LoadJson("../../../__tests__/stringConcat.json");

        foreach (var stringConcatTestCase in tests.Cases)
        {
            yield return new TestCaseData(tests.Variables, stringConcatTestCase);
        }
    }

    private static IEnumerable<TestCaseData> GetRuntimeErrorTestData()
    {
        var tests = LoadJson("../../../__tests__/runtimeErrors.json");

        foreach (var runtimeErrorTestCase in tests.Cases)
        {
            yield return new TestCaseData(tests.Variables, runtimeErrorTestCase);
        }
    }

    private static IEnumerable<TestCaseData> GetParseErrorTestData()
    {
        var tests = LoadJson("../../../__tests__/parseErrors.json");

        foreach (var parseErrorTestCase in tests.Cases)
        {
            yield return new TestCaseData(tests.Variables, parseErrorTestCase);
        }
    }

    private static TestData LoadJson(string filePath)
    {
        using var r = new StreamReader(filePath);
        var json = r.ReadToEnd();
        var testFile = JsonConvert.DeserializeObject<TestFile>(json);
        var variables = new Dictionary<string, Variable>();

        foreach (var variable in testFile.initialVars.Values)
        {
            if (variable.value is long l)
            {
                variables[variable.id] = new Variable(variable.name, (int)l);
            }
            else
            {
                variables[variable.id] = new Variable(variable.name, variable.value);
            }
        }

        return new TestData(variables, testFile.cases);
    }

    private static Dictionary<string, object>? ChangesByName(Dictionary<string, Variable> variables,
        Dictionary<string, object>? changes)
    {
        if (changes == null || changes.Count == 0)
        {
            return null;
        }

        var changesByName = new Dictionary<string, object>();
        foreach (var varChange in changes)
        {
            changesByName[variables[varChange.Key].Name] = varChange.Value;
        }

        return changesByName;
    }

    [Test]
    [TestCaseSource(nameof(GetValidTestData))]
    public void ValidTests(Dictionary<string, Variable> variables, TestCase testCase)
    {
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
        var boards = new List<Board> { board };

        Console.WriteLine("Testing Case: " + testCase.code);
        var project = new Project.Project(boards, variables.Values.ToList());
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

        var changesByName = ChangesByName(variables, testCase.changes);
        if (changesByName != null)
        {
            Assert.That(output.Changes, Is.EqualTo(changesByName));
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
    public void ConditionTests(Dictionary<string, Variable> variables, TestCase testCase)
    {
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
        var boards = new List<Board> { board };

        Console.WriteLine("Testing Case: " + testCase.code);
        var project = new Project.Project(boards, variables.Values.ToList());
        var i = new AwInterpreter(project, testCase.elementId);
        var output = i.RunScript(testCase.code);

        Assert.That(output.Result, Is.EqualTo(testCase.result));
    }

    [Test]
    [TestCaseSource(nameof(GetStringConcatTestData))]
    public void StringConcatTests(Dictionary<string, Variable> variables, TestCase testCase)
    {
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
        var boards = new List<Board> { board };

        Console.WriteLine("Testing Case: " + testCase.code);
        var project = new Project.Project(boards, variables.Values.ToList());
        var i = new AwInterpreter(project, testCase.elementId);
        var output = i.RunScript(testCase.code);

        if (testCase.output != null)
        {
            Assert.That(output.Output, Is.EqualTo(testCase.output));
        }

        var changesByName = ChangesByName(variables, testCase.changes);
        if (changesByName != null)
        {
            Assert.That(output.Changes, Is.EqualTo(changesByName));
        }
    }

    [Test]
    [TestCaseSource(nameof(GetRuntimeErrorTestData))]
    public void RuntimeErrorTests(Dictionary<string, Variable> variables, TestCase testCase)
    {
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
        var boards = new List<Board> { board };

        Console.WriteLine("Testing Case: " + testCase.code);
        var project = new Project.Project(boards, variables.Values.ToList());
        var i = new AwInterpreter(project, testCase.elementId);
        Assert.Throws<RuntimeException>(() => i.RunScript(testCase.code));
    }

    [Test]
    [TestCaseSource(nameof(GetParseErrorTestData))]
    public void ParseErrorTests(Dictionary<string, Variable> variables, TestCase testCase)
    {
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
        var boards = new List<Board> { board };

        Console.WriteLine("Testing Case: " + testCase.code);
        var project = new Project.Project(boards, variables.Values.ToList());
        var i = new AwInterpreter(project, testCase.elementId);
        Assert.Throws<ParseException>(() => i.RunScript(testCase.code));
    }
}
}

