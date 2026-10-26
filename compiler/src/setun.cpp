#include "trit.hpp"

#include <cctype>
#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr int kWords = 162;
constexpr int kZoneWords = 54;
constexpr int kDrumZones = 36;
constexpr int kDrumWords = kDrumZones * kZoneWords;
constexpr int kWord = 9;
constexpr int kAddr = 5;
const int kZoneSign[3] = {1, 0, -1};

struct OpSpec {
  std::string name;
  std::string code;
};

const OpSpec kOps[] = {
    {"LDA", "30"},   {"ADD", "33"},   {"SUB", "3!3"}, {"STA", "!23"}, {"BR", "00"},
    {"BM", "1!3"},   {"BZ", "10"},    {"BP", "13"},   {"HLT", "2!3"}, {"SHF", "!20"},
    {"TMUL", "20"},  {"LDR", "23"},   {"LDF", "!10"}, {"STF", "0!3"}, {"ADF", "!1!3"},
    {"STC", "03"},   {"RZONE", "40"}, {"WZONE", "43"},
    {"MUL", "4!3"},  {"NORM", "!40"}, {"MADD", "!43"}, {"ADDC", "!4!3"},
    {"IN", "!30"},   {"OUT", "!33"},
};

const OpSpec* findOp(const std::string& name) {
  for (const auto& op : kOps) {
    if (op.name == name) return &op;
  }
  return nullptr;
}

std::optional<Trits> parseNovenary(const std::string& code) {
  std::vector<int> digits;
  bool negative = false;
  for (char ch : code) {
    if (ch == '!') {
      negative = true;
      continue;
    }
    if (ch < '0' || ch > '4') return std::nullopt;
    digits.push_back(negative ? -(ch - '0') : ch - '0');
    negative = false;
  }
  if (negative || digits.size() != 2) return std::nullopt;
  Trits trits;
  for (int digit : digits) {
    bool found = false;
    for (int hi : {-1, 0, 1}) {
      for (int lo : {-1, 0, 1}) {
        if (hi * 3 + lo == digit) {
          trits.push_back(hi);
          trits.push_back(lo);
          found = true;
        }
      }
    }
    if (!found) return std::nullopt;
  }
  return trits;
}

Trits linearToAddress(int addr) {
  int zone = addr / kZoneWords;
  int within = addr % kZoneWords;
  Trits cell = mustFromInt(within / 2 - 13, 3);
  int half = within % 2 == 0 ? 0 : 1;
  return {kZoneSign[zone], cell[0], cell[1], cell[2], half};
}

Trits zoneAddress(int packed) {
  int ram = packed / kDrumZones;
  int drum = packed % kDrumZones;
  Trits drumTrits = mustFromInt(drum, 4);
  Trits field = {kZoneSign[ram]};
  field.insert(field.end(), drumTrits.begin(), drumTrits.end());
  return field;
}

Trits encode(int addr, const OpSpec& op, int mod) {
  Trits address = (op.name == "RZONE" || op.name == "WZONE") ? zoneAddress(addr) : linearToAddress(addr);
  Trits four = *parseNovenary(op.code);
  return {address[0], address[1], address[2], address[3], address[4], four[0], four[1], four[2], mod};
}

std::optional<int> parseZoneOperand(const std::string& text, int line, std::vector<std::pair<int, std::string>>& errors) {
  std::string normalized;
  for (size_t i = 0; i < text.size();) {
    if (text.compare(i, 3, "−") == 0) {
      normalized.push_back('-');
      i += 3;
    } else {
      normalized.push_back(text[i]);
      i += 1;
    }
  }
  auto colon = normalized.find(':');
  if (colon == std::string::npos || !isDecimal(normalized.substr(0, colon))) {
    errors.emplace_back(line, "区交换写成 磁鼓区:快存区，例如 5:+1、12:0、0:-1");
    return std::nullopt;
  }
  std::string ramText = normalized.substr(colon + 1);
  auto drumValue = tryParseInteger(normalized.substr(0, colon));
  int drum = drumValue && *drumValue >= 0 && *drumValue < kDrumZones ? static_cast<int>(*drumValue) : kDrumZones;
  int ramSign = 99;
  if (ramText == "+1" || ramText == "1") ramSign = 1;
  else if (ramText == "0") ramSign = 0;
  else if (ramText == "-1") ramSign = -1;
  int ram = -1;
  for (int i = 0; i < 3; ++i) {
    if (kZoneSign[i] == ramSign) ram = i;
  }
  if (drum >= kDrumZones || ram < 0 || ramText != "+1" && ramText != "1" && ramText != "0" && ramText != "-1") {
    errors.emplace_back(line, "磁鼓区要在 0–35，快存区是 +1、0 或 −1");
    return std::nullopt;
  }
  if (drum < 0) {
    errors.emplace_back(line, "区交换写成 磁鼓区:快存区，例如 5:+1、12:0、0:-1");
    return std::nullopt;
  }
  return ram * kDrumZones + drum;
}

enum class ItemKind { org, word, op };

struct Item {
  ItemKind kind;
  int addr = 0;
  std::optional<std::string> label;
  Trits trits;
  std::string note;
  std::string op;
  std::optional<std::string> operand;
  int mod = 0;
  int line = 0;
};

std::optional<int> parseModifier(const std::string& token, int line, std::vector<std::pair<int, std::string>>& errors) {
  if (token.empty() || token == "0") return 0;
  if (token == "+") return 1;
  if (token == "-" || token == "−") return -1;
  errors.emplace_back(line, "变址标志只能是 +、− 或 0");
  return std::nullopt;
}

}  // namespace

Json assembleSetun(const std::string& source) {
  auto lines = splitLines(source);
  std::vector<Item> items;
  std::vector<long long> input;
  std::vector<std::pair<int, std::string>> errors;
  std::optional<std::string> pending;
  int pendingLine = 0;

  if (trim(source).empty()) errors.emplace_back(1, "程序是空的");

  for (size_t index = 0; index < lines.size(); ++index) {
    int line = static_cast<int>(index + 1);
    std::string text = stripComment(lines[index]);
    if (text.empty() || text[0] == '*') continue;
    auto tokens = splitWs(text);
    size_t cursor = 0;
    std::optional<std::string> inlineLabel;
    if (!tokens.empty() && tokens[0].back() == ':') {
      inlineLabel = upperAscii(tokens[0].substr(0, tokens[0].size() - 1));
      cursor = 1;
    }
    if (cursor >= tokens.size()) {
      if (!inlineLabel) continue;
      if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 还没落到指令上");
      pending = inlineLabel;
      pendingLine = line;
      continue;
    }
    std::string head = upperAscii(tokens[cursor]);
    std::optional<std::string> label = inlineLabel ? inlineLabel : pending;
    pending.reset();
    if (head == ".ORG" || head == "ORG") {
      if (label) errors.emplace_back(line, "ORG 不能带标号");
      if (cursor + 1 >= tokens.size() || !isDecimal(tokens[cursor + 1]) || tokens[cursor + 1][0] == '+' || tokens[cursor + 1][0] == '-') {
        errors.emplace_back(line, "ORG 地址要在 0 到 161 之间");
      } else {
        auto parsed = tryParseInteger(tokens[cursor + 1]);
        if (!parsed || *parsed < 0 || *parsed >= kWords) errors.emplace_back(line, "ORG 地址要在 0 到 161 之间");
        else items.push_back(Item{ItemKind::org, static_cast<int>(*parsed), std::nullopt, {}, "", "", std::nullopt, 0, line});
      }
      continue;
    }
    if (head == ".T" || head == ".SHORT" || head == "WORD" || head == "SHORT") {
      if (cursor + 1 >= tokens.size()) {
        errors.emplace_back(line, "这里缺一个数");
        continue;
      }
      bool shortWord = head == ".SHORT" || head == "SHORT";
      auto parsed = parseBalanced(tokens[cursor + 1], shortWord ? kAddr : kWord);
      if (!parsed.ok) {
        errors.emplace_back(line, parsed.reason == ParseFail::range
                                       ? (shortWord ? "这个短字超出五位三进制（−121 到 121）" : "这个数超出九位三进制（−9841 到 9841）")
                                       : "看不懂这个数：" + tokens[cursor + 1]);
        continue;
      }
      Trits trits = shortWord ? parsed.trits : parsed.trits;
      if (shortWord) trits.insert(trits.end(), 4, 0);
      long long shown = toInt(shortWord ? parsed.trits : trits);
      items.push_back(Item{ItemKind::word, 0, label, trits, shortWord ? "短字 " + std::to_string(shown) : "整数 " + std::to_string(shown), "", std::nullopt, 0, line});
      continue;
    }
    if (head == "TAPE") {
      if (cursor + 1 >= tokens.size() || !isDecimal(tokens[cursor + 1])) {
        errors.emplace_back(line, "TAPE 后面要有一个整数");
      } else {
        auto parsed = tryParseInteger(tokens[cursor + 1]);
        if (!parsed) errors.emplace_back(line, "TAPE 后面要有一个放得下的整数");
        else input.push_back(*parsed);
      }
      continue;
    }
    const OpSpec* op = findOp(head);
    if (!op) {
      errors.emplace_back(line, "不认识的操作 " + tokens[cursor]);
      continue;
    }
    std::string rest;
    for (size_t i = cursor + 1; i < tokens.size(); ++i) rest += tokens[i];
    std::vector<std::string> parts;
    std::string part;
    for (char ch : rest) {
      if (ch == ',') {
        if (!trim(part).empty()) parts.push_back(trim(part));
        part.clear();
      } else {
        part.push_back(ch);
      }
    }
    if (!trim(part).empty()) parts.push_back(trim(part));
    if (op->name == "HLT") {
      if (!parts.empty()) errors.emplace_back(line, "教学机的停机指令不带地址");
      items.push_back(Item{ItemKind::op, 0, label, {}, "", op->name, std::nullopt, 0, line});
      continue;
    }
    if (parts.empty()) {
      errors.emplace_back(line, op->name + " 需要一个地址");
      continue;
    }
    auto mod = parseModifier(parts.size() > 1 ? parts[1] : "", line, errors);
    if (parts.size() > 2) errors.emplace_back(line, "操作数里逗号太多");
    if (!mod) continue;
    items.push_back(Item{ItemKind::op, 0, label, {}, "", op->name, upperAscii(parts[0]), *mod, line});
  }
  if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 没有落到指令或数据上");
  if (!errors.empty()) return errorResult(errors);

  std::vector<std::pair<std::string, long long>> labels;
  std::map<std::string, int> labelIndex;
  std::vector<std::pair<int, Item>> placed;
  int cursor = 0;
  for (const auto& item : items) {
    if (item.kind == ItemKind::org) {
      cursor = item.addr;
      continue;
    }
    if (cursor >= kWords) {
      errors.emplace_back(item.line, "程序超出 162 个短字");
      break;
    }
    if (item.label) {
      if (item.label->empty() || !((*item.label)[0] == '_' || std::isalpha(static_cast<unsigned char>((*item.label)[0])))) {
        errors.emplace_back(item.line, "标号 " + *item.label + " 不合法");
      } else if (labelIndex.count(*item.label)) {
        errors.emplace_back(item.line, "标号 " + *item.label + " 重复了");
      } else {
        bool ok = true;
        for (char ch : *item.label) {
          if (!(std::isalnum(static_cast<unsigned char>(ch)) || ch == '_')) ok = false;
        }
        if (!ok) errors.emplace_back(item.line, "标号 " + *item.label + " 不合法");
        else {
          labelIndex[*item.label] = cursor;
          labels.emplace_back(*item.label, cursor);
        }
      }
    }
    placed.push_back({cursor, item});
    cursor += 1;
  }
  if (!errors.empty()) return errorResult(errors);

  std::vector<Trits> mem(kWords, zeros(kWord));
  std::vector<Trits> drum(kDrumWords, zeros(kWord));
  std::vector<std::string> notes(kWords, "空");
  std::vector<int> addrToLine(kWords, -1);
  std::optional<int> entry;

  for (const auto& [addr, item] : placed) {
    addrToLine[addr] = item.line;
    if (item.kind == ItemKind::word) {
      mem[addr] = item.trits;
      notes[addr] = item.note;
      continue;
    }
    if (item.kind != ItemKind::op) continue;
    if (!entry) entry = addr;
    int address = 0;
    if (item.op == "RZONE" || item.op == "WZONE") {
      auto packed = parseZoneOperand(item.operand.value_or(""), item.line, errors);
      if (!packed) continue;
      address = *packed;
    } else if (item.operand) {
      if (isDecimal(*item.operand) && (*item.operand)[0] != '+' && (*item.operand)[0] != '-') {
        auto parsed = tryParseInteger(*item.operand);
        if (!parsed || *parsed < 0 || *parsed >= kWords) {
          errors.emplace_back(item.line, "地址 " + *item.operand + " 超出快存");
          continue;
        }
        address = static_cast<int>(*parsed);
      } else if (labelIndex.count(*item.operand)) {
        address = labelIndex[*item.operand];
      } else {
        errors.emplace_back(item.line, "没有标号 " + *item.operand);
        continue;
      }
      if (address < 0 || address >= kWords) {
        errors.emplace_back(item.line, "地址 " + std::to_string(address) + " 超出快存");
        continue;
      }
    }
    mem[addr] = encode(address, *findOp(item.op), item.mod);
    std::string modText = item.mod == 0 ? "" : item.mod == 1 ? ",+" : ",−";
    std::string note = item.op;
    if (item.operand) note += " " + *item.operand;
    note += modText;
    notes[addr] = note;
  }
  if (!errors.empty()) return errorResult(errors);
  if (!entry) return errorResult({{1, "没有可以执行的指令"}});

  std::vector<Json> noteJson;
  for (const auto& note : notes) noteJson.push_back(js(note));
  std::vector<Json> lineJson;
  for (int line : addrToLine) lineJson.push_back(jn(line));
  std::vector<Json> inputJson;
  for (long long value : input) inputJson.push_back(jn(value));
  Json program = jobj({
      {"mem", tritMatrix(mem)},
      {"drum", tritMatrix(drum)},
      {"notes", jarr(std::move(noteJson))},
      {"entry", jn(*entry)},
      {"labels", labelsJson(labels)},
      {"addrToLine", jarr(std::move(lineJson))},
      {"lines", linesJson(lines)},
      {"input", jarr(std::move(inputJson))},
  });
  return jobj({{"ok", jb(true)}, {"program", std::move(program)}});
}
