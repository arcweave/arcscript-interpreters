#pragma once
#include "ArcscriptEnums.h"
#include "ArcscriptHelpers.h"
#include <regex>
#include <sstream>

namespace Arcweave {
enum class ReferenceKind { Variable, EnumMember };

struct ArcscriptReference {
  ReferenceKind kind;
  VariableType type;
  std::string variableId;
  std::string enumId;
  std::string memberId;
  std::any value;
};

// A validated snapshot of declarations, shared by parsing and execution.
class ArcscriptContext {
  std::map<std::pair<std::string, std::string>, ArcscriptReference> references;
  std::map<std::string, VariableType> enumTypes;
  static void assertName(const std::string& name) {
    static const std::set<std::string> reserved = [] {
      std::istringstream input("abs max min random roll round sqr sqrt visits show resetVisits reset resetAll if else elseif endif and or is not true false abstract as assert async auto await base bool break byte case catch char checked class const constexpr const_cast continue decimal default delegate delete do double dynamic elif enum event explicit export extends extern false final finally fixed float for foreach friend from func get global goto if implicit import in inline int interface internal is lock long match mutable namespace native new noexcept not not_eq null nullptr object operator or or_eq out override params pass private protected public readonly ref register reinterpret_cast return sbyte sealed set short signal signed sizeof stackalloc static static_assert static_cast string struct super switch template this thread_local throw throws trait try typedef typeid typename typeof uint ulong unchecked union unsafe unsigned using ushort var virtual void volatile wchar_t when where while with yield alignas alignof and_eq asm bitand bitor char8_t char16_t char32_t compl concept co_await co_return co_yield consteval constinit decltype dynamic_cast requires xor xor_eq class_name breakpoint preload self PI TAU INF NAN tool onready setget remote master puppet remotesync mastersync puppetsync");
      std::set<std::string> result;
      for (std::string word; input >> word;) result.insert(word);
      return result;
    }();
    static const std::regex identifierPattern("[A-Za-z][A-Za-z0-9_]*");
    if (!std::regex_match(name, identifierPattern) || name.find("__") != std::string::npos || reserved.count(name))
      throw ParseErrorException("Invalid or reserved enum identifier " + name);
  }
public:
  explicit ArcscriptContext(const std::map<std::string, EnumDefinition>& definitions = {},
      const std::map<std::string, Variable>& variables = {}, const std::vector<std::string>& scopeNames = {}) {
    std::set<std::string> scopes(scopeNames.begin(), scopeNames.end());
    for (const auto& [id, variable] : variables)
      if (!variable.scope.empty()) scopes.insert(variable.scope);
    std::set<std::string> names;
    for (const auto& [id, definition] : definitions) {
      assertName(definition.name);
      if (id.empty() || id != definition.id || !names.insert(definition.name).second)
        throw ParseErrorException("Enum IDs and names must be unique and match their keys");
      if ((definition.type != "string" && definition.type != "integer") || definition.members.empty())
        throw ParseErrorException("Enum " + definition.name + " must have string or integer members");
      if (scopes.count(definition.name))
        throw ParseErrorException("Enum " + definition.name + " conflicts with a variable scope");
      auto type = definition.type == "string" ? AW_STRING : AW_INTEGER;
      enumTypes[id] = type;
      std::set<std::string> memberIds, memberNames, strings;
      std::set<int> integers;
      for (const auto& member : definition.members) {
        assertName(member.name);
        if (member.id.empty() || !memberIds.insert(member.id).second || !memberNames.insert(member.name).second)
          throw ParseErrorException("Enum " + definition.name + " has duplicate or missing members");
        if ((definition.type == "string" && member.value.type() != typeid(std::string)) ||
            (definition.type == "integer" && member.value.type() != typeid(int)))
          throw ParseErrorException("Invalid backing value for " + definition.name + "." + member.name);
        bool unique = definition.type == "string"
          ? strings.insert(std::any_cast<std::string>(member.value)).second
          : integers.insert(std::any_cast<int>(member.value)).second;
        if (!unique) throw ParseErrorException("Enum " + definition.name + " has duplicate backing values");
        references[{definition.name, member.name}] = {ReferenceKind::EnumMember, type, "", id, member.id, member.value};
      }
    }
    for (const auto& [id, variable] : variables) {
      if (variable.enumId) {
        auto type = enumTypes.find(*variable.enumId);
        if (type == enumTypes.end() || type->second != variable.type)
          throw ParseErrorException("Invalid enum reference for variable " + variable.name);
      }
      // Match the existing native name map's last-match behavior.
      references[{variable.scope, variable.name}] = {ReferenceKind::Variable, variable.type, id, variable.enumId.value_or(""), "", {}};
    }
  }

  const ArcscriptReference* resolve(const std::string& name) const {
    auto dot = name.find('.');
    auto key = dot == std::string::npos ? std::make_pair(std::string{}, name)
      : std::make_pair(name.substr(0, dot), name.substr(dot + 1));
    auto reference = references.find(key);
    return reference == references.end() ? nullptr : &reference->second;
  }

  bool hasEnums() const { return !enumTypes.empty(); }
  VariableType enumType(const std::string& id) const { return enumTypes.at(id); }
};
}
