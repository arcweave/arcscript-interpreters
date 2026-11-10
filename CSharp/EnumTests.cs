using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Arcweave.Interpreter;
using Arcweave.Interpreter.INodes;
using Arcweave.Project;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace Arcweave
{
    public class EnumTests
    {
        private static JObject Fixture() => JObject.Parse(File.ReadAllText("../../../../tests/enums.json"));
        private static object Value(JToken token)
        {
            if (token.Type != JTokenType.Integer) return ((JValue)token).Value;
            long value = token.Value<long>();
            return value >= int.MinValue && value <= int.MaxValue ? (object)(int)value : value;
        }

        private static IEnumerable<TestCaseData> Cases() => Fixture()["cases"]
            .Select(test => new TestCaseData(test).SetName("Enums: " + test["name"]));

        [TestCaseSource(nameof(Cases))]
        public void SharedContract(JToken test)
        {
            var fixture = Fixture();
            var enums = new Dictionary<string, EnumDefinition>();
            foreach (var entry in (JObject)(test["enums"] ?? fixture["enums"]))
            {
                var definition = entry.Value;
                enums.Add(entry.Key, new EnumDefinition {
                    Id = (string)definition["id"], Name = (string)definition["name"], Type = (string)definition["type"],
                    Members = definition["members"].Select(member => new EnumMemberDefinition {
                        Id = (string)member["id"], Name = (string)member["name"], Value = Value(member["value"])
                    }).ToList()
                });
            }
            var globals = new List<Variable>();
            var boards = new Dictionary<string, Board>();
            var components = new Dictionary<string, Component>();
            foreach (var entry in (JObject)(test["initialVars"] ?? fixture["initialVars"]))
            {
                var definition = entry.Value;
                var variable = new Variable(entry.Key, (string)definition["name"], Value(definition["defaultValue"])) {
                    EnumId = (string)definition["enumId"]
                };
                if (test["values"]?[entry.Key] != null) variable.Value = Value(test["values"][entry.Key]);
                var scope = (string)definition["scope"];
                if (scope == null) globals.Add(variable);
                else if ((string)definition["cType"] == "components")
                {
                    if (!components.ContainsKey(scope)) components[scope] = new Component(scope);
                    components[scope].AddVariable(variable);
                }
                else
                {
                    if (!boards.ContainsKey(scope)) boards[scope] = new Board(scope, new List<INode>(), scope);
                    boards[scope].AddVariable(variable);
                }
            }
            var project = new Project.Project(boards.Values.ToList(), globals, components.Values.ToList());
            var events = new List<string>();
            var interpreter = new AwInterpreter(project, onEvent: events.Add, enums: enums,
                scopeNames: test["scopeNames"]?.Values<string>());
            var original = project.GetAllVariables().ToDictionary(variable => variable.Id, variable => variable.Value);
            var code = (string)test["code"];
            if (test["error"] != null)
            {
                Assert.Throws<ParseException>(() => interpreter.Parse(code));
                Assert.Throws<ParseException>(() => interpreter.RunScript(code));
                Assert.That(project.GetAllVariables().ToDictionary(variable => variable.Id, variable => variable.Value), Is.EquivalentTo(original));
            }
            else
            {
                interpreter.Parse(code);
                Assert.That(project.GetAllVariables().ToDictionary(variable => variable.Id, variable => variable.Value), Is.EquivalentTo(original));
                if (test["parseOnly"] == null)
                {
                    var result = interpreter.RunScript(code);
                    Assert.That(result.Output, Is.EqualTo((string)test["output"] ?? ""));
                    if (test["result"] != null) Assert.That(result.Result, Is.EqualTo(test["result"].Value<bool>()));
                    if (test["changes"] != null)
                        Assert.That(result.Changes, Is.EquivalentTo(((JObject)test["changes"]).Properties()
                            .ToDictionary(property => property.Name, property => Value(property.Value))));
                }
            }
            Assert.That(events, Is.Empty);
        }
        private static Dictionary<string, EnumDefinition> SnapshotEnums() => new Dictionary<string, EnumDefinition> {
            ["quest"] = new EnumDefinition {
                Id = "quest", Name = "QuestStatus", Type = "string",
                Members = new List<EnumMemberDefinition> {
                    new EnumMemberDefinition { Id = "inactive", Name = "Inactive", Value = "inactive" },
                    new EnumMemberDefinition { Id = "active", Name = "Active", Value = "active" }
                }
            }
        };

        [Test]
        public void ReferencesSnapshotDeclarationIdentityAndType()
        {
            var enums = SnapshotEnums();
            var variable = new Variable("status", "questStatus", "inactive") { EnumId = "quest" };
            var context = new ArcscriptContext(enums, new[] { variable });
            enums["quest"].Name = "RenamedStatus";
            enums["quest"].Type = "integer";
            enums["quest"].Members[1].Value = 1;
            variable.Name = "renamedStatus";
            variable.EnumId = "missing";

            var binding = context.Resolve("questStatus");
            Assert.That(binding.Kind, Is.EqualTo(ReferenceKind.Variable));
            Assert.That(binding.VariableId, Is.EqualTo("status"));
            Assert.That(binding.EnumId, Is.EqualTo("quest"));
            Assert.That(binding.Type, Is.EqualTo(typeof(string)));
            var member = context.Resolve("QuestStatus.Active");
            Assert.That(member.Kind, Is.EqualTo(ReferenceKind.EnumMember));
            Assert.That(member.EnumId, Is.EqualTo("quest"));
            Assert.That(member.MemberId, Is.EqualTo("active"));
            Assert.That(member.Type, Is.EqualTo(typeof(string)));
            Assert.That(member.Value, Is.EqualTo("active"));
            Assert.That(context.EnumType("quest"), Is.EqualTo(typeof(string)));
            Assert.That(context.Resolve("RenamedStatus.Active"), Is.Null);
            Assert.Throws<ParseException>(() => new ArcscriptContext(enums, new[] { variable }));
        }

        [Test]
        public void RunKeepsValidatedBindingsAndNextOperationReadsFreshDeclarations()
        {
            var enums = SnapshotEnums();
            var variable = new Variable("status", "questStatus", "inactive") { EnumId = "quest" };
            var project = new Project.Project(new List<Board>(), new List<Variable> { variable }, new List<Component>());
            var interpreter = new AwInterpreter(project, enums: enums, onEvent: _ => {
                variable.Name = "renamedStatus";
                enums["quest"].Name = "RenamedStatus";
                enums["quest"].Members[1].Name = "Started";
                enums["quest"].Members[1].Value = "started";
            });
            var result = interpreter.RunScript("<pre><code>resetVisits()</code></pre><pre><code>questStatus = QuestStatus.Active</code></pre><pre><code>reset(questStatus)</code></pre><pre><code>questStatus = QuestStatus.Active</code></pre><pre><code>show(questStatus, QuestStatus.Active)</code></pre>");
            Assert.That(result.Output, Is.EqualTo("<p>activeactive</p>"));
            Assert.That(result.Changes, Is.EquivalentTo(new Dictionary<string, object> { ["status"] = "active" }));
            Assert.Throws<ParseException>(() => interpreter.Parse("<pre><code>questStatus == QuestStatus.Active</code></pre>"));
            var next = interpreter.RunScript("<pre><code>renamedStatus = RenamedStatus.Started</code></pre><pre><code>show(renamedStatus)</code></pre>");
            Assert.That(next.Output, Is.EqualTo("<p>started</p>"));
            Assert.That(next.Changes, Is.EquivalentTo(new Dictionary<string, object> { ["status"] = "started" }));
            variable.EnumId = "missing";
            Assert.Throws<ParseException>(() => interpreter.Parse("<pre><code>true</code></pre>"));
        }
    }
}
