#pragma once
#include <any>
#include <string>
#include <vector>

namespace Arcweave {
struct EnumMemberDefinition {
  std::string id;
  std::string name;
  std::any value;
};
struct EnumDefinition {
  std::string id;
  std::string name;
  std::string type;
  std::vector<EnumMemberDefinition> members;
};
}
