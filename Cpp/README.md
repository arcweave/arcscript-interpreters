# Arcscript C++ Transpiler

## Prerequisites

- CMake 3.10 or higher
- A C++ compiler that supports C++17 or higher

## Building the Project

### Windows & Linux

1. After generating the ANTLR4 parser files from the top root folder of this repository, run the following commands to build the project:

   ```bash
   mkdir build
   cd build
   cmake ..
   cmake --build .
   ```
2. The generated libraries will be located in the `build/Debug` or `build/Release` directory, depending on your build configuration. The folder also includes the `include` directory with the header files needed to use the transpiler.