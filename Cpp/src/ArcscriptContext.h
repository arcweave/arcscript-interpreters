#pragma once
#include "ArcscriptHelpers.h"

namespace Arcweave {
enum class ReferenceKind { Variable };

struct ArcscriptReference {
  ReferenceKind kind;
  VariableType type;
  std::string variableId;
};

// A snapshot of declarations, shared by parsing and execution.
class ArcscriptContext {
  std::map<std::string, ArcscriptReference> references;
public:
  explicit ArcscriptContext(const std::map<std::string, Variable>& variables = {}) {
    for (const auto& [id, variable] : variables) {
      auto name = variable.scope.empty() ? variable.name : variable.scope + "." + variable.name;
      // Match the existing native name map's last-match behavior.
      references[name] = {ReferenceKind::Variable, variable.type, id};
    }
  }

  const ArcscriptReference* resolve(const std::string& name) const {
    auto reference = references.find(name);
    return reference == references.end() ? nullptr : &reference->second;
  }
};
}
