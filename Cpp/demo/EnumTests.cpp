#include <fstream>
#include <iostream>
#include <memory>
#include <limits>
#include <nlohmann/json.hpp>
#include "ArcscriptTranspiler.h"
#include "ArcscriptContext.h"

using namespace Arcweave;
using json = nlohmann::json;

std::any primitive(const json& value) {
  if (value.is_string()) return value.get<std::string>();
  if (value.is_boolean()) return value.get<bool>();
  if (value.is_number_integer()) {
    auto number = value.get<long long>();
    if (number >= std::numeric_limits<int>::min() && number <= std::numeric_limits<int>::max()) return static_cast<int>(number);
    return number;
  }
  return value.get<double>();
}
json primitiveJson(const std::any& value) {
  if (value.type() == typeid(std::string)) return std::any_cast<std::string>(value);
  if (value.type() == typeid(bool)) return std::any_cast<bool>(value);
  if (value.type() == typeid(int)) return std::any_cast<int>(value);
  if (value.type() == typeid(double)) return std::any_cast<double>(value);
  throw std::runtime_error("Expected a primitive runtime value");
}
void require(bool condition, const std::string& message) {
  if (!condition) throw std::runtime_error(message);
}

void declarationContextTests() {
  std::map<std::string, EnumDefinition> enums{{"quest", {"quest", "QuestStatus", "string", {
    {"inactive", "Inactive", std::string("inactive")}, {"active", "Active", std::string("active")}
  }}}};
  std::map<std::string, Variable> variables{{"status", {
    "status", "questStatus", AW_STRING, std::string("inactive"), "", std::string("inactive"), "quest"
  }}};
  const ArcscriptContext context(enums, variables);
  enums.at("quest").name = "RenamedStatus";
  enums.at("quest").type = "integer";
  enums.at("quest").members[1].value = 1;
  variables.at("status").name = "renamedStatus";
  variables.at("status").enumId = "missing";
  auto binding = context.resolve("questStatus");
  require(binding && binding->kind == ReferenceKind::Variable && binding->variableId == "status" &&
    binding->enumId == "quest" && binding->type == AW_STRING, "Variable binding lost its identity");
  auto member = context.resolve("QuestStatus.Active");
  require(member && member->kind == ReferenceKind::EnumMember && member->enumId == "quest" &&
    member->memberId == "active" && member->type == AW_STRING && primitiveJson(member->value) == "active",
    "Enum member binding lost its identity or value");
  require(context.enumType("quest") == AW_STRING && !context.resolve("RenamedStatus.Active"),
    "Context observed changes to source declarations");
  bool rejected = false;
  try { ArcscriptContext changed(enums, variables); }
  catch (const ParseErrorException&) { rejected = true; }
  require(rejected, "New context did not validate changed declarations");
}

void declarationLifecycleTests() {
  std::map<std::string, EnumDefinition> enums{{"quest", {"quest", "QuestStatus", "string", {
    {"inactive", "Inactive", std::string("inactive")}, {"active", "Active", std::string("active")}
  }}}};
  std::map<std::string, Variable> variables{{"status", {
    "status", "questStatus", AW_STRING, std::string("inactive"), "", std::string("inactive"), "quest"
  }}};
  ArcscriptTranspiler* active = nullptr;
  ArcscriptTranspiler interpreter("", variables, {}, [&](const char*) {
    active->state.variableValues.at("status").name = "renamedStatus";
  }, enums);
  active = &interpreter;
  auto result = interpreter.runScript("<pre><code>resetVisits()</code></pre><pre><code>questStatus = QuestStatus.Active</code></pre><pre><code>reset(questStatus)</code></pre><pre><code>questStatus = QuestStatus.Active</code></pre><pre><code>show(questStatus, QuestStatus.Active)</code></pre>");
  require(result.output == "<p>activeactive</p>" && result.changes.size() == 1 &&
    primitiveJson(result.changes.at("status")) == "active", "Run did not keep its validated bindings");
  bool rejected = false;
  try { interpreter.validate("<pre><code>questStatus == QuestStatus.Active</code></pre>"); }
  catch (const ParseErrorException&) { rejected = true; }
  require(rejected, "Next operation did not read renamed variables");
  auto next = interpreter.runScript("<pre><code>renamedStatus = QuestStatus.Inactive</code></pre>");
  require(primitiveJson(next.changes.at("status")) == "inactive", "Renamed variable did not resolve by ID");
  interpreter.state.variableValues.at("status").enumId = "missing";
  rejected = false;
  try { interpreter.validate("<pre><code>true</code></pre>"); }
  catch (const ParseErrorException&) { rejected = true; }
  require(rejected, "Next operation did not validate updated enum references");
}

int main(int argc, char* argv[]) {
  if (argc != 2) return 1;
  std::ifstream input(argv[1]);
  json fixture;
  input >> fixture;
  int failures = 0;
  for (const auto& test : fixture["cases"]) {
    try {
      auto definitions = test.value("enums", fixture["enums"]);
      std::map<std::string, EnumDefinition> enums;
      for (auto it = definitions.begin(); it != definitions.end(); ++it) {
        const auto& definition = it.value();
        EnumDefinition result{definition["id"], definition["name"], definition["type"], {}};
        for (const auto& member : definition["members"])
          result.members.push_back({member["id"], member["name"], primitive(member["value"])});
        enums[it.key()] = result;
      }
      std::map<std::string, Variable> variables;
      auto initialVars = test.value("initialVars", fixture["initialVars"]);
      for (auto it = initialVars.begin(); it != initialVars.end(); ++it) {
        const auto& definition = it.value();
        Variable variable;
        variable.id = it.key();
        variable.name = definition["name"];
        variable.type = definition["type"] == "string" ? AW_STRING : AW_INTEGER;
        variable.defaultValue = primitive(definition["defaultValue"]);
        variable.value = test.contains("values") && test["values"].contains(it.key())
          ? primitive(test["values"][it.key()]) : variable.defaultValue;
        variable.scope = definition.value("scope", "");
        variable.enumId = definition.value("enumId", "");
        variables[it.key()] = variable;
      }
      int events = 0;
      std::unique_ptr<ArcscriptTranspiler> interpreter;
      std::string code = test["code"];
      bool rejected = false;
      try {
        interpreter = std::make_unique<ArcscriptTranspiler>("", variables, std::map<std::string, int>{},
          [&](const char*) { ++events; }, enums, test.value("scopeNames", std::vector<std::string>{}));
        interpreter->validate(code);
      }
      catch (const ParseErrorException&) { rejected = true; }
      require(rejected == test.contains("error"), "Unexpected validation result");
      require((!interpreter || interpreter->state.variableChanges.empty()) && events == 0, "Validation executed script");
      if (rejected) {
        if (!interpreter) continue;
        bool runRejected = false;
        try { interpreter->runScript(code); }
        catch (const ParseErrorException&) { runRejected = true; }
        require(runRejected && interpreter->state.variableChanges.empty() && events == 0, "Invalid script executed");
        continue;
      }
      if (test.value("parseOnly", false)) continue;
      auto result = interpreter->runScript(code);
      require(result.output == test.value("output", ""), "Output mismatch: " + result.output);
      if (test.contains("result")) require(primitiveJson(result.result) == test["result"], "Condition mismatch");
      if (test.contains("changes")) {
        json changes = json::object();
        for (const auto& [id, value] : result.changes) changes[id] = primitiveJson(value);
        require(changes == test["changes"], "Changes mismatch: " + changes.dump());
      }
      require(events == 0, "Unexpected event");

      // The exported bridge must preserve the same metadata and primitive results.
      std::vector<UVariable> bridgeVariables;
      std::map<std::string, std::string> references;
      for (const auto& [id, variable] : variables) {
        UVariable bridge;
        bridge.id = id.c_str();
        bridge.name = variable.name.c_str();
        bridge.scope = variable.scope.empty() ? nullptr : variable.scope.c_str();
        bridge.type = variable.type;
        bridge.has_default_value = true;
        if (variable.type == AW_STRING) {
          bridge.string_val = std::any_cast<const std::string&>(variable.value).c_str();
          bridge.default_string_val = std::any_cast<const std::string&>(variable.defaultValue).c_str();
        } else {
          bridge.int_val = std::any_cast<int>(variable.value);
          bridge.default_int_val = std::any_cast<int>(variable.defaultValue);
        }
        bridgeVariables.push_back(bridge);
        if (!variable.enumId.empty()) references[id] = variable.enumId;
      }
      auto bridge = runScriptWithEnumsExport(code.c_str(), "", bridgeVariables.data(), bridgeVariables.size(), nullptr, 0,
        [&](const char*) { ++events; }, enums, references);
      std::string output = bridge->output;
      json changes = json::object();
      for (size_t i = 0; i < bridge->changesLen; ++i) {
        const auto& change = bridge->changes[i];
        if (change.type == AW_STRING) changes[change.varId] = change.string_result;
        else if (change.type == AW_INTEGER) changes[change.varId] = change.int_result;
        else if (change.type == AW_DOUBLE) changes[change.varId] = change.double_result;
        else if (change.type == AW_BOOLEAN) changes[change.varId] = change.bool_result;
      }
      bool condition = bridge->conditionResult;
      deallocateOutput(bridge);
      require(output == result.output, "Bridge output mismatch");
      if (test.contains("changes")) require(changes == test["changes"], "Bridge changes mismatch");
      if (test.contains("result")) require(condition == test["result"], "Bridge condition mismatch");
    } catch (const std::exception& error) {
      ++failures;
      std::cerr << test["name"] << ": " << error.what() << '\n';
    }
  }
  for (auto test : {declarationContextTests, declarationLifecycleTests}) {
    try { test(); }
    catch (const std::exception& error) {
      ++failures;
      std::cerr << "Declaration context: " << error.what() << '\n';
    }
  }
  std::cout << fixture["cases"].size() << " enum cases and 2 context tests, " << failures << " failures\n";
  return failures ? 1 : 0;
}
