#pragma once

#include <iostream>
#include <any>
#include <string>

namespace Arcweave {

class Expression {
private:
  struct NumberValues {
    double value1;
    double value2;
    bool hasDoubles = false;
  };

  static NumberValues doubleValues(std::any value1, std::any value2) ;

  static std::string valueToString(std::any value);
  static bool valueToBool(std::any value);
public:
  std::any value;
  Expression() {
    value = std::any();
  }
  Expression(std::string _value) {
    value = _value;
  }
  Expression(bool _value) {
    value = _value;
  }
  Expression(int _value) {
    value = _value;
  }
  Expression(double _value) {
    value = _value;
  }
  Expression(const Expression &e) {
    value = e.value;
  }

  void setValue(std::any _value) {
    value = _value;
  }

  const std::type_info& type() {
    return value.type();
  }

  Expression operator+ (const Expression &other) const;
  Expression operator- (const Expression &other) const;
  Expression operator* (const Expression &other) const;
  Expression operator* (const int other) const;
  Expression operator/ (const Expression &other) const;
  Expression operator% (const Expression &other) const;
  Expression operator+= (const Expression &other);
  Expression operator-= (const Expression &other);
  Expression operator*= (const Expression &other);
  Expression operator/= (const Expression &other);
  Expression operator%= (const Expression &other);

  bool operator== (const Expression &other) const;
  bool operator== (double other) const;
  bool operator== (int other) const;
  bool operator== (const std::string& other) const;
  bool operator== (bool other) const;
  bool operator!= (const Expression &other) const;
  bool operator!= (double other) const;
  bool operator!= (int other) const;
  bool operator!= (const std::string& other) const;
  bool operator!= (const char other[]) const;
  bool operator> (const Expression &other) const;
  bool operator> (int other) const;
  bool operator> (double other) const;
  bool operator>= (const Expression &other) const;
  bool operator< (const Expression &other) const;
  bool operator<= (const Expression &other) const;
  bool operator! () const;
  bool operator&& (const Expression &other) const;
  bool operator|| (const Expression &other) const;
};

}
std::ostream& operator<< (std::ostream& out, const Arcweave::Expression &e);
