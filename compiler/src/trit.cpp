#include "trit.hpp"

#include <cctype>

Trits zeros(int width) { return Trits(static_cast<size_t>(width), 0); }

long long toInt(const Trits& trits) {
  long long value = 0;
  for (int trit : trits) value = value * 3 + trit;
  return value;
}

std::optional<Trits> tryFromInt(long long value, int width) {
  if (width < 1) return std::nullopt;
  Trits digits;
  long long n = value;
  while (n != 0) {
    long long rem = n % 3;
    n /= 3;
    if (rem < 0) {
      rem += 3;
      n -= 1;
    }
    if (rem == 2) {
      digits.push_back(-1);
      n += 1;
    } else {
      digits.push_back(static_cast<int>(rem));
    }
    if (static_cast<int>(digits.size()) > width) return std::nullopt;
  }
  while (static_cast<int>(digits.size()) < width) digits.push_back(0);
  return Trits(digits.rbegin(), digits.rend());
}

Trits mustFromInt(long long value, int width) {
  auto trits = tryFromInt(value, width);
  if (!trits) return zeros(width);
  return *trits;
}

std::optional<Trits> parseTritLiteral(const std::string& token) {
  if (token.empty()) return std::nullopt;
  Trits trits;
  for (size_t i = 0; i < token.size();) {
    unsigned char ch = static_cast<unsigned char>(token[i]);
    if (token[i] == '+') {
      trits.push_back(1);
      i += 1;
    } else if (token[i] == '-' || token[i] == 'T' || token[i] == 't') {
      trits.push_back(-1);
      i += 1;
    } else if (token.compare(i, 3, "−") == 0 || token.compare(i, 3, "–") == 0) {
      trits.push_back(-1);
      i += 3;
    } else if (token[i] == '0') {
      trits.push_back(0);
      i += 1;
    } else {
      return std::nullopt;
    }
    (void)ch;
  }
  return trits;
}

ParsedTrits parseBalanced(const std::string& token, int width) {
  ParsedTrits parsed;
  if (auto literal = parseTritLiteral(token)) {
    if (static_cast<int>(literal->size()) > width) {
      parsed.reason = ParseFail::range;
      return parsed;
    }
    auto trits = tryFromInt(toInt(*literal), width);
    if (!trits) {
      parsed.reason = ParseFail::range;
      return parsed;
    }
    parsed.ok = true;
    parsed.trits = *trits;
    return parsed;
  }
  if (isDecimal(token)) {
    auto trits = tryFromInt(std::stoll(token), width);
    if (!trits) {
      parsed.reason = ParseFail::range;
      return parsed;
    }
    parsed.ok = true;
    parsed.trits = *trits;
    return parsed;
  }
  parsed.reason = ParseFail::format;
  return parsed;
}

Json tritJson(const Trits& trits) {
  std::vector<Json> values;
  for (int trit : trits) values.push_back(jn(trit));
  return jarr(std::move(values));
}

Json tritMatrix(const std::vector<Trits>& rows) {
  std::vector<Json> values;
  for (const auto& row : rows) values.push_back(tritJson(row));
  return jarr(std::move(values));
}

std::vector<std::string> splitLines(std::string source) {
  std::string cleaned;
  cleaned.reserve(source.size());
  for (size_t i = 0; i < source.size(); ++i) {
    if (source[i] == '\r' && i + 1 < source.size() && source[i + 1] == '\n') continue;
    cleaned.push_back(source[i]);
  }
  std::vector<std::string> lines;
  std::string line;
  for (char ch : cleaned) {
    if (ch == '\n') {
      lines.push_back(line);
      line.clear();
    } else {
      line.push_back(ch);
    }
  }
  lines.push_back(line);
  return lines;
}

std::string trim(const std::string& text) {
  size_t begin = 0;
  while (begin < text.size() && std::isspace(static_cast<unsigned char>(text[begin]))) ++begin;
  size_t end = text.size();
  while (end > begin && std::isspace(static_cast<unsigned char>(text[end - 1]))) --end;
  return text.substr(begin, end - begin);
}

std::string stripComment(const std::string& line) {
  auto mark = line.find(';');
  return trim(mark == std::string::npos ? line : line.substr(0, mark));
}

std::vector<std::string> splitWs(const std::string& text) {
  std::vector<std::string> tokens;
  std::string token;
  for (char ch : text) {
    if (std::isspace(static_cast<unsigned char>(ch))) {
      if (!token.empty()) {
        tokens.push_back(token);
        token.clear();
      }
    } else {
      token.push_back(ch);
    }
  }
  if (!token.empty()) tokens.push_back(token);
  return tokens;
}

std::string upperAscii(std::string text) {
  for (char& ch : text) {
    if (ch >= 'a' && ch <= 'z') ch = static_cast<char>(ch - 'a' + 'A');
  }
  return text;
}

bool isIdent(const std::string& text) {
  if (text.empty()) return false;
  if (!(std::isalpha(static_cast<unsigned char>(text[0])) || text[0] == '_')) return false;
  for (char ch : text) {
    if (!(std::isalnum(static_cast<unsigned char>(ch)) || ch == '_')) return false;
  }
  return true;
}

bool isDecimal(const std::string& text) {
  if (text.empty()) return false;
  size_t i = 0;
  if (text[0] == '+' || text[0] == '-') i = 1;
  if (i >= text.size()) return false;
  for (; i < text.size(); ++i) {
    if (!std::isdigit(static_cast<unsigned char>(text[i]))) return false;
  }
  return true;
}

Json errorResult(const std::vector<std::pair<int, std::string>>& errors) {
  std::vector<Json> items;
  for (const auto& [line, message] : errors) {
    items.push_back(jobj({{"line", jn(line)}, {"message", js(message)}}));
  }
  return jobj({{"ok", jb(false)}, {"errors", jarr(std::move(items))}});
}

Json linesJson(const std::vector<std::string>& lines) {
  std::vector<Json> values;
  for (const auto& line : lines) values.push_back(js(line));
  return jarr(std::move(values));
}

Json labelsJson(const std::vector<std::pair<std::string, long long>>& labels) {
  std::vector<std::pair<std::string, Json>> fields;
  for (const auto& [name, addr] : labels) fields.emplace_back(name, jn(addr));
  return jobj(std::move(fields));
}
