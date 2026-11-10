#pragma once

#include <any>
#include <string>
#include <map>
#include <vector>
#include <set>
#include <functional>

#include "ArcscriptOutputs.h"
#include "ArcscriptErrorExceptions.h"

namespace Arcweave {

enum VariableType {
    AW_STRING,
    AW_INTEGER,
    AW_DOUBLE,
    AW_BOOLEAN,
    AW_ANY
};

  struct IdentifierDef {
    std::string name;
    std::string scope;
  };

struct Variable {
  std::string id;
  std::string name;
  VariableType type;
  std::any value;
  std::string scope;
  std::any defaultValue;
  std::string enumId;
};

class ArcscriptState {
public:
  std::map<std::string, std::any> variableChanges;
  std::map<std::string, Variable> variableValues;
  std::map<std::string, std::string> varNameToID;
  ArcscriptOutputs outputs;
  std::string currentElement;
  std::map<std::string, int> visits;

  std::function<void(const char*)> emit;

  ArcscriptState(std::string elementId, std::map<std::string, Variable> varValues, std::map<std::string, int> _visits, std::function<void(const char*)> _emit) {
    currentElement = std::move(elementId);
    variableValues = std::move(varValues);
    for(const auto&[varId, variable] : variableValues) {
      if (!variable.value.has_value()) {
        throw RuntimeErrorException(
          "Variable " + variable.id + " is missing a current value."
        );
      }
      if (!variable.defaultValue.has_value()) {
        throw RuntimeErrorException(
          "Variable " + variable.id + " is missing a default value."
        );
      }
      std::string name = variable.name;
      if (variable.scope != "") {
        name = variable.scope + "." + variable.name;
      }
      varNameToID[name] = varId;
    }
    visits = std::move(_visits);
    emit = _emit;
  }

  inline static std::string getVarFullName(IdentifierDef identifier) {
    if (identifier.scope != "") {
      return identifier.scope + "." + identifier.name;
    }
    return identifier.name;
  }

  inline std::any getVarValue(IdentifierDef identifier) {
    return getVarValueById(varNameToID.at(getVarFullName(identifier)));
  }

  inline Variable getVar(IdentifierDef identifier) {
    return getVarById(varNameToID.at(getVarFullName(identifier)));
  }

  inline void setVarValue(IdentifierDef identifier, std::any value) {
    setVarValueById(varNameToID.at(getVarFullName(identifier)), std::move(value));
  }

  inline std::any getVarValueById(const std::string& id) const {
    auto change = variableChanges.find(id);
    return change != variableChanges.end() ? change->second : variableValues.at(id).value;
  }

  inline const Variable& getVarById(const std::string& id) const {
    return variableValues.at(id);
  }

  inline void setVarValueById(const std::string& id, std::any value) {
    variableValues.at(id);
    variableChanges[id] = std::move(value);
  }

  inline void resetVars(std::vector<Variable> vars) {
    for (Variable var : vars) {
      variableChanges[var.id] = var.defaultValue;
    }
  }

  inline void resetAllVars(std::vector<Variable> except) {
    std::set<std::string> exceptVariableIds;
    for (Variable var : except) {
      exceptVariableIds.insert(var.id);
    }
    std::map<std::string, Variable>::iterator it = variableValues.begin();
    while (it != variableValues.end())
    {
      if (exceptVariableIds.find(it->first) == exceptVariableIds.end()) { // not in except vars
        variableChanges[it->first] = it->second.defaultValue;
      }
      it++;
    }
  }

  inline void resetVisits() {
    for (auto visit: visits) {
      visits[visit.first] = 0;
    }
    emit("resetVisits");
  }
};

class Mention {
public:
  std::string label;
  std::map<std::string, std::string> attrs;
  Mention(std::string _label, std::map<std::string, std::string> _attrs) {
    label = _label;
    attrs = _attrs;
  }
  Mention(const Mention &m) {
    label = m.label;
    attrs = m.attrs;
  }
};
}
