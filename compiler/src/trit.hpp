#pragma once

#include "json.hpp"

#include <optional>
#include <string>
#include <vector>

using Trits = std::vector<int>;

Trits zeros(int width);
long long toInt(const Trits& trits);
std::optional<Trits> tryFromInt(long long value, int width);
Trits mustFromInt(long long value, int width);
std::optional<Trits> parseTritLiteral(const std::string& token);
enum class ParseFail { format, range };
struct ParsedTrits {
  bool ok = false;
  ParseFail reason = ParseFail::format;
  Trits trits;
};
ParsedTrits parseBalanced(const std::string& token, int width);
Json tritJson(const Trits& trits);
Json tritMatrix(const std::vector<Trits>& rows);
std::vector<std::string> splitLines(std::string source);
std::string trim(const std::string& text);
std::string stripComment(const std::string& line);
std::vector<std::string> splitWs(const std::string& text);
std::string upperAscii(std::string text);
bool isIdent(const std::string& text);
bool isDecimal(const std::string& text);
std::optional<long long> tryParseInteger(const std::string& text);
Json errorResult(const std::vector<std::pair<int, std::string>>& errors);
Json linesJson(const std::vector<std::string>& lines);
Json labelsJson(const std::vector<std::pair<std::string, long long>>& labels);
