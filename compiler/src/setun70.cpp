#include "trit.hpp"

#include <cctype>
#include <map>
#include <optional>
#include <string>
#include <tuple>
#include <vector>

namespace {

constexpr int kTryte = 6;
constexpr int kStack = 18;
constexpr int kPage = 81;
constexpr int kRamPages = 9;
constexpr int kRomPages = 18;
constexpr int kLevel1 = kRamPages + kRomPages;
constexpr int kDrumPages = 243;
constexpr int kRamSlots = kRamPages * kPage;
const int kWindowTrit[3] = {-1, 0, 1};

enum class Op {
  add, sub, mul, neg, store, print, dup, swap, drop, halt, map, loadp, storep,
  jsr, rmc, brt, dow, jmp, sadd, ssub, tdn, lmul, shf
};

struct OpCode {
  Op op;
  int a, b, c;
};

const OpCode kCodes[] = {
    {Op::add, 1, 0, 0},     {Op::sub, 1, 0, -1},    {Op::mul, 1, 0, 1},
    {Op::neg, 1, -1, 0},    {Op::store, 1, -1, -1}, {Op::print, 1, -1, 1},
    {Op::dup, 1, 1, 0},     {Op::swap, 1, 1, -1},   {Op::drop, 1, 1, 1},
    {Op::halt, -1, 0, 0},   {Op::map, -1, 0, -1},   {Op::loadp, -1, 0, 1},
    {Op::storep, -1, 1, 0}, {Op::jsr, 0, 1, 0},     {Op::rmc, -1, 1, 1},
    {Op::brt, -1, 1, -1},   {Op::dow, 0, -1, 1},    {Op::jmp, 0, 0, 1},
    {Op::sadd, -1, -1, 0},  {Op::ssub, -1, -1, 1},  {Op::tdn, 0, 1, 1},
    {Op::lmul, -1, -1, -1}, {Op::shf, 0, -1, -1},
};

Trits opTryte(Op op) {
  for (const auto& code : kCodes) {
    if (code.op == op) return {0, 0, 0, code.a, code.b, code.c};
  }
  return zeros(kTryte);
}

Trits addressTryte(int window, int slot, bool value) {
  Trits offset = mustFromInt(slot - 40, 4);
  return {value ? 1 : -1, kWindowTrit[window], offset[0], offset[1], offset[2], offset[3]};
}

void writeValue(std::vector<Trits>& mem, int addr, long long value) {
  Trits wide = mustFromInt(value, kStack);
  mem[addr] = Trits(wide.begin(), wide.begin() + kTryte);
  mem[addr + 1] = Trits(wide.begin() + kTryte, wide.begin() + 2 * kTryte);
  mem[addr + 2] = Trits(wide.begin() + 2 * kTryte, wide.end());
}

enum class StmtKind { page, win, word, op, mem, imm, call };

struct Stmt {
  StmtKind kind;
  int page = 0;
  int window = 0;
  std::optional<std::string> label;
  long long value = 0;
  Op op = Op::halt;
  bool fetchValue = true;
  std::string text;
  int line = 0;
  std::vector<std::string> targets;
  std::optional<std::string> codeLabel;
};

std::optional<Op> parseOp(const std::string& token) {
  std::string upper = upperAscii(token);
  if (token == "+" || upper == "ADD") return Op::add;
  if (token == "-" || token == "−" || upper == "SUB") return Op::sub;
  if (token == "*" || token == "×" || upper == "MUL") return Op::mul;
  if (upper == "NEG") return Op::neg;
  if (token == "!" || upper == "STORE") return Op::store;
  if (token == "." || upper == "DOT") return Op::print;
  if (upper == "DUP") return Op::dup;
  if (upper == "SWAP") return Op::swap;
  if (upper == "DROP") return Op::drop;
  if (upper == "HALT") return Op::halt;
  if (upper == "RMC") return Op::rmc;
  if (upper == "JMP") return Op::jmp;
  if (token == "S+T") return Op::sadd;
  if (token == "S-T" || token == "S−T") return Op::ssub;
  if (upper == "TDN") return Op::tdn;
  if (token == "L*T") return Op::lmul;
  if (upper == "SHF") return Op::shf;
  if (upper == "MAP") return Op::map;
  if (upper == "LOADP") return Op::loadp;
  if (upper == "STOREP") return Op::storep;
  return std::nullopt;
}

bool validLabel(const std::string& text) {
  if (text.empty() || !(std::isalpha(static_cast<unsigned char>(text[0])) || text[0] == '_')) return false;
  for (char ch : text) {
    if (!(std::isalnum(static_cast<unsigned char>(ch)) || ch == '_')) return false;
  }
  return true;
}

}  // namespace

Json assembleSetun70(const std::string& source) {
  auto lines = splitLines(source);
  std::vector<Stmt> stmts;
  std::vector<std::pair<int, std::string>> errors;
  std::optional<std::string> pending;
  int pendingLine = 0;
  if (trim(source).empty()) errors.emplace_back(1, "程序是空的");

  for (size_t index = 0; index < lines.size(); ++index) {
    int line = static_cast<int>(index + 1);
    std::string text = stripComment(lines[index]);
    if (text.empty()) continue;
    auto tokens = splitWs(text);
    size_t cursor = 0;
    std::optional<std::string> inlineLabel;
    if (!tokens.empty() && tokens[0].back() == ':') {
      inlineLabel = upperAscii(tokens[0].substr(0, tokens[0].size() - 1));
      cursor = 1;
    }
    if (cursor >= tokens.size()) {
      if (!inlineLabel) continue;
      if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 还没落地");
      pending = inlineLabel;
      pendingLine = line;
      continue;
    }
    std::string head = upperAscii(tokens[cursor]);
    if (head == "PAGE" || head == "ORG") {
      if (inlineLabel || pending) errors.emplace_back(line, head + " 不能带标号");
      pending.reset();
      if (cursor + 1 >= tokens.size() || !isDecimal(tokens[cursor + 1])) {
        errors.emplace_back(line, "ОЗУ 页要在 0 到 8");
      } else {
        auto pageValue = tryParseInteger(tokens[cursor + 1]);
        if (!pageValue || *pageValue < 0 || *pageValue >= kRamPages) errors.emplace_back(line, "ОЗУ 页要在 0 到 8");
        else stmts.push_back(Stmt{StmtKind::page, static_cast<int>(*pageValue), 0, std::nullopt, 0, Op::halt, true, "", line});
      }
      continue;
    }
    if (head == "WIN") {
      if (inlineLabel || pending) errors.emplace_back(line, "WIN 不能带标号");
      pending.reset();
      if (cursor + 2 >= tokens.size() || !isDecimal(tokens[cursor + 1]) || !isDecimal(tokens[cursor + 2])) {
        errors.emplace_back(line, "WIN 写成 WIN 窗口 页。窗口是 0、1、2，页是 0 到 26");
      } else {
        auto windowValue = tryParseInteger(tokens[cursor + 1]);
        auto pageValue = tryParseInteger(tokens[cursor + 2]);
        if (!windowValue || !pageValue || *windowValue < 0 || *windowValue > 2 || *pageValue < 0 || *pageValue >= kLevel1) {
          errors.emplace_back(line, "WIN 写成 WIN 窗口 页。窗口是 0、1、2，页是 0 到 26");
        } else {
          stmts.push_back(Stmt{StmtKind::win, static_cast<int>(*pageValue), static_cast<int>(*windowValue), std::nullopt, 0, Op::halt, true, "", line});
        }
      }
      continue;
    }
    if (head == "WORD" || head == ".T") {
      std::optional<std::string> label = inlineLabel ? inlineLabel : pending;
      pending.reset();
      if (cursor + 1 >= tokens.size()) {
        errors.emplace_back(line, "WORD 缺一个数");
        continue;
      }
      auto number = tryParseInteger(tokens[cursor + 1]);
      if (!number || !tryFromInt(*number, kStack)) {
        errors.emplace_back(line, tokens[cursor + 1] + " 放不进三个 трайт");
        continue;
      }
      stmts.push_back(Stmt{StmtKind::word, 0, 0, label, *number, Op::halt, true, text, line});
      continue;
    }
    if (inlineLabel) {
      if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 还没落地");
      pending = inlineLabel;
      pendingLine = line;
    }
    auto stamp = [&]() {
      if (!pending) return;
      stmts.back().codeLabel = *pending;
      pending.reset();
    };
    for (size_t i = cursor; i < tokens.size(); ++i) {
      const std::string& token = tokens[i];
      std::string upper = upperAscii(token);
      bool pointed = token.size() >= 2 && (token[0] == '@' || token[0] == '&') && token[1] >= '0' && token[1] <= '2';
      std::optional<std::string> glued;
      if (pointed && token.size() > 2) {
        if (token.size() > 3 && token[2] == ':') glued = upperAscii(token.substr(3));
        else pointed = false;
      }
      if (pointed && !glued) {
        if (i + 1 >= tokens.size()) {
          errors.emplace_back(line, token + " 后面要有标号");
          continue;
        }
        std::string label = tokens[i + 1];
        if (!label.empty() && label.back() == ',') label.pop_back();
        if (!validLabel(label)) {
          errors.emplace_back(line, token + " 后面要有标号");
          continue;
        }
        stmts.push_back(Stmt{StmtKind::mem, 0, token[1] - '0', upperAscii(label), 0, Op::halt, token[0] == '@', token + " " + label, line});
        stamp();
        i += 1;
        continue;
      }
      if (glued && validLabel(*glued)) {
        stmts.push_back(Stmt{StmtKind::mem, 0, token[1] - '0', *glued, 0, Op::halt, token[0] == '@', token, line});
        stamp();
        continue;
      }
      if (upper == "STOREP" || upper == "LOADP" || upper == "MAP") {
        if (i + 1 >= tokens.size()) {
          errors.emplace_back(line, upper + " 写成 " + upper + " 前,后");
          continue;
        }
        auto comma = tokens[i + 1].find(',');
        std::string spec = tokens[i + 1];
        std::string firstText = comma == std::string::npos ? "" : spec.substr(0, comma);
        std::string secondText = comma == std::string::npos ? "" : spec.substr(comma + 1);
        if (comma == std::string::npos || !isDecimal(firstText) || !isDecimal(secondText)) {
          errors.emplace_back(line, upper + " 写成 " + upper + " 前,后");
          continue;
        }
        auto first = tryParseInteger(firstText);
        auto second = tryParseInteger(secondText);
        if (!first || !second) {
          errors.emplace_back(line, upper + " 写成 " + upper + " 前,后");
          continue;
        }
        if (upper == "MAP") {
          stmts.push_back(Stmt{StmtKind::imm, 0, 0, std::nullopt, *second, Op::halt, true, std::to_string(*second), line});
          stamp();
          stmts.push_back(Stmt{StmtKind::imm, 0, 0, std::nullopt, *first, Op::halt, true, std::to_string(*first), line});
        } else {
          stmts.push_back(Stmt{StmtKind::imm, 0, 0, std::nullopt, *first, Op::halt, true, std::to_string(*first), line});
          stamp();
          stmts.push_back(Stmt{StmtKind::imm, 0, 0, std::nullopt, *second, Op::halt, true, std::to_string(*second), line});
        }
        Op which = upper == "MAP" ? Op::map : upper == "LOADP" ? Op::loadp : Op::storep;
        stmts.push_back(Stmt{StmtKind::op, 0, 0, std::nullopt, 0, which, true, upper + " " + spec, line});
        i += 1;
        continue;
      }
      if (upper == "JSR" || upper == "DOW" || upper == "BRT") {
        if (i + 1 >= tokens.size()) {
          errors.emplace_back(line, upper == "BRT" ? "BRT 要写三个标号" : upper + " 要写一个标号");
          continue;
        }
        std::vector<std::string> targets;
        std::string piece;
        for (char ch : tokens[i + 1] + ",") {
          if (ch == ',') {
            if (!trim(piece).empty()) targets.push_back(upperAscii(trim(piece)));
            piece.clear();
          } else piece.push_back(ch);
        }
        size_t expect = upper == "BRT" ? 3 : 1;
        bool namesOk = targets.size() == expect;
        for (const auto& name : targets) namesOk = namesOk && validLabel(name);
        if (!namesOk) errors.emplace_back(line, upper == "BRT" ? "BRT 要写三个标号" : upper + " 要写一个标号");
        else {
          Stmt stmt;
          stmt.kind = StmtKind::call;
          stmt.op = upper == "JSR" ? Op::jsr : upper == "DOW" ? Op::dow : Op::brt;
          stmt.text = upper + " " + tokens[i + 1];
          stmt.line = line;
          stmt.targets = targets;
          stmts.push_back(stmt);
          stamp();
        }
        i += 1;
        continue;
      }
      if (auto op = parseOp(token)) {
        stmts.push_back(Stmt{StmtKind::op, 0, 0, std::nullopt, 0, *op, true, token, line});
        stamp();
        continue;
      }
      std::string rawNumber = !token.empty() && token[0] == '#' ? token.substr(1) : token;
      auto number = tryParseInteger(rawNumber);
      if ((isDecimal(token) || (!token.empty() && token[0] == '#' && isDecimal(rawNumber))) && number && tryFromInt(*number, kStack)) {
        stmts.push_back(Stmt{StmtKind::imm, 0, 0, std::nullopt, *number, Op::halt, true, token, line});
        stamp();
        continue;
      }
      if (!token.empty() && token[0] == '#' && !isDecimal(rawNumber)) {
        errors.emplace_back(line, token + " 放不进三个 трайт");
        continue;
      }
      if (isDecimal(token) || (!token.empty() && token[0] == '#')) {
        errors.emplace_back(line, token + " 放不进三个 трайт");
        continue;
      }
      errors.emplace_back(line, "看不懂 " + token);
    }
  }
  if (pending) errors.emplace_back(pendingLine, "标号 " + *pending + " 没有落地");
  if (!errors.empty()) return errorResult(errors);

  std::vector<std::pair<std::string, long long>> labels;
  std::map<std::string, int> labelAt;
  std::vector<std::tuple<int, std::string, int>> callPatches;
  std::vector<Trits> mem(kRamSlots, zeros(kTryte));
  std::vector<std::string> notes(kRamSlots);
  std::vector<int> addrToLine(kRamSlots, -1);
  int windows[3] = {0, 1, 2};
  int poolTop[kRamPages];
  for (int i = 0; i < kRamPages; ++i) poolTop[i] = kPage;
  int cursor = 0;
  std::optional<int> entry;

  auto pageOf = [](int addr) { return addr / kPage; };
  auto noteCode = [&](const Stmt& stmt) {
    if (!stmt.codeLabel) return;
    if (!validLabel(*stmt.codeLabel)) errors.emplace_back(stmt.line, "标号 " + *stmt.codeLabel + " 不合法");
    else if (labelAt.count(*stmt.codeLabel)) errors.emplace_back(stmt.line, "标号 " + *stmt.codeLabel + " 重复了");
    else {
      labelAt[*stmt.codeLabel] = cursor;
      labels.emplace_back(*stmt.codeLabel, cursor);
    }
  };
  auto occupy = [&](int addr, const Trits& tryte, const std::string& note, int line) {
    int page = pageOf(addr);
    int slot = addr % kPage;
    if (page < 0 || page >= kRamPages) {
      errors.emplace_back(line, "写到了 ОЗУ 外面");
      return;
    }
    if (slot >= poolTop[page] || !notes[addr].empty()) {
      errors.emplace_back(line, "第 " + std::to_string(page) + " 页第 " + std::to_string(slot) + " 槽叠在一起了");
      return;
    }
    mem[addr] = tryte;
    notes[addr] = note;
    addrToLine[addr] = line;
  };
  auto allocPool = [&](int page, int line) -> std::optional<int> {
    if (poolTop[page] < 3) {
      errors.emplace_back(line, "第 " + std::to_string(page) + " 页放不下三个 трайт 的常数");
      return std::nullopt;
    }
    poolTop[page] -= 3;
    return page * kPage + poolTop[page];
  };

  for (const auto& stmt : stmts) {
    if (stmt.kind == StmtKind::page) {
      cursor = stmt.page * kPage;
      continue;
    }
    if (stmt.kind == StmtKind::win) {
      windows[stmt.window] = stmt.page;
      continue;
    }
    if (stmt.kind == StmtKind::word) {
      if (stmt.label) {
        if (!validLabel(*stmt.label)) errors.emplace_back(stmt.line, "标号 " + *stmt.label + " 不合法");
        else if (labelAt.count(*stmt.label)) errors.emplace_back(stmt.line, "标号 " + *stmt.label + " 重复了");
        else {
          labelAt[*stmt.label] = cursor;
          labels.emplace_back(*stmt.label, cursor);
        }
      }
      if (cursor % kPage > kPage - 3) {
        errors.emplace_back(stmt.line, "三个 трайт 跨过了页边界");
        cursor += 3;
        continue;
      }
      writeValue(mem, cursor, stmt.value);
      notes[cursor] = "整数 " + std::to_string(stmt.value);
      notes[cursor + 1] = "续";
      notes[cursor + 2] = "续";
      addrToLine[cursor] = addrToLine[cursor + 1] = addrToLine[cursor + 2] = stmt.line;
      cursor += 3;
      continue;
    }
    if (stmt.kind == StmtKind::imm) {
      auto slot = allocPool(pageOf(cursor), stmt.line);
      if (!slot) continue;
      writeValue(mem, *slot, stmt.value);
      notes[*slot] = "字面量 " + std::to_string(stmt.value);
      notes[*slot + 1] = "续";
      notes[*slot + 2] = "续";
      addrToLine[*slot] = stmt.line;
      if (!entry) entry = cursor;
      noteCode(stmt);
      occupy(cursor, addressTryte(0, *slot % kPage, true), "取字面量 " + std::to_string(stmt.value), stmt.line);
      cursor += 1;
      continue;
    }
    if (!entry) entry = cursor;
    if (stmt.kind == StmtKind::op || stmt.kind == StmtKind::call) {
      noteCode(stmt);
      occupy(cursor, opTryte(stmt.op), stmt.text, stmt.line);
      cursor += 1;
      if (stmt.kind == StmtKind::call) {
        for (const auto& name : stmt.targets) {
          callPatches.push_back({cursor, name, stmt.line});
          occupy(cursor, zeros(kTryte), name, stmt.line);
          cursor += 1;
        }
      }
      continue;
    }
    noteCode(stmt);
    occupy(cursor, zeros(kTryte), stmt.text, stmt.line);
    cursor += 1;
  }
  for (const auto& [addr, name, line] : callPatches) {
    auto found = labelAt.find(name);
    if (found == labelAt.end()) errors.emplace_back(line, "没有标号 " + name);
    else {
      int page = found->second / kPage;
      int slot = found->second % kPage;
      Trits packed = mustFromInt(page - 4, 2);
      Trits offset = mustFromInt(slot - 40, 4);
      packed.insert(packed.end(), offset.begin(), offset.end());
      mem[addr] = packed;
    }
  }
  if (!errors.empty()) return errorResult(errors);

  cursor = 0;
  std::vector<std::pair<int, Stmt>> patches;
  for (const auto& stmt : stmts) {
    if (stmt.kind == StmtKind::page) cursor = stmt.page * kPage;
    else if (stmt.kind == StmtKind::word) cursor += 3;
    else if (stmt.kind == StmtKind::win) continue;
    else if (stmt.kind == StmtKind::mem) {
      patches.push_back({cursor, stmt});
      cursor += 1;
    } else if (stmt.kind == StmtKind::call) {
      cursor += 1 + static_cast<int>(stmt.targets.size());
    } else {
      cursor += 1;
    }
  }
  for (const auto& [addr, stmt] : patches) {
    auto found = labelAt.find(stmt.label.value_or(""));
    if (found == labelAt.end()) {
      errors.emplace_back(stmt.line, "没有标号 " + stmt.label.value_or(""));
      continue;
    }
    mem[addr] = addressTryte(stmt.window, found->second % kPage, stmt.fetchValue);
    notes[addr] = stmt.text;
  }
  if (!errors.empty()) return errorResult(errors);
  if (!entry) return errorResult({{1, "没有可以执行的音节"}});

  std::vector<Json> noteJson;
  for (const auto& note : notes) noteJson.push_back(js(note));
  std::vector<Json> lineJson;
  for (int line : addrToLine) lineJson.push_back(jn(line));
  Json program = jobj({
      {"mem", tritMatrix(mem)},
      {"notes", jarr(std::move(noteJson))},
      {"windows", jarr({jn(windows[0]), jn(windows[1]), jn(windows[2])})},
      {"entry", jn(*entry)},
      {"labels", labelsJson(labels)},
      {"lines", linesJson(lines)},
      {"addrToLine", jarr(std::move(lineJson))},
  });
  return jobj({{"ok", jb(true)}, {"program", std::move(program)}});
}
