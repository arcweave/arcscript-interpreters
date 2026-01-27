#include "ArcscriptExpression.h"
#include <sstream>
#include <cstring>

#include "ArcscriptErrorExceptions.h"

namespace Arcweave {

std::string Expression::valueToString(std::any value)
{
  if (value.type() == typeid(std::string))
  {
    return std::any_cast<std::string>(value);
  }
  if (value.type() == typeid(bool))
  {
    return std::any_cast<bool>(value) ? "true" : "false";
  }
  if (value.type() == typeid(int))
  {
    return std::to_string(std::any_cast<int>(value));
  }
  if (value.type() == typeid(double))
  {
    std::stringstream ss;
    ss << std::any_cast<double>(value);
    return ss.str();
  }

  return NULL;
}

  
Expression::NumberValues Expression::doubleValues(std::any value1, std::any value2) {
  double dblValue1 = 0, dblValue2 = 0;
  bool isDouble = false;
  if (value1.type() == typeid(int)) {
    const int intValue1 = std::any_cast<int>(value1);
    dblValue1 = intValue1;
  } else if (value1.type() == typeid(double)){ // type double;
    isDouble = true;
    dblValue1 = std::any_cast<double>(value1); 
  } else if (value1.type() == typeid(bool)) {
    bool boolVal = std::any_cast<bool>(value1);
    if (boolVal) {
      dblValue1 = 1;
    } else {
      dblValue1 = 0;
    }
  }
  if (value2.type() == typeid(int)) {
    const int intValue2 = std::any_cast<int>(value2);
    dblValue2 = intValue2;
  } else if (value2.type() == typeid(double)) {
    isDouble = true;
    dblValue2 = std::any_cast<double>(value2);
  } else if (value2.type() == typeid(bool)) {
    bool boolVal = std::any_cast<bool>(value1);
    if (boolVal) {
      dblValue2 = 1;
    } else {
      dblValue2 = 0;
    }
  }
  NumberValues returnVal;
  returnVal.value1 = dblValue1;
  returnVal.value2 = dblValue2;
  returnVal.hasDoubles = isDouble;
  return returnVal;
}

bool Expression::valueToBool(std::any value) {
  if (value.type() == typeid(int))  {
    return (std::any_cast<int>(value) > 0);
  }
  if (value.type() == typeid(double))  {
    return (std::any_cast<double>(value) > 0);
  }
  if (value.type() == typeid(std::string))  {
    return (!std::any_cast<std::string>(value).empty());
  }
  return (std::any_cast<bool>(value));
}

Expression Expression::operator+ (const Expression &other) const {
  if (value.type() == typeid(std::string) || other.value.type() == typeid(std::string))
  {
    return {valueToString(value) + valueToString(other.value)};
  }
  NumberValues values = doubleValues(value, other.value);
  Expression* result;
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 + values.value2);
    result  = new Expression(intValue);
  } else {
    result = new Expression(values.value1 + values.value2);
  }
  return *result;
}

Expression Expression::operator- (const Expression &other) const {
  if (value.type() == typeid(std::string) || other.value.type() == typeid(std::string)) {
    throw RuntimeErrorException("Cannot subtract strings");
  }
  NumberValues values = doubleValues(value, other.value);
  Expression* result;
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 - values.value2);
    result  = new Expression(intValue);
  } else {
    result = new Expression(values.value1 - values.value2);
  }
  return *result;
}

Expression Expression::operator* (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  Expression* result;
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 * values.value2);
    result  = new Expression(intValue);
  } else {
    result = new Expression(values.value1 * values.value2);
  }
  return *result;
}

Expression Expression::operator* (const int other) const {
  NumberValues values = doubleValues(value, other);
  Expression* result;
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 * values.value2);
    result  = new Expression(intValue);
  } else {
    result = new Expression(values.value1 * values.value2);
  }
  return *result;
}

Expression Expression::operator/ (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  Expression* result;

  if (values.value2 == 0) {
    throw RuntimeErrorException("Division by zero is not allowed.");
  }

  result = new Expression(values.value1 / values.value2);

  return *result;
}

Expression Expression::operator% (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  Expression* result;

  if (values.value2 == 0) {
    throw RuntimeErrorException("Modulo by zero is not allowed.");
  }

  if (!values.hasDoubles) {
    int intValue = static_cast<int>(static_cast<int>(values.value1) % static_cast<int>(values.value2));
    result  = new Expression(intValue);
  } else {
    double modValue = std::fmod(values.value1, values.value2);
    result = new Expression(modValue);
  }
  return *result;
}

Expression Expression::operator+= (const Expression &other) {
  if (value.type() == typeid(std::string) || other.value.type() == typeid(std::string)) {
    auto val1 = valueToString(value);
    auto val2 = valueToString(other.value);
    if (val1.empty() && val2.empty()) {
      value = std::string();
    } else if (val1.empty()) {
      value = val2;
    } else if (val2.empty()) {
      value = val1;
    } else {
      value = val1 + val2;
    }
    return *this;
  }

  NumberValues values = doubleValues(value, other.value);
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 + values.value2);
    value = intValue;
  } else {
    value = values.value1 + values.value2;
  }

  return *this;
}

Expression Expression::operator-= (const Expression &other) {
  if (value.type() == typeid(std::string) || other.value.type() == typeid(std::string)) {
    throw RuntimeErrorException("Cannot subtract strings");
  }
  NumberValues values = doubleValues(value, other.value);
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 - values.value2);
    value = intValue;
  } else {
    value = values.value1 - values.value2;
  }
  return *this;
}

Expression Expression::operator*= (const Expression &other) {
  NumberValues values = doubleValues(value, other.value);
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 * values.value2);
    value = intValue;
  } else {
    value = values.value1 * values.value2;
  }
  return *this;
}

Expression Expression::operator/= (const Expression &other) {
  NumberValues values = doubleValues(value, other.value);
  if (values.value2 == 0) {
    throw RuntimeErrorException("Division by zero is not allowed.");
  }
  if (!values.hasDoubles) {
    int intValue = static_cast<int>(values.value1 / values.value2);
    value = intValue;
  } else {
    value = values.value1 / values.value2;
  }
  return *this;
}

Expression Expression::operator%= (const Expression &other) {
  NumberValues values = doubleValues(value, other.value);

  if (values.value2 == 0) {
    throw RuntimeErrorException("Modulo by zero is not allowed.");
  }

  if (!values.hasDoubles) {
    int intValue = static_cast<int>(static_cast<int>(values.value1) % static_cast<int>(values.value2));
    value  = new Expression(intValue);
  } else {
    double modValue = std::fmod(values.value1, values.value2);
    value = new Expression(modValue);
  }
  return *this;
}

bool Expression::operator== (const Expression &other) const {
  if (value.type() == typeid(int) || value.type() == typeid(double)) {
    NumberValues values = doubleValues(value, other.value);
    return values.value1 == values.value2;
  }
  if (value.type() == typeid(bool)) {
    return std::any_cast<bool>(value) == std::any_cast<bool>(other.value);
  }
  return std::any_cast<std::string>(value) == std::any_cast<std::string>(other.value);
}

bool Expression::operator== (double other) const {
  NumberValues values = doubleValues(value, other);
  return values.value1 == values.value2;
}

bool Expression::operator== (int other) const {
  NumberValues values = doubleValues(value, other);
  return values.value1 == values.value2;
}

bool Expression::operator== (const std::string& other) const {
  return std::any_cast<std::string>(value) == other;
}

bool Expression::operator== (const bool other) const {
  return valueToBool(value) == other;
}

bool Expression::operator!= (const Expression &other) const {
  if (value.type() == typeid(std::string) || other.value.type() == typeid(std::string)) {
    if (value.type() != other.value.type()) {
      return true; // Different types cannot be equal
    } else {
      return std::any_cast<std::string>(value) != std::any_cast<std::string>(other.value);
    }
  }
  if (value.type() == typeid(int) || value.type() == typeid(double)) {
    NumberValues values = doubleValues(value, other.value);
    return values.value1 != values.value2;
  }
  if (value.type() == typeid(bool)) {
    return std::any_cast<bool>(value) != std::any_cast<bool>(other.value);
  }
  return std::any_cast<std::string>(value) != std::any_cast<std::string>(other.value);
}

bool Expression::operator!= (double other) const {
  NumberValues values = doubleValues(value, other);
  return values.value1 != values.value2;
}

bool Expression::operator!= (int other) const {
  NumberValues values = doubleValues(value, other);
  return values.value1 != values.value2;
}

bool Expression::operator!= (const std::string& other) const {
  return std::any_cast<std::string>(value) != other;
}

bool Expression::operator!= (const char other[]) const {
  return strcmp(std::any_cast<std::string>(value).c_str(), other) == 0;
}

bool Expression::operator> (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  return values.value1 > values.value2;
}

bool Expression::operator> (int other) const {
  NumberValues values = doubleValues(value, other);
  return values.value1 > values.value2;
}

bool Expression::operator> (double other) const {
  NumberValues values = doubleValues(value, other);
  return values.value1 > values.value2;
}

bool Expression::operator>= (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  return values.value1 >= values.value2;
}

bool Expression::operator< (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  return values.value1 < values.value2;
}

bool Expression::operator<= (const Expression &other) const {
  NumberValues values = doubleValues(value, other.value);
  return values.value1 <= values.value2;
}

bool Expression::operator! () const {
  return !(valueToBool(value));
}

bool Expression::operator&& (const Expression &other) const {
  return valueToBool(value) && valueToBool(other.value);
}

bool Expression::operator|| (const Expression &other) const {
  return valueToBool(value) || valueToBool(other.value);
}
}

std::ostream& operator<< (std::ostream& out, const Arcweave::Expression &e) {
  std::any value = e.value;
  if (value.type() == typeid(int)) {
    return out << std::any_cast<int>(value);
  }
  if (value.type() == typeid(double)) {
    return out << std::any_cast<double>(value);
  }
  if (value.type() == typeid(std::string)) {
    return out << std::any_cast<std::string>(value);
  }
  if (value.type() == typeid(bool)) {
    return out << std::any_cast<bool>(value);
  }
  return out;
}
