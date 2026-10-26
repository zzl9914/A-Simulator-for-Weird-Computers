#include "trit.hpp"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace {

constexpr int kDrum = 2000;
constexpr int kWidth = 10;

enum class Kind { arith, branch, stop };

struct OpSpec {
  std::string name;
  int code;
  Kind kind;
};

const OpSpec kOps[] = {
    {"NOP", 0, Kind::arith},   {"STOP", 1, Kind::stop},   {"AU", 10, Kind::arith},
    {"SU", 11, Kind::arith},   {"DIV", 14, Kind::arith},  {"ALO", 15, Kind::arith},
    {"SLO", 16, Kind::arith},  {"AABL", 17, Kind::arith}, {"SABL", 18, Kind::arith},
    {"MULT", 19, Kind::arith}, {"STL", 20, Kind::arith},  {"STU", 21, Kind::arith},
    {"STDA", 22, Kind::arith}, {"STIA", 23, Kind::arith}, {"STD", 24, Kind::arith},
    {"SRT", 30, Kind::arith},  {"SRD", 31, Kind::arith},  {"SLT", 35, Kind::arith},
    {"SCT", 36, Kind::arith},  {"BRNZU", 44, Kind::branch}, {"BRNZ", 45, Kind::branch},
    {"BMI", 46, Kind::branch}, {"BROV", 47, Kind::branch}, {"RAU", 60, Kind::arith},
    {"RSU", 61, Kind::arith},  {"DIVRU", 64, Kind::arith}, {"RAL", 65, Kind::arith},
    {"RSL", 66, Kind::arith},  {"RAABL", 67, Kind::arith}, {"RSABL", 68, Kind::arith},
    {"LDD", 69, Kind::arith},  {"RD", 70, Kind::arith},   {"PCH", 71, Kind::arith},
    {"TLU", 84, Kind::arith},  {"BRD10", 90, Kind::branch}, {"BRD1", 91, Kind::branch},
    {"BRD2", 92, Kind::branch}, {"BRD3", 93, Kind::branch}, {"BRD4", 94, Kind::branch},
    {"BRD5", 95, Kind::branch}, {"BRD6", 96, Kind::branch}, {"BRD7", 97, Kind::branch},
    {"BRD8", 98, Kind::branch}, {"BRD9", 99, Kind::branch},
};

const OpSpec* findOp(const std::string& name) {
  std::string key = name;
  if (key == "BRMIN") key = "BMI";
  if (key == "AL") key = "ALO";
  if (key == "SL") key = "SLO";
  if (key == "LD") key = "LDD";
  if (key == "NOOP") key = "NOP";
  for (const auto& op : kOps) if (op.name == key) return &op;
  return nullptr;
}

struct Word {
  int sign = 1;
  int digits[kWidth] = {};
};

Word parseSigned(const std::string& token, int line, std::string& error) {
  if (!isDecimal(token)) {
    error = "第 " + std::to_string(line) + " 行：" + token + " 不是十进制数";
    return {};
  }
  bool negative = token[0] == '-';
  std::string digits = (token[0] == '+' || token[0] == '-') ? token.substr(1) : token;
  size_t first = 0;
  while (first + 1 < digits.size() && digits[first] == '0') ++first;
  digits = digits.substr(first);
  if (digits.size() > kWidth) {
    error = "第 " + std::to_string(line) + " 行：超过十位";
    return {};
  }
  Word word;
  word.sign = negative ? -1 : 1;
  for (size_t i = 0; i < digits.size(); ++i) word.digits[i] = digits[digits.size() - 1 - i] - '0';
  return word;
}

std::string formatWord(const Word& word) {
  std::string text = word.sign < 0 ? "−" : "+";
  for (int i = kWidth - 1; i >= 0; --i) text.push_back(static_cast<char>('0' + word.digits[i]));
  return text;
}

Word pack(int next, int data, int code) {
  Word word;
  int groups[3] = {next, data, code};
  int place = 0;
  for (int groupIndex = 0; groupIndex < 3; ++groupIndex) {
    int rest = groups[groupIndex];
    int width = place == 8 ? 2 : 4;
    for (int i = 0; i < width; ++i) {
      word.digits[place + i] = rest % 10;
      rest /= 10;
    }
    place += width;
  }
  return word;
}

Json wordJson(const Word& word) {
  std::vector<Json> digits;
  for (int digit : word.digits) digits.push_back(jn(digit));
  return jobj({{"sign", jn(word.sign)}, {"digits", jarr(std::move(digits))}});
}

enum class ItemKind { org, word, op };

struct Item {
  ItemKind kind;
  int addr = 0;
  std::optional<std::string> label;
  Word word;
  std::string note;
  std::string op;
  Kind opKind = Kind::stop;
  int code = 0;
  std::optional<std::string> data;
  std::optional<std::string> next;
  int line = 0;
};

}  // namespace

Json assemble650(const std::string& source) {
  auto lines = splitLines(source);
  std::vector<Item> items;
  std::vector<std::vector<Word>> cards;
  std::vector<std::pair<int, std::string>> errors;
  if (trim(source).empty()) errors.emplace_back(1, "程序是空的");

  for (size_t index = 0; index < lines.size(); ++index) {
    int line = static_cast<int>(index + 1);
    std::string text = stripComment(lines[index]);
    if (text.empty() || text[0] == '*') continue;
    auto tokens = splitWs(text);
    size_t cursor = 0;
    std::optional<std::string> label;
    if (!tokens.empty() && tokens[0].back() == ':') {
      label = upperAscii(tokens[0].substr(0, tokens[0].size() - 1));
      cursor = 1;
    } else if (tokens.size() >= 2) {
      std::string second = upperAscii(tokens[1]);
      if (findOp(second) || second == "DEC" || second == "ORG" || second == "CARD") {
        label = upperAscii(tokens[0]);
        cursor = 1;
      }
    }
    if (cursor >= tokens.size()) {
      errors.emplace_back(line, "这一行只有标号");
      continue;
    }
    std::string head = upperAscii(tokens[cursor]);
    if (head == "ORG") {
      if (cursor + 1 >= tokens.size() || !isDecimal(tokens[cursor + 1]) || tokens[cursor + 1][0] == '+' || tokens[cursor + 1][0] == '-') {
        errors.emplace_back(line, "ORG 超出磁鼓");
        continue;
      }
      auto parsed = tryParseInteger(tokens[cursor + 1]);
      if (!parsed || *parsed < 0 || *parsed >= kDrum) errors.emplace_back(line, "ORG 超出磁鼓");
      else items.push_back(Item{ItemKind::org, static_cast<int>(*parsed), std::nullopt, {}, "", "", Kind::stop, 0, std::nullopt, std::nullopt, line});
      continue;
    }
    if (head == "DEC") {
      std::string error;
      Word word = parseSigned(cursor + 1 < tokens.size() ? tokens[cursor + 1] : "", line, error);
      if (!error.empty()) {
        errors.emplace_back(line, error);
        continue;
      }
      items.push_back(Item{ItemKind::word, 0, label, word, "数据 " + formatWord(word), "", Kind::stop, 0, std::nullopt, std::nullopt, line});
      continue;
    }
    if (head == "CARD") {
      std::vector<Word> words;
      std::string error;
      for (size_t i = cursor + 1; i < tokens.size(); ++i) {
        Word word = parseSigned(tokens[i], line, error);
        if (!error.empty()) break;
        words.push_back(word);
      }
      if (!error.empty() || words.empty() || words.size() > 8) {
        errors.emplace_back(line, error.empty() ? "一张卡片要有 1 到 8 个十字" : error);
      } else {
        while (words.size() < 8) words.push_back(Word{});
        cards.push_back(words);
      }
      continue;
    }
    const OpSpec* spec = findOp(head);
    if (!spec) {
      errors.emplace_back(line, "不认识的操作 " + tokens[cursor]);
      continue;
    }
    std::string rest;
    for (size_t i = cursor + 1; i < tokens.size(); ++i) rest += tokens[i];
    std::vector<std::string> parts;
    std::string part;
    for (char ch : rest) {
      if (ch == ',') {
        if (!trim(part).empty()) parts.push_back(upperAscii(trim(part)));
        part.clear();
      } else {
        part.push_back(ch);
      }
    }
    if (!trim(part).empty()) parts.push_back(upperAscii(trim(part)));
    if (spec->kind == Kind::stop) {
      items.push_back(Item{ItemKind::op, 0, label, {}, "", spec->name, spec->kind, spec->code, std::nullopt, std::nullopt, line});
      continue;
    }
    if (spec->kind == Kind::branch && parts.size() != 2) {
      errors.emplace_back(line, "转移要写两个地址：条件成立去第一个，不成立去第二个");
      continue;
    }
    if (spec->kind == Kind::arith && parts.empty() && spec->name != "NOP") {
      errors.emplace_back(line, spec->name + " 需要数据地址");
      continue;
    }
    Item item{ItemKind::op, 0, label, {}, "", spec->name, spec->kind, spec->code, std::nullopt, std::nullopt, line};
    if (!parts.empty()) item.data = parts[0];
    if (parts.size() > 1) item.next = parts[1];
    items.push_back(item);
  }
  if (!errors.empty()) return errorResult(errors);

  std::vector<std::pair<std::string, long long>> labels;
  std::map<std::string, int> labelAt;
  std::vector<std::pair<int, Item>> placed;
  int cursor = 0;
  for (const auto& item : items) {
    if (item.kind == ItemKind::org) {
      cursor = item.addr;
      continue;
    }
    if (cursor >= kDrum) {
      errors.emplace_back(item.line, "程序超出 " + std::to_string(kDrum) + " 个字");
      break;
    }
    if (item.label) {
      if (labelAt.count(*item.label)) errors.emplace_back(item.line, "标号 " + *item.label + " 重复了");
      else {
        labelAt[*item.label] = cursor;
        labels.emplace_back(*item.label, cursor);
      }
    }
    placed.push_back({cursor, item});
    cursor += 1;
  }
  if (!errors.empty()) return errorResult(errors);

  auto resolve = [&](const std::optional<std::string>& token, int line, int fallback) -> std::optional<int> {
    if (!token) return fallback;
    if (isDecimal(*token) && (*token)[0] != '+' && (*token)[0] != '-') {
      auto parsed = tryParseInteger(*token);
      if (!parsed || *parsed < 0 || *parsed >= kDrum) {
        errors.emplace_back(line, "地址 " + *token + " 超出磁鼓");
        return std::nullopt;
      }
      return static_cast<int>(*parsed);
    }
    auto found = labelAt.find(*token);
    if (found == labelAt.end()) {
      errors.emplace_back(line, "没有标号 " + *token);
      return std::nullopt;
    }
    return found->second;
  };

  std::vector<Word> mem(kDrum);
  std::vector<std::string> notes(kDrum, "空");
  std::vector<int> addrToLine(kDrum, -1);
  std::optional<int> entry;
  for (size_t index = 0; index < placed.size(); ++index) {
    int addr = placed[index].first;
    const Item& item = placed[index].second;
    addrToLine[addr] = item.line;
    if (item.kind == ItemKind::word) {
      mem[addr] = item.word;
      notes[addr] = item.note;
      continue;
    }
    if (item.kind != ItemKind::op) continue;
    if (!entry) entry = addr;
    int following = index + 1 < placed.size() ? placed[index + 1].first : addr;
    auto data = resolve(item.data, item.line, 0);
    auto next = resolve(item.next, item.line, item.opKind == Kind::stop ? addr : following);
    if (!data || !next) continue;
    mem[addr] = pack(*next, *data, item.code);
    std::string nextText = item.next ? *item.next : (item.opKind == Kind::stop ? "" : "（顺序）");
    std::string note = item.op;
    if (item.data) note += " " + *item.data;
    if (!nextText.empty()) note += " " + nextText;
    notes[addr] = note;
  }
  if (!errors.empty()) return errorResult(errors);
  if (!entry) return errorResult({{1, "没有指令"}});

  std::vector<Json> memJson;
  for (const auto& word : mem) memJson.push_back(wordJson(word));
  std::vector<Json> noteJson;
  for (const auto& note : notes) noteJson.push_back(js(note));
  std::vector<Json> lineJson;
  for (int line : addrToLine) lineJson.push_back(jn(line));
  std::vector<Json> cardsJson;
  for (const auto& card : cards) {
    std::vector<Json> words;
    for (const auto& word : card) words.push_back(wordJson(word));
    cardsJson.push_back(jarr(std::move(words)));
  }
  return jobj({
      {"ok", jb(true)},
      {"program", jobj({{"mem", jarr(std::move(memJson))},
                        {"notes", jarr(std::move(noteJson))},
                        {"entry", jn(*entry)},
                        {"labels", labelsJson(labels)},
                        {"lines", linesJson(lines)},
                        {"addrToLine", jarr(std::move(lineJson))},
                        {"cards", jarr(std::move(cardsJson))}})},
  });
}
