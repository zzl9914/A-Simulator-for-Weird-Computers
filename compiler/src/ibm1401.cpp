#include "trit.hpp"

#include <cctype>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace {

constexpr int kCells = 1400;

struct Cell {
  std::optional<int> digit;
  std::string zone = "none";
  bool wm = false;
  std::optional<std::string> literal;
};

Json cellJson(const Cell& cell) {
  return jobj({
      {"digit", cell.digit ? jn(*cell.digit) : Json::nul()},
      {"zone", js(cell.zone)},
      {"wm", jb(cell.wm)},
      {"literal", cell.literal ? js(*cell.literal) : Json::nul()},
  });
}

int aZoneDigit(const std::string& glyph) {
  if (glyph == "‡") return 0;
  if (glyph == "/") return 1;
  if (glyph.size() == 1 && glyph[0] >= 'S' && glyph[0] <= 'Z') return glyph[0] - 'S' + 2;
  return -1;
}

std::string glyphOf(const Cell& cell) {
  if (cell.literal) return *cell.literal;
  if (!cell.digit) return " ";
  int digit = *cell.digit;
  if (cell.zone == "none") return std::to_string(digit);
  if (cell.zone == "ab") return digit == 0 ? "&" : std::string(1, static_cast<char>('A' + digit - 1));
  if (cell.zone == "b") return digit == 0 ? "-" : std::string(1, static_cast<char>('J' + digit - 1));
  if (digit == 0) return "‡";
  if (digit == 1) return "/";
  return std::string(1, static_cast<char>('S' + digit - 2));
}

Cell charCell(const std::string& glyph, bool wm) {
  Cell cell;
  cell.wm = wm;
  if (glyph.size() == 1 && std::isdigit(static_cast<unsigned char>(glyph[0]))) {
    cell.digit = glyph[0] - '0';
    return cell;
  }
  int zoned = aZoneDigit(glyph);
  if (zoned >= 0) {
    cell.digit = zoned;
    cell.zone = "a";
    return cell;
  }
  cell.literal = glyph;
  return cell;
}

std::vector<std::string> addressGlyphs(int value) {
  int thousands = value / 1000;
  int rest = value % 1000;
  int hundreds = rest / 100;
  int tens = (rest % 100) / 10;
  int units = rest % 10;
  Cell headCell;
  headCell.digit = hundreds;
  headCell.zone = "a";
  std::string head = thousands == 0 ? std::to_string(hundreds) : glyphOf(headCell);
  return {head, std::to_string(tens), std::to_string(units)};
}

std::string stripDecimal(const std::string& line) {
  bool at = false;
  for (size_t i = 0; i < line.size(); ++i) {
    if (line[i] == '@') at = !at;
    if (line[i] == ';' && !at) return line.substr(0, i);
  }
  return line;
}

std::vector<std::string> tokenize(const std::string& input, std::string& error) {
  std::vector<std::string> tokens;
  for (size_t i = 0; i < input.size();) {
    if (std::isspace(static_cast<unsigned char>(input[i]))) {
      ++i;
      continue;
    }
    if (input[i] == '@') {
      auto end = input.find('@', i + 1);
      if (end == std::string::npos) {
        error = "常数以 @ 开头，却没有收尾的 @";
        return {};
      }
      tokens.push_back(input.substr(i, end - i + 1));
      i = end + 1;
      continue;
    }
    size_t j = i;
    while (j < input.size() && !std::isspace(static_cast<unsigned char>(input[j]))) ++j;
    tokens.push_back(input.substr(i, j - i));
    i = j;
  }
  return tokens;
}

bool stringChars(const std::string& body) {
  for (char ch : body) {
    if (std::string("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 =+-*/.,$&%?!").find(ch) == std::string::npos) return false;
  }
  return true;
}

std::vector<Cell> constantCells(const std::string& token, bool wordMark, std::string& error) {
  if (!token.empty() && token.front() == '@') {
    std::string body = upperAscii(token.substr(1, token.size() - 2));
    if (body.empty()) {
      error = "空的字符常数";
      return {};
    }
    if (!stringChars(body)) {
      error = "打印链上没有这些字符：" + body;
      return {};
    }
    std::vector<Cell> cells;
    for (char ch : body) cells.push_back(charCell(std::string(1, ch), false));
    if (wordMark) cells.front().wm = true;
    return cells;
  }
  if (!isDecimal(token)) {
    error = "看不懂常数 " + token;
    return {};
  }
  bool negative = token[0] == '-';
  bool positive = token[0] == '+';
  std::string digits = (positive || negative) ? token.substr(1) : token;
  if (digits.empty() || digits.size() > 12) {
    error = "数字段要在 1 到 12 位";
    return {};
  }
  std::vector<Cell> cells;
  for (char ch : digits) {
    Cell cell;
    cell.digit = ch - '0';
    cells.push_back(cell);
  }
  if (negative) cells.back().zone = "b";
  else if (positive) cells.back().zone = "ab";
  if (wordMark) cells.front().wm = true;
  return cells;
}

struct OpSpec {
  std::string name;
  std::string glyph;
  std::string kind;
  std::string dchar;
};

const OpSpec kOps[] = {
    {"A", "A", "ab", ""},     {"S", "S", "ab", ""},     {"ZA", "?", "ab", ""},
    {"ZS", "!", "ab", ""},    {"MCW", "M", "ab", ""},   {"LCA", "L", "ab", ""},
    {"C", "C", "ab", ""},     {"B", "B", "branch", ""}, {"BE", "B", "branch", "S"},
    {"BH", "B", "branch", "U"}, {"BL", "B", "branch", "T"}, {"BU", "B", "branch", "/"},
    {"BAV", "B", "branch", "Z"}, {"H", ".", "none", ""}, {"W", "2", "none", ""},
    {"SW", ",", "sw", ""},    {"CW", ")", "cw", ""},    {"NOP", "N", "none", ""},
    {"MN", "D", "ab", ""},    {"MZ", "Y", "ab", ""},    {"MCS", "Z", "ab", ""},
    {"MCE", "E", "ab", ""},   {"MUL", "@", "ab", ""},   {"DIV", "%", "ab", ""},
    {"MA", "#", "ab", ""},    {"CS", "/", "cs", ""},    {"SAR", "Q", "one", ""},
    {"SBR", "H", "one", ""},  {"R", "1", "none", ""},   {"WR", "3", "none", ""},
    {"P", "4", "none", ""},   {"RP", "5", "none", ""},  {"WP", "6", "none", ""},
    {"WRP", "7", "none", ""}, {"BCE", "B", "bce", ""},  {"BLC", "B", "branch", "A"},
    {"BSS", "B", "bss", ""},
};

const OpSpec* findOp(const std::string& name) {
  for (const auto& op : kOps) if (op.name == name) return &op;
  return nullptr;
}

bool isDirective(const std::string& name) {
  return name == "ORG" || name == "END" || name == "DCW" || name == "DC" || name == "DS" || name == "CARD" || name == "SWON";
}

int instructionWidth(const OpSpec& spec, size_t operands) {
  if (spec.kind == "none") return 1;
  if (spec.kind == "ab") return 7;
  if (spec.kind == "branch") return spec.dchar.empty() ? 4 : 5;
  if (spec.kind == "one") return 4;
  if (spec.kind == "bce") return 8;
  if (spec.kind == "bss") return 5;
  if (spec.kind == "cs" || spec.kind == "cw") return operands == 2 ? 7 : 4;
  return operands == 2 ? 7 : 4;
}

enum class StmtKind { org, end, data, ins };

struct Stmt {
  StmtKind kind;
  int addr = 0;
  std::optional<std::string> entry;
  std::optional<std::string> label;
  std::vector<Cell> cells;
  const OpSpec* spec = nullptr;
  std::vector<std::string> operands;
  int width = 0;
  int line = 0;
};

std::string pad3(int value) {
  std::string text = std::to_string(value);
  if (text.size() < 3) text.insert(text.begin(), 3 - text.size(), '0');
  return text;
}

}  // namespace

Json assemble1401(const std::string& source) {
  auto lines = splitLines(source);
  std::vector<Stmt> stmts;
  std::vector<std::string> cards;
  std::string switches;
  std::vector<std::pair<int, std::string>> errors;
  std::optional<std::string> pending;
  int pendingLine = 0;
  if (trim(source).empty()) errors.emplace_back(1, "程序是空的");

  for (size_t index = 0; index < lines.size(); ++index) {
    int line = static_cast<int>(index + 1);
    std::string stripped = trim(stripDecimal(lines[index]));
    if (stripped.empty() || stripped[0] == '*') continue;
    std::string tokenError;
    auto tokens = tokenize(stripped, tokenError);
    if (!tokenError.empty()) {
      errors.emplace_back(line, tokenError);
      continue;
    }
    size_t cursor = 0;
    std::optional<std::string> inlineLabel;
    if (!tokens.empty() && tokens[0].back() == ':') {
      inlineLabel = tokens[0].substr(0, tokens[0].size() - 1);
      cursor = 1;
    }
    if (cursor >= tokens.size()) {
      if (!inlineLabel) continue;
      if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 悬空了");
      pending = inlineLabel;
      pendingLine = line;
      continue;
    }
    if (!inlineLabel && tokens.size() >= 2) {
      std::string second = upperAscii(tokens[1]);
      if (findOp(second) || isDirective(second)) {
        inlineLabel = tokens[0];
        cursor = 1;
      }
    }
    if (inlineLabel && pending) {
      errors.emplace_back(line, "标号 " + *pending + " 还没落地");
      pending.reset();
    }
    std::optional<std::string> label;
    if (inlineLabel) label = upperAscii(*inlineLabel);
    else if (pending) label = upperAscii(*pending);
    pending.reset();
    std::string op = upperAscii(tokens[cursor]);
    std::string blob;
    for (size_t i = cursor + 1; i < tokens.size(); ++i) blob += tokens[i];
    std::vector<std::string> operands;
    std::string part;
    for (char ch : blob) {
      if (ch == ',') {
        if (!trim(part).empty()) operands.push_back(trim(part));
        part.clear();
      } else {
        part.push_back(ch);
      }
    }
    if (!trim(part).empty()) operands.push_back(trim(part));

    if (op == "ORG") {
      if (label) errors.emplace_back(line, "ORG 不能带标号");
      else if (operands.empty() || !isDecimal(operands[0]) || operands[0][0] == '+' || operands[0][0] == '-') {
        errors.emplace_back(line, "ORG 超出 0–1399");
      } else {
        int addr = std::stoi(operands[0]);
        if (addr < 0 || addr >= kCells) errors.emplace_back(line, "ORG 超出 0–1399");
        else stmts.push_back(Stmt{StmtKind::org, addr, std::nullopt, std::nullopt, {}, nullptr, {}, 0, line});
      }
      continue;
    }
    if (op == "END") {
      Stmt stmt{StmtKind::end, 0, std::nullopt, std::nullopt, {}, nullptr, {}, 0, line};
      if (!operands.empty()) stmt.entry = upperAscii(operands[0]);
      stmts.push_back(stmt);
      continue;
    }
    if (op == "DS") {
      if (operands.empty() || !isDecimal(operands[0])) {
        errors.emplace_back(line, "DS 的长度要在 1 到 40");
        continue;
      }
      int count = std::stoi(operands[0]);
      if (count < 1 || count > 40) {
        errors.emplace_back(line, "DS 的长度要在 1 到 40");
        continue;
      }
      std::vector<Cell> cells(count);
      cells[0].wm = true;
      stmts.push_back(Stmt{StmtKind::data, 0, std::nullopt, label, cells, nullptr, {}, 0, line});
      continue;
    }
    if (op == "CARD") {
      std::string body = operands.empty() ? "" : operands[0];
      if (body.size() >= 2 && body.front() == '@' && body.back() == '@') body = body.substr(1, body.size() - 2);
      if (body.empty()) errors.emplace_back(line, "CARD 需要一串字符，写在一对 @ 里面");
      else {
        for (char& ch : body) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
        if (body.size() < 80) body.append(80 - body.size(), ' ');
        if (body.size() > 80) body.resize(80);
        cards.push_back(body);
      }
      continue;
    }
    if (op == "SWON") {
      std::string letter = operands.empty() ? "" : upperAscii(operands[0]);
      if (letter.size() != 1 || letter[0] < 'B' || letter[0] > 'G') errors.emplace_back(line, "SWON 的开关是 B 到 G");
      else switches.push_back(letter[0]);
      continue;
    }
    if (op == "DCW" || op == "DC") {
      if (operands.size() != 1) {
        errors.emplace_back(line, op + " 需要一个常数");
        continue;
      }
      std::string error;
      auto cells = constantCells(operands[0], op == "DCW", error);
      if (!error.empty()) {
        errors.emplace_back(line, error);
        continue;
      }
      stmts.push_back(Stmt{StmtKind::data, 0, std::nullopt, label, cells, nullptr, {}, 0, line});
      continue;
    }
    const OpSpec* spec = findOp(op);
    if (!spec) {
      errors.emplace_back(line, "不认识的操作 " + tokens[cursor]);
      continue;
    }
    if (spec->kind == "none" && !operands.empty()) errors.emplace_back(line, op + " 不带地址");
    else if (spec->kind == "ab" && operands.size() != 2) errors.emplace_back(line, op + " 需要 A、B 两个地址");
    else if (spec->kind == "branch" && operands.size() != 1) errors.emplace_back(line, op + " 需要一个转移地址");
    else if ((spec->kind == "sw" || spec->kind == "cw") && (operands.empty() || operands.size() > 2)) errors.emplace_back(line, op + " 需要一或两个地址");
    else if (spec->kind == "cs" && (operands.empty() || operands.size() > 2)) errors.emplace_back(line, "CS 需要一或两个地址");
    else if (spec->kind == "one" && operands.size() != 1) errors.emplace_back(line, op + " 需要一个地址");
    else if (spec->kind == "bce" && (operands.size() != 3 || operands[2].size() != 1)) errors.emplace_back(line, "BCE 要写转移地址、比较地址和一个字符");
    else if (spec->kind == "bss" && (operands.size() != 2 || operands[1].size() != 1 || upperAscii(operands[1])[0] < 'B' || upperAscii(operands[1])[0] > 'G')) {
      errors.emplace_back(line, "BSS 要写转移地址和开关 B–G");
    }
    else {
      std::vector<std::string> upperOperands;
      for (const auto& operand : operands) upperOperands.push_back(upperAscii(operand));
      stmts.push_back(Stmt{StmtKind::ins, 0, std::nullopt, label, {}, spec, upperOperands, instructionWidth(*spec, upperOperands.size()), line});
    }
  }
  if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 没有落地");
  if (!errors.empty()) return errorResult(errors);

  struct Placed {
    int addr;
    Stmt stmt;
  };
  std::vector<std::pair<std::string, std::pair<long long, std::string>>> labels;
  std::map<std::string, std::pair<int, std::string>> labelAt;
  std::vector<Placed> placed;
  int cursor = 0;
  for (const auto& stmt : stmts) {
    if (stmt.kind == StmtKind::org) {
      cursor = stmt.addr;
      continue;
    }
    if (stmt.kind == StmtKind::end) continue;
    int width = stmt.kind == StmtKind::data ? static_cast<int>(stmt.cells.size()) : stmt.width;
    if (cursor + width > kCells) {
      errors.emplace_back(stmt.line, "程序超出 " + std::to_string(kCells) + " 个字符");
      break;
    }
    if (stmt.label) {
      if (stmt.label->empty() || !std::isalpha(static_cast<unsigned char>((*stmt.label)[0])) || stmt.label->size() > 12) {
        errors.emplace_back(stmt.line, "标号 " + *stmt.label + " 不合法");
      } else {
        bool ok = true;
        for (char ch : *stmt.label) {
          if (!(std::isalnum(static_cast<unsigned char>(ch)))) ok = false;
        }
        if (!ok) errors.emplace_back(stmt.line, "标号 " + *stmt.label + " 不合法");
        else if (labelAt.count(*stmt.label)) errors.emplace_back(stmt.line, "标号 " + *stmt.label + " 重复了");
        else {
          int addr = stmt.kind == StmtKind::data ? cursor + width - 1 : cursor;
          std::string kind = stmt.kind == StmtKind::ins ? "code" : "data";
          labelAt[*stmt.label] = {addr, kind};
          labels.push_back({*stmt.label, {addr, kind}});
        }
      }
    }
    placed.push_back({cursor, stmt});
    cursor += width;
  }
  int endCount = 0;
  const Stmt* end = nullptr;
  for (const auto& stmt : stmts) {
    if (stmt.kind == StmtKind::end) {
      endCount += 1;
      if (endCount == 2) errors.emplace_back(stmt.line, "END 只能有一个");
      if (!end) end = &stmt;
    }
  }
  if (!errors.empty()) return errorResult(errors);

  std::vector<Cell> mem(kCells);
  std::vector<int> addrToLine(kCells, -1);
  std::vector<bool> occupied(kCells, false);
  auto resolve = [&](const std::string& token, int line) -> std::optional<int> {
    if (isDecimal(token) && token[0] != '+' && token[0] != '-') {
      int value = std::stoi(token);
      if (value >= kCells) {
        errors.emplace_back(line, "地址 " + token + " 超出内存");
        return std::nullopt;
      }
      return value;
    }
    auto found = labelAt.find(token);
    if (found == labelAt.end()) {
      errors.emplace_back(line, "没有标号 " + token);
      return std::nullopt;
    }
    return found->second.first;
  };
  auto writeCell = [&](int addr, const Cell& cell, int line) {
    if (occupied[addr]) errors.emplace_back(line, "地址 " + pad3(addr) + " 被写了两次");
    occupied[addr] = true;
    mem[addr] = cell;
    addrToLine[addr] = line;
  };
  for (const auto& item : placed) {
    if (item.stmt.kind == StmtKind::data) {
      for (size_t offset = 0; offset < item.stmt.cells.size(); ++offset) {
        writeCell(item.addr + static_cast<int>(offset), item.stmt.cells[offset], item.stmt.line);
      }
      continue;
    }
    if (item.stmt.kind != StmtKind::ins) continue;
    std::vector<std::string> chars = {item.stmt.spec->glyph};
    if (item.stmt.spec->kind != "none") {
      const auto& operands = item.stmt.operands;
      size_t addressCount = operands.size();
      if (item.stmt.spec->kind == "bce") addressCount = 2;
      if (item.stmt.spec->kind == "bss") addressCount = 1;
      for (size_t i = 0; i < addressCount && i < operands.size(); ++i) {
        auto resolved = resolve(operands[i], item.stmt.line);
        if (!resolved) continue;
        auto glyphs = addressGlyphs(*resolved);
        chars.insert(chars.end(), glyphs.begin(), glyphs.end());
      }
      if (!item.stmt.spec->dchar.empty()) chars.push_back(item.stmt.spec->dchar);
      if (item.stmt.spec->kind == "bce" && operands.size() == 3) chars.push_back(upperAscii(operands[2]));
      if (item.stmt.spec->kind == "bss" && operands.size() == 2) chars.push_back(upperAscii(operands[1]));
    }
    for (size_t offset = 0; offset < chars.size(); ++offset) {
      writeCell(item.addr + static_cast<int>(offset), charCell(chars[offset], offset == 0), item.stmt.line);
    }
  }
  if (!errors.empty()) return errorResult(errors);

  std::optional<int> entry;
  if (end && end->entry) {
    auto found = labelAt.find(*end->entry);
    if (found == labelAt.end()) errors.emplace_back(end->line, "END 找不到 " + *end->entry);
    else entry = found->second.first;
  } else {
    for (const auto& item : placed) {
      if (item.stmt.kind == StmtKind::ins) {
        entry = item.addr;
        break;
      }
    }
  }
  if (!errors.empty()) return errorResult(errors);
  if (!entry) return errorResult({{1, "没有可以执行的指令"}});

  std::vector<Json> memJson;
  for (const auto& cell : mem) memJson.push_back(cellJson(cell));
  std::vector<Json> lineJson;
  for (int line : addrToLine) lineJson.push_back(jn(line));
  std::vector<Json> cardJson;
  for (const auto& card : cards) cardJson.push_back(js(card));
  std::vector<std::pair<std::string, Json>> labelFields;
  for (const auto& [name, meta] : labels) {
    labelFields.emplace_back(name, jobj({{"addr", jn(meta.first)}, {"kind", js(meta.second)}}));
  }
  return jobj({
      {"ok", jb(true)},
      {"program", jobj({{"mem", jarr(std::move(memJson))},
                        {"entry", jn(*entry)},
                        {"labels", jobj(std::move(labelFields))},
                        {"addrToLine", jarr(std::move(lineJson))},
                        {"lines", linesJson(lines)},
                        {"cards", jarr(std::move(cardJson))},
                        {"switches", js(switches)}})},
  });
}
