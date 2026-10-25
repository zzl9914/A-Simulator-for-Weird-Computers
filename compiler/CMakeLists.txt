cmake_minimum_required(VERSION 3.16)
set(CMAKE_CXX_COMPILER g++ CACHE STRING "" FORCE)
project(radixcc LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(radixcc
  src/main.cpp
  src/trit.cpp
  src/setun.cpp
  src/setun70.cpp
  src/eniac.cpp
  src/ibm650.cpp
  src/ibm1401.cpp
)
target_include_directories(radixcc PRIVATE src)
