#pragma once

#include <map>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

struct Json {
  enum class Kind { nul, boolean, number, string, array, object };

  Kind kind = Kind::nul;
  bool boolean = false;
  long long number = 0;
  std::string text;
  std::vector<Json> array;
  std::vector<std::pair<std::string, Json>> object;

  static Json nul() { return {}; }
  static Json booleanValue(bool value) {
    Json json;
    json.kind = Kind::boolean;
    json.boolean = value;
    return json;
  }
  static Json numberValue(long long value) {
    Json json;
    json.kind = Kind::number;
    json.number = value;
    return json;
  }
  static Json stringValue(std::string value) {
    Json json;
    json.kind = Kind::string;
    json.text = std::move(value);
    return json;
  }
  static Json arrayValue(std::vector<Json> value) {
    Json json;
    json.kind = Kind::array;
    json.array = std::move(value);
    return json;
  }
  static Json objectValue(std::vector<std::pair<std::string, Json>> value) {
    Json json;
    json.kind = Kind::object;
    json.object = std::move(value);
    return json;
  }

  std::string dump() const {
    std::ostringstream out;
    write(out);
    return out.str();
  }

 private:
  static void writeString(std::ostringstream& out, const std::string& value) {
    out << '"';
    for (unsigned char ch : value) {
      switch (ch) {
        case '"':
          out << "\\\"";
          break;
        case '\\':
          out << "\\\\";
          break;
        case '\n':
          out << "\\n";
          break;
        case '\r':
          out << "\\r";
          break;
        case '\t':
          out << "\\t";
          break;
        default:
          if (ch < 0x20) {
            const char* hex = "0123456789abcdef";
            out << "\\u00" << hex[ch >> 4] << hex[ch & 0xf];
          } else {
            out << static_cast<char>(ch);
          }
      }
    }
    out << '"';
  }

  void write(std::ostringstream& out) const {
    switch (kind) {
      case Kind::nul:
        out << "null";
        break;
      case Kind::boolean:
        out << (boolean ? "true" : "false");
        break;
      case Kind::number:
        out << number;
        break;
      case Kind::string:
        writeString(out, text);
        break;
      case Kind::array:
        out << '[';
        for (size_t i = 0; i < array.size(); ++i) {
          if (i) out << ',';
          array[i].write(out);
        }
        out << ']';
        break;
      case Kind::object:
        out << '{';
        for (size_t i = 0; i < object.size(); ++i) {
          if (i) out << ',';
          writeString(out, object[i].first);
          out << ':';
          object[i].second.write(out);
        }
        out << '}';
        break;
    }
  }
};

inline Json jn(long long value) { return Json::numberValue(value); }
inline Json js(std::string value) { return Json::stringValue(std::move(value)); }
inline Json jb(bool value) { return Json::booleanValue(value); }
inline Json jarr(std::vector<Json> value) { return Json::arrayValue(std::move(value)); }
inline Json jobj(std::vector<std::pair<std::string, Json>> value) {
  return Json::objectValue(std::move(value));
}
