#pragma once

#include <cstddef>
#include <string>
#include <exception>

namespace Arcweave {
  namespace detail {
    class ExceptionMessageCache {
      mutable std::string formattedMessage;
      mutable std::string cachedMessage;
      mutable std::size_t cachedLine = 0;
      mutable std::size_t cachedColumn = 0;
    public:
      const char* get(const std::string& message, std::size_t line, std::size_t column) const noexcept {
        if (line == 0) return message.c_str();
        try {
          if (formattedMessage.empty() || cachedMessage != message || cachedLine != line || cachedColumn != column) {
            auto formatted = "line " + std::to_string(line) + ":" + std::to_string(column) + " " + message;
            auto currentMessage = message;
            // Publish the cache only after every allocation succeeds.
            formattedMessage.swap(formatted);
            cachedMessage.swap(currentMessage);
            cachedLine = line;
            cachedColumn = column;
          }
          return formattedMessage.c_str();
        } catch (...) {
          // what() must still return useful text if formatting cannot allocate.
          return message.c_str();
        }
      }
    };
  }

  class RuntimeErrorException : public std::exception {
    detail::ExceptionMessageCache messageCache;
    public:
    std::string message;
    std::size_t line = 0;
    std::size_t charPositionInLine = 0;
    RuntimeErrorException(std::string msg) {
      message = msg;
    };
    RuntimeErrorException(std::string msg, std::size_t _line, std::size_t _charPositionInLine) {
      message = msg;
      line = _line;
      charPositionInLine = _charPositionInLine;
    };
    char const* what() const noexcept override {
      return messageCache.get(message, line, charPositionInLine);
    }
  };

  class ParseErrorException : public std::exception {
    detail::ExceptionMessageCache messageCache;
    public:
    std::string message;
    std::size_t line = 0;
    std::size_t charPositionInLine = 0;
    ParseErrorException(std::string msg) {
      message = msg;
    };
    ParseErrorException(std::string msg, std::size_t _line, std::size_t _charPositionInLine) {
      message = msg;
      line = _line;
      charPositionInLine = _charPositionInLine;
    };
    char const* what() const noexcept override {
      return messageCache.get(message, line, charPositionInLine);
    }
  };
}

