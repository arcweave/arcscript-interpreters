#include <fstream>
#include <iostream>
#include <memory>
#include <limits>
#include <array>
#include <atomic>
#include <thread>
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

void currentNameLookupTests() {
  std::map<std::string, Variable> variables{
    {"a_scoped", {"a_scoped", "score", AW_INTEGER, 2, "Board", 2}},
    {"z_legacy", {"z_legacy", "Board.score", AW_INTEGER, 100, "", 100}}
  };
  ArcscriptTranspiler interpreter("", variables, {}, [](const char*) {});
  auto& state = interpreter.state;
  require(std::any_cast<int>(state.getVarValue({"score", "Board"})) == 2,
    "Dotted global name shadowed the scoped getter");
  require(std::any_cast<int>(state.getVarValue({"Board.score", ""})) == 100,
    "Host getter lost access to the legacy global declaration");
  state.variableValues.at("a_scoped").name = "renamed";
  state.variableValues.at("a_scoped").scope = "OtherBoard";
  require(state.getVar({"renamed", "OtherBoard"}).id == "a_scoped",
    "Host declaration lookup did not observe renamed metadata");
  require(state.getVar({"OtherBoard.renamed", ""}).id == "a_scoped",
    "Dotted declaration shorthand did not observe renamed metadata");
  state.setVarValue({"OtherBoard.renamed", ""}, 7);
  require(std::any_cast<int>(state.getVarValue({"renamed", "OtherBoard"})) == 7 &&
    std::any_cast<int>(state.getVarValue({"OtherBoard.renamed", ""})) == 7 &&
    std::any_cast<int>(state.getVarValueById("a_scoped")) == 7,
    "Name and ID helpers disagree after rename");
  auto result = interpreter.runScript("<pre><code>OtherBoard.renamed += 1</code></pre>");
  require(std::any_cast<int>(result.changes.at("a_scoped")) == 8 &&
    std::any_cast<int>(state.getVarValue({"renamed", "OtherBoard"})) == 8,
    "Interpreter and host helpers disagree after rename");
  bool rejected = false;
  try { state.getVarValue({"score", "Board"}); }
  catch (const std::out_of_range&) { rejected = true; }
  require(rejected && state.variableValues.size() == 2 && state.variableChanges.size() == 1,
    "Unknown names should fail without inserting variables");
  for (auto identifier : {IdentifierDef{"OtherBoard.missing", ""}, IdentifierDef{".Board.score", ""},
      IdentifierDef{"OtherBoard.renamed", "Board"}}) {
    rejected = false;
    try { state.setVarValue(identifier, 999); }
    catch (const std::out_of_range&) { rejected = true; }
    require(rejected && state.variableValues.size() == 2 && state.variableChanges.size() == 1,
      "Invalid shorthand should fail without changing state");
  }
}

template<typename Error>
void checkExceptionMessage() {
  Error located("message", 3, 2);
  const char* text = located.what();
  require(std::string(text) == "line 3:2 message", "Located error has incorrect formatting");
  require(located.what() == text, "Repeated what() calls must reuse the owned message");
  Error copy = located;
  require(std::string(copy.what()) == text, "Copied exception lost its message");
  Error plain("message");
  require(std::string(plain.what()) == "message", "Location-free error changed formatting");
  plain.line = 3;
  plain.charPositionInLine = 2;
  require(std::string(plain.what()) == "line 3:2 message", "Adding a location lost the error message");
  located.message = "edited";
  require(std::string(located.what()) == "line 3:2 edited", "Edited message was not reflected");
  located.line = 4;
  require(std::string(located.what()) == "line 4:2 edited", "Edited line was not reflected");
  located.charPositionInLine = 9;
  require(std::string(located.what()) == "line 4:9 edited", "Edited column was not reflected");
  text = located.what();
  require(located.what() == text, "Unchanged fields should reuse the refreshed message");
  require(std::string(copy.what()) == "line 3:2 message", "Editing an exception changed its copy");
  located.line = 0;
  require(std::string(located.what()) == "edited", "Removing a location retained its prefix");
  located.message = "a longer message whose formatting requires an allocation";
  located.line = 5;
  Error changedCopy = located;
  Error moved = std::move(changedCopy);
  require(std::string(moved.what()) == "line 5:9 " + located.message,
    "Copying and moving after field edits retained stale formatting");
  Error assigned("old", 1, 1);
  assigned.what();
  assigned = moved;
  require(std::string(assigned.what()) == moved.what(), "Copy assignment retained the destination's old message");
  Error moveAssigned("old", 1, 1);
  moveAssigned.what();
  moveAssigned = std::move(assigned);
  require(std::string(moveAssigned.what()) == moved.what(), "Move assignment retained the destination's old message");
}

template<typename Error>
void checkConcurrentExceptionMessage() {
  for (int iteration = 0; iteration < 32; ++iteration) {
    Error error(std::string(10000, 'x'), 3, 2);
    // Share the object directly: rethrow_exception may copy it on some runtimes.
    const std::exception& diagnostic = error;
    for (bool edited : {false, true}) {
      const std::string message(10000, edited ? 'y' : 'x');
      const std::string expected = (edited ? "line 9:4 " : "line 3:2 ") + message;
      if (edited) {
        error.message = message;
        error.line = 9;
        error.charPositionInLine = 4;
      }
      std::atomic<int> ready{0};
      std::atomic<bool> go{false};
      std::array<const char*, 8> pointers{};
      std::array<bool, 8> correct{};
      std::vector<std::thread> threads;
      for (std::size_t index = 0; index < pointers.size(); ++index) {
        threads.emplace_back([&, index] {
          ++ready;
          while (!go.load()) std::this_thread::yield();
          pointers[index] = diagnostic.what();
          correct[index] = std::string(pointers[index]) == expected;
          for (int read = 0; read < 10; ++read)
            correct[index] = correct[index] && diagnostic.what() == pointers[index] && std::string(diagnostic.what()) == expected;
          Error copy = error;
          correct[index] = correct[index] && std::string(copy.what()) == expected;
        });
      }
      while (ready.load() != static_cast<int>(pointers.size())) std::this_thread::yield();
      go = true;
      for (auto& thread : threads) thread.join();
      for (std::size_t index = 0; index < pointers.size(); ++index)
        require(correct[index] && pointers[index] == pointers[0],
          "Concurrent exception reads must share one stable, current message");
    }
  }
}

void exceptionMessageTests() {
  checkExceptionMessage<ParseErrorException>();
  checkExceptionMessage<RuntimeErrorException>();
  checkConcurrentExceptionMessage<ParseErrorException>();
  checkConcurrentExceptionMessage<RuntimeErrorException>();
}

void bridgeEnumReferenceTests() {
  UVariable variable{};
  variable.id = "score";
  variable.name = "score";
  variable.type = AW_INTEGER;
  variable.int_val = variable.default_int_val = 1;
  variable.has_default_value = true;
  const char* code = "<pre><code>score = 999</code></pre>";
  for (bool withDefinitions : {false, true}) {
    std::map<std::string, EnumDefinition> enums;
    if (withDefinitions) enums["rank"] = {"rank", "Rank", "integer", {{"one", "One", 1}}};
    auto result = runScriptWithEnumsExport(code, "", &variable, 1, nullptr, 0,
      [](const char*) {}, enums, {});
    bool accepted = result->changesLen == 1 && result->changes[0].int_result == 999;
    deallocateOutput(result);
    require(accepted, "Absent bridge enum reference changed primitive assignment");
    bool rejected = false;
    try {
      auto invalid = runScriptWithEnumsExport(code, "", &variable, 1, nullptr, 0,
        [](const char*) {}, enums, {{"score", ""}});
      deallocateOutput(invalid);
    }
    catch (const ParseErrorException&) { rejected = true; }
    require(rejected, "Explicit empty bridge enum reference was accepted");
  }
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
        if (definition.contains("enumId") && !definition["enumId"].is_null())
          variable.enumId = definition["enumId"].get<std::string>();
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
      catch (const ParseErrorException& error) {
        rejected = true;
        if (test.contains("errorContains"))
          require(error.message.find(test["errorContains"].get<std::string>()) != std::string::npos,
            "Unexpected validation error: " + error.message);
        if (test.contains("errorLocation"))
          require(error.line == test["errorLocation"]["line"] && error.charPositionInLine == test["errorLocation"]["col"],
            "Validation error did not identify the offending code block and column");
      }
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
        if (variable.enumId) references[id] = *variable.enumId;
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
  const auto additionalTests = {declarationContextTests, declarationLifecycleTests,
    currentNameLookupTests, bridgeEnumReferenceTests, exceptionMessageTests};
  for (auto test : additionalTests) {
    try { test(); }
    catch (const std::exception& error) {
      ++failures;
      std::cerr << "Native regression: " << error.what() << '\n';
    }
  }
  std::cout << fixture["cases"].size() << " enum cases and " << additionalTests.size() << " native regressions, " << failures << " failures\n";
  return failures ? 1 : 0;
}
