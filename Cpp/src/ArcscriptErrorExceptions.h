#pragma once

#include <iostream>
#include <string>
#include <string.h>
#include <sstream>
#include <exception>

#ifdef _WIN64
#define strdup _strdup
#endif

namespace Arcweave {
  class RuntimeErrorException : public std::exception {
    std::string formattedMessage;
    public:
    std::string message;
    size_t line = 0;
    size_t charPositionInLine = 0;
    RuntimeErrorException(std::string msg) {
      message = msg;
    };
    RuntimeErrorException(std::string msg, size_t _line, size_t _charPositionInLine) {
      message = msg;
      line = _line;
      charPositionInLine = _charPositionInLine;
      formattedMessage = "line " + std::to_string(line) + ":" + std::to_string(charPositionInLine) + " " + message;
    };
    char const* what() const noexcept override {
      return line > 0 ? formattedMessage.c_str() : message.c_str();
    }
  };

  class ParseErrorException : public std::exception {
    std::string formattedMessage;
    public:
    std::string message;
    size_t line = 0;
    size_t charPositionInLine = 0;
    ParseErrorException(std::string msg) {
      message = msg;
    };
    ParseErrorException(std::string msg, size_t _line, size_t _charPositionInLine) {
      message = msg;
      line = _line;
      charPositionInLine = _charPositionInLine;
      formattedMessage = "line " + std::to_string(line) + ":" + std::to_string(charPositionInLine) + " " + message;
    };
    char const* what() const noexcept override {
      return line > 0 ? formattedMessage.c_str() : message.c_str();
    }
  };
}

