# minimum required CMAKE version
CMAKE_MINIMUM_REQUIRED(VERSION 3.10 FATAL_ERROR)

message(STATUS "CMAKE_CXX_COMPILER_ID=${CMAKE_CXX_COMPILER_ID}")
message(STATUS "CMake version: ${CMAKE_VERSION}")

set(PROJECT_VERSION "0.1.0")
project(ArcscriptTranspiler VERSION ${PROJECT_VERSION})

list(APPEND CMAKE_MODULE_PATH ${CMAKE_CURRENT_SOURCE_DIR}/cmake)

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
 set(ANTLR4_TAG 8e6fd91)
# set(ANTLR4_ZIP_REPOSITORY https://github.com/antlr/antlr4/archive/refs/tags/4.13.2.zip)

# add external build for antlrcpp
include(ExternalAntlr4Cpp)
# add antlr4cpp artifacts to project environment
include_directories(${ANTLR4_INCLUDE_DIRS})

include_directories(src/Generated/ArcscriptLexer)
include_directories(src/Generated/ArcscriptParser)
include_directories(src)

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

if (WIN32 OR WIN64)
    set(LIBRARY_NAME "${PROJECT_NAME}.lib")
    set(DLL_NAME "${PROJECT_NAME}.dll")
    if (WIN64)
        set(PLATFORM "Win64")
    else()
        set(PLATFORM "Win32")
    endif()
elseif (APPLE)
    set(DLL_NAME "lib${PROJECT_NAME}.dylib")
    set(PLATFORM "Mac")
elseif (UNIX)
    set(DLL_NAME "lib${PROJECT_NAME}.so")
    set(PLATFORM "Linux")
endif()

set_target_properties(ArcscriptTranspiler PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/lib/${PLATFORM}"
    ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/lib/${PLATFORM}"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/lib/${PLATFORM}"
    OUTPUT_NAME ${PROJECT_NAME}
)

if (APPLE)
    add_custom_command(TARGET ArcscriptTranspiler PRE_BUILD
            COMMAND install_name_tool -id @rpath/libantlr4-runtime.dylib ${ANTLR4_RUNTIME_LIBRARIES})
endif ()

# Copy the antlr4 runtime library to the output directory
add_custom_command(TARGET ArcscriptTranspiler PRE_BUILD
        COMMAND ${CMAKE_COMMAND}
        -E copy ${ANTLR4_RUNTIME_LIBRARIES} "$<TARGET_FILE_DIR:ArcscriptTranspiler>"
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})

# Copy the generated headers to the output directory
if (NOT EXISTS "${CMAKE_CURRENT_BINARY_DIR}/lib/include")
    add_custom_command(TARGET ArcscriptTranspiler POST_BUILD
            COMMAND ${CMAKE_COMMAND}
            -E make_directory "${CMAKE_CURRENT_BINARY_DIR}/lib/include")
endif()

add_custom_command(TARGET ArcscriptTranspiler POST_BUILD
        COMMAND ${CMAKE_COMMAND}
        -E copy ${ARCSCRIPT_INCLUDE_HEADERS} "${CMAKE_CURRENT_BINARY_DIR}/lib/include"
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})

if (WITH_TEST)
    add_executable(ArcscriptTest ${CMAKE_CURRENT_SOURCE_DIR}/demo/ArcscriptTest.cpp)

    include(FetchContent)
    FetchContent_Declare(json URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz)
    FetchContent_MakeAvailable(json)

    target_link_libraries(ArcscriptTest PRIVATE nlohmann_json::nlohmann_json)
    target_link_libraries(ArcscriptTest PRIVATE ArcscriptTranspiler)

    set_target_properties(ArcscriptTest PROPERTIES
            LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/demo/${PLATFORM}"
            ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/demo/${PLATFORM}"
            RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/demo/${PLATFORM}"
            OUTPUT_NAME ArcscriptTest
    )

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

    if (WIN32 OR WIN64)
        set(ARCSCRIPT_TRANSPILER_LIB_FILES
                "$<TARGET_FILE_DIR:ArcscriptTranspiler>/${DLL_NAME}"
                "$<TARGET_FILE_DIR:ArcscriptTranspiler>/${LIBRARY_NAME}"
                "$<TARGET_FILE_DIR:ArcscriptTranspiler>/${PROJECT_NAME}.exp"
                "$<TARGET_FILE_DIR:ArcscriptTranspiler>/${PROJECT_NAME}.pdb"
        )
    elseif (APPLE)
        set(ARCSCRIPT_TRANSPILER_LIB_FILES
                "$<TARGET_FILE_DIR:ArcscriptTranspiler>/${DLL_NAME}"
                "$<TARGET_FILE_DIR:ArcscriptTranspiler>/${LIBRARY_NAME}"
        )
    endif()

    add_custom_command(TARGET ArcscriptTest POST_BUILD
            COMMAND ${CMAKE_COMMAND}
            -E copy ${ANTLR4_RUNTIME_LIBRARIES} "$<TARGET_FILE_DIR:ArcscriptTest>"
            WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})

    add_custom_command(TARGET ArcscriptTest POST_BUILD
            COMMAND ${CMAKE_COMMAND}
            -E copy ${ARCSCRIPT_TRANSPILER_LIB_FILES} "$<TARGET_FILE_DIR:ArcscriptTest>"
            WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})
endif (WITH_TEST)