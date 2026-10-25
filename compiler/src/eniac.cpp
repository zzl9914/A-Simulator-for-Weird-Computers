#include "trit.hpp"

#include <cctype>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace {

constexpr int kAccumulators = 20;

std::optional<int> parseAcc(const std::string& token, int line, std::string& error) {
  if (!isDecimal(token) || token[0] == '+' || token[0] == '-') {
    error = "第 " + std::to_string(line) + " 行：累加器是 1 到 20。";
    return std::nullopt;
  }
  int acc = std::stoi(token);
  if (acc < 1 || acc > kAccumulators) {
    error = "第 " + std::to_string(line) + " 行：累加器是 1 到 20。";
    return std::nullopt;
  }
  return acc - 1;
}

std::optional<int> parseCount(const std::string& token, int line, int min, int max, const std::string& name, std::string& error) {
  if (!isDecimal(token) || token[0] == '+' || token[0] == '-') {
    error = "第 " + std::to_string(line) + " 行：" + name + " 要是 " + std::to_string(min) + " 到 " + std::to_string(max) + " 的整数";
    return std::nullopt;
  }
  int value = std::stoi(token);
  if (value < min || value > max) {
    error = "第 " + std::to_string(line) + " 行：" + name + " 要是 " + std::to_string(min) + " 到 " + std::to_string(max) + " 的整数";
    return std::nullopt;
  }
  return value;
}

std::optional<long long> parseSigned(const std::string& token, int line, std::string& error) {
  if (!isDecimal(token)) {
    error = "第 " + std::to_string(line) + " 行：这里要有一个十进制数";
    return std::nullopt;
  }
  long long value = std::stoll(token);
  if (value > 9999999999LL || value < -9999999999LL) {
    error = "这个数放不进十位环形计数器";
    return std::nullopt;
  }
  return value;
}

std::vector<std::string> splitTokens(const std::string& text) {
  std::vector<std::string> tokens;
  std::string token;
  for (char ch : text) {
    if (ch == ' ' || ch == '\t' || ch == ',') {
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

}  // namespace

Json assembleEniac(const std::string& source) {
  auto lines = splitLines(source);
  std::vector<Json> pulses;
  std::vector<std::pair<int, std::string>> errors;
  std::map<std::string, int> labels;
  struct Pending {
    int index;
    int stepper;
    int line;
    std::string text;
    std::string name;
  };
  std::vector<Pending> pending;
  if (trim(source).empty()) errors.emplace_back(1, "接线表是空的");

  for (size_t index = 0; index < lines.size(); ++index) {
    int line = static_cast<int>(index + 1);
    std::string text = stripComment(lines[index]);
    if (text.empty() || text[0] == '*') continue;
    auto tokens = splitTokens(text);
    if (tokens.empty()) continue;
    if (tokens.size() == 1 && tokens[0].back() == ':') {
      std::string name = upperAscii(tokens[0].substr(0, tokens[0].size() - 1));
      if (labels.count(name)) errors.emplace_back(line, "标号 " + name + " 重复了");
      else labels[name] = static_cast<int>(pulses.size());
      continue;
    }
    std::string op = upperAscii(tokens[0]);
    std::string error;
    auto at = [&](size_t i) { return parseAcc(i < tokens.size() ? tokens[i] : "", line, error); };
    auto count = [&](size_t i, int min, int max, const std::string& name) {
      return parseCount(i < tokens.size() ? tokens[i] : "", line, min, max, name, error);
    };
    if (op == "SET") {
      auto acc = at(1);
      auto value = tokens.size() > 2 ? parseSigned(tokens[2], line, error) : std::nullopt;
      if (!acc || !value) errors.emplace_back(line, error.empty() ? "SET 后面要有一个十进制数" : error);
      else pulses.push_back(jobj({{"op", js("SET")}, {"acc", jn(*acc)}, {"value", jn(*value)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "ADD" || op == "SUB") {
      auto src = at(1);
      auto dst = at(2);
      if (!src || !dst) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js(op)}, {"src", jn(*src)}, {"dst", jn(*dst)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "MUL") {
      auto icand = at(1);
      auto ier = at(2);
      auto low = at(3);
      auto high = at(4);
      if (!icand || !ier || !low || !high) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("MUL")}, {"icand", jn(*icand)}, {"ier", jn(*ier)}, {"low", jn(*low)}, {"high", jn(*high)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "DIV") {
      auto num = at(1);
      auto den = at(2);
      auto quot = at(3);
      if (!num || !den || !quot) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("DIV")}, {"num", jn(*num)}, {"den", jn(*den)}, {"quot", jn(*quot)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "SQRT") {
      auto src = at(1);
      auto dest = at(2);
      if (!src || !dest) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("SQRT")}, {"src", jn(*src)}, {"dest", jn(*dest)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "FTSET") {
      auto table = count(1, 1, 3, "函数表");
      auto arg = count(2, 0, 99, "自变量");
      auto value = tokens.size() > 3 ? parseSigned(tokens[3], line, error) : std::nullopt;
      if (!table || !arg || !value) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("FTSET")}, {"table", jn(*table - 1)}, {"index", jn(*arg)}, {"value", jn(*value)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "FT") {
      auto table = count(1, 1, 3, "函数表");
      auto arg = at(2);
      auto dest = at(3);
      if (!table || !arg || !dest) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("FT")}, {"table", jn(*table - 1)}, {"arg", jn(*arg)}, {"dest", jn(*dest)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "CTSET") {
      auto index = count(1, 0, 99, "常数号");
      auto value = tokens.size() > 2 ? parseSigned(tokens[2], line, error) : std::nullopt;
      if (!index || !value) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("CTSET")}, {"index", jn(*index)}, {"value", jn(*value)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "CT") {
      auto index = count(1, 0, 99, "常数号");
      auto dest = at(2);
      if (!index || !dest) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("CT")}, {"index", jn(*index)}, {"dest", jn(*dest)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "MPSET") {
      auto stepper = count(1, 1, 10, "步进器");
      auto times = count(2, 0, 999999, "次数");
      if (!stepper || !times) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("MPSET")}, {"stepper", jn(*stepper - 1)}, {"count", jn(*times)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "MP") {
      auto stepper = count(1, 1, 10, "步进器");
      std::string name = tokens.size() > 2 ? upperAscii(tokens[2]) : "";
      if (!stepper || name.empty() || !std::isalpha(static_cast<unsigned char>(name[0]))) {
        errors.emplace_back(line, "MP 要写步进器和标号");
      } else {
        pending.push_back({static_cast<int>(pulses.size()), *stepper - 1, line, text, name});
        pulses.push_back(jobj({{"op", js("MP")}, {"stepper", jn(0)}, {"target", jn(0)}, {"line", jn(line)}, {"text", js(text)}}));
      }
    } else if (op == "OUT") {
      auto acc = at(1);
      if (!acc) errors.emplace_back(line, error);
      else pulses.push_back(jobj({{"op", js("OUT")}, {"acc", jn(*acc)}, {"line", jn(line)}, {"text", js(text)}}));
    } else if (op == "HLT") {
      pulses.push_back(jobj({{"op", js("HLT")}, {"line", jn(line)}, {"text", js(text)}}));
    } else {
      errors.emplace_back(line, "不认识的脉冲 " + tokens[0]);
    }
  }

  for (const auto& item : pending) {
    auto found = labels.find(item.name);
    if (found == labels.end()) {
      errors.emplace_back(1, "没有标号 " + item.name);
    } else {
      pulses[item.index] = jobj({
          {"op", js("MP")},
          {"stepper", jn(item.stepper)},
          {"target", jn(found->second)},
          {"line", jn(item.line)},
          {"text", js(item.text)},
      });
    }
  }
  if (!errors.empty()) return errorResult(errors);
  if (pulses.empty()) return errorResult({{1, "没有程序脉冲"}});
  return jobj({{"ok", jb(true)}, {"program", jobj({{"pulses", jarr(std::move(pulses))}, {"lines", linesJson(lines)}})}});
}
