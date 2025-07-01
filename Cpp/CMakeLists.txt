# minimum required CMAKE version
CMAKE_MINIMUM_REQUIRED(VERSION 3.10 FATAL_ERROR)

set(PROJECT_VERSION "0.1.0")
project(ArcscriptTranspiler VERSION ${PROJECT_VERSION})

list(APPEND CMAKE_MODULE_PATH ${CMAKE_CURRENT_SOURCE_DIR}/cmake)
message(CMAKE_CXX_COMPILER_ID=${CMAKE_CXX_COMPILER_ID})

message(STATUS "Generator: ${CMAKE_GENERATOR}")
message(STATUS "CMAKE_BUILD_TYPE: ${CMAKE_BUILD_TYPE}")
message(STATUS "CMAKE_CONFIGURATION_TYPES: ${CMAKE_CONFIGURATION_TYPES}")

# compiler must be 17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)
# required if linking to static library
#add_definitions(-DANTLR4CPP_STATIC)

# using /MD flag for antlr4_runtime (for Visual C++ compilers only)
set(ANTLR4_WITH_STATIC_CRT OFF)

# Specify the version of the antlr4 library needed for this project.
# By default the latest version of antlr4 will be used.  You can specify a
# specific, stable version by setting a repository tag value or a link
# to a zip file containing the libary source.
 set(ANTLR4_TAG 4.13.1)
# set(ANTLR4_ZIP_REPOSITORY https://github.com/antlr/antlr4/archive/refs/tags/4.13.2.zip)

# add external build for antlrcpp
include(ExternalAntlr4Cpp)
# add antlr4cpp artifacts to project environment
include_directories(${ANTLR4_INCLUDE_DIRS})

## set variable pointing to the antlr tool that supports C++
## this is not required if the jar file can be found under PATH environment
#set(ANTLR_EXECUTABLE /home/user/antlr-4.13.2-complete.jar)
## add macros to generate ANTLR Cpp code from grammar
#find_package(ANTLR REQUIRED)
#
## Call macro to add lexer and grammar to your build dependencies.
#antlr_target(SampleGrammarLexer TLexer.g4 LEXER
#        PACKAGE antlrcpptest)
#antlr_target(SampleGrammarParser TParser.g4 PARSER
#        PACKAGE antlrcpptest
#        DEPENDS_ANTLR SampleGrammarLexer
#        COMPILE_FLAGS -lib ${ANTLR_SampleGrammarLexer_OUTPUT_DIR})

# include generated files in project environment
#include_directories(${ANTLR_SampleGrammarLexer_OUTPUT_DIR})
#include_directories(${ANTLR_SampleGrammarParser_OUTPUT_DIR})

include_directories(src/Generated/ArcscriptLexer)
include_directories(src/Generated/ArcscriptParser)
include_directories(src)
# add generated grammar to demo binary target
#add_executable(demo main.cpp
#        src/Generated/ArcscriptLexer
#        src/Generated/ArcscriptParser)

add_library(ArcscriptTranspiler SHARED)

target_sources(ArcscriptTranspiler PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptTranspiler.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptParserBase.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptVisitor.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptOutputs.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptFunctions.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptExpression.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptErrorListener.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/Generated/ArcscriptLexer/ArcscriptLexer.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/Generated/ArcscriptParser/ArcscriptParser.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/Generated/ArcscriptParser/ArcscriptParserBaseVisitor.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/Generated/ArcscriptParser/ArcscriptParserVisitor.cpp
)

target_sources(ArcscriptTranspiler PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptTranspiler.h)

set_target_properties(ArcscriptTranspiler PROPERTIES
        VERSION ${PROJECT_VERSION}
        SOVERSION ${PROJECT_VERSION}
)

set(ARCSCRIPT_INCLUDE_HEADERS
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptTranspiler.h
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptHelpers.h
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptErrorExceptions.h
        ${CMAKE_CURRENT_SOURCE_DIR}/src/ArcscriptOutputs.h
)

if (CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    # For MSVC, we need to link against the shared library
    target_compile_options(ArcscriptTranspiler PRIVATE -Wall -Wextra)
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
    # For other compilers, we can link against the static library
    target_compile_definitions(ArcscriptTranspiler PRIVATE WIN_EXPORT)
endif()

target_link_libraries(ArcscriptTranspiler PRIVATE antlr4_shared)

add_custom_command(TARGET ArcscriptTranspiler POST_BUILD
        COMMAND ${CMAKE_COMMAND}
            -E copy ${ANTLR4_RUNTIME_LIBRARIES} "$<TARGET_FILE_DIR:ArcscriptTranspiler>"
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})

if (NOT EXISTS "$<TARGET_FILE_DIR:ArcscriptTranspiler>/include")
    add_custom_command(TARGET ArcscriptTranspiler POST_BUILD
            COMMAND ${CMAKE_COMMAND}
            -E make_directory "$<TARGET_FILE_DIR:ArcscriptTranspiler>/include")
endif()

add_custom_command(TARGET ArcscriptTranspiler POST_BUILD
        COMMAND ${CMAKE_COMMAND}
        -E copy ${ARCSCRIPT_INCLUDE_HEADERS} "$<TARGET_FILE_DIR:ArcscriptTranspiler>/include"
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})

if (WITH_DEMO)
    add_executable(ArcscriptTest ${CMAKE_CURRENT_SOURCE_DIR}/demo/ArcscriptTest.cpp)

    include(FetchContent)
    FetchContent_Declare(json URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz)
    FetchContent_MakeAvailable(json)

    target_link_libraries(ArcscriptTest PRIVATE nlohmann_json::nlohmann_json)
    target_link_libraries(ArcscriptTest PRIVATE ArcscriptTranspiler)

    file(GLOB TEST_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/demo/tests/*.json")

    if (NOT EXISTS "$<TARGET_FILE_DIR:ArcscriptTest>/tests")
        add_custom_command(TARGET ArcscriptTest POST_BUILD
                COMMAND ${CMAKE_COMMAND}
                -E make_directory "$<TARGET_FILE_DIR:ArcscriptTest>/tests")
    endif()

    add_custom_command(TARGET ArcscriptTest POST_BUILD
            COMMAND ${CMAKE_COMMAND}
            -E copy ${TEST_SOURCES} "$<TARGET_FILE_DIR:ArcscriptTest>/tests"
            WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})
endif (WITH_DEMO)