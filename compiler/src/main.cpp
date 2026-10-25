#include "assemble.hpp"
#include "json.hpp"
#include "trit.hpp"

#include <iostream>
#include <string>

Json assembleSetun(const std::string& source);
Json assembleSetun70(const std::string& source);
Json assembleEniac(const std::string& source);
Json assemble650(const std::string& source);
Json assemble1401(const std::string& source);

Json assembleMachine(const std::string& machine, const std::string& source) {
  if (machine == "setun") return assembleSetun(source);
  if (machine == "setun70") return assembleSetun70(source);
  if (machine == "eniac") return assembleEniac(source);
  if (machine == "ibm650") return assemble650(source);
  if (machine == "ibm1401") return assemble1401(source);
  return errorResult({{1, "没有这种机器"}});
}

int main(int argc, char** argv) {
  if (argc == 3 && std::string(argv[1]) == "assemble") {
    std::string source((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
    std::cout << assembleMachine(argv[2], source).dump();
    return 0;
  }
  std::cerr << "用法: radixcc assemble <setun|setun70|eniac|ibm650|ibm1401>\n";
  return 2;
}
