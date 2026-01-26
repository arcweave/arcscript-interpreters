// ArcscriptTranspilerTest.cpp : This file contains the 'main' function. Program execution begins and ends there.
//

#include <iostream>
#include <filesystem>
#include <fstream>
#include <map>
#include <string>
#include <any>
#include <nlohmann/json.hpp>
#include "ArcscriptTranspiler.h"

#ifdef _WIN64
#define strdup _strdup
#endif

using json = nlohmann::json;

using namespace Arcweave;

UVariable* getInitialVars(json initialVarsJson) {
    auto initVars = new UVariable[initialVarsJson.size()];
    int i = 0;
    for (json::iterator it = initialVarsJson.begin(); it != initialVarsJson.end(); ++it) {
        std::string id = it.value()["id"].template get<std::string>();
        std::string name = it.value()["name"].template get<std::string>();
        std::string type = it.value()["type"].template get<std::string>();

        initVars[i].id = strdup(id.c_str());
        initVars[i].name = strdup(name.c_str());
        initVars[i].type = VariableType::AW_ANY;
        if (type == "string") {
            initVars[i].type = VariableType::AW_STRING;
        }
        else if (type == "integer") {
            initVars[i].type = VariableType::AW_INTEGER;
        }
        else if (type == "double") {
            initVars[i].type = VariableType::AW_DOUBLE;
        }
        else if (type == "boolean") {
            initVars[i].type = VariableType::AW_BOOLEAN;
        }

        if (initVars[i].type == VariableType::AW_STRING) {
            initVars[i].string_val = strdup(it.value()["value"].template get<std::string>().c_str());
        }
        else if (initVars[i].type == VariableType::AW_INTEGER) {
            initVars[i].int_val = it.value()["value"].template get<int>();
        }
        else if (initVars[i].type == VariableType::AW_DOUBLE) {
            initVars[i].double_val= it.value()["value"].template get<double>();
        }
        else if (initVars[i].type == VariableType::AW_BOOLEAN) {
            initVars[i].bool_val = it.value()["value"].template get<bool>();
        }
        i += 1;
    }

    return initVars;
}

std::map<std::string, std::any> getExpectedChanges(json changes) {
    std::map<std::string, std::any> expectedChanges;

    for (json::iterator it = changes.begin(); it != changes.end(); ++it) {
        std::string varId = it.key();
        json value = it.value();

        if (value.type() == json::value_t::string) {
            expectedChanges[varId] = value.template get<std::string>();
        }
        else if (value.type() == json::value_t::number_float || value.type() == json::value_t::number_integer) {
            expectedChanges[varId] = value.template get<float>();
        }
        else if (value.type() == json::value_t::boolean) {
            expectedChanges[varId] = value.template get<bool>();
        }
    }
    return expectedChanges;
}

UVisit* getVisits(json initVisits) {
    if (initVisits.size() == 0) return nullptr;
    auto visits = new UVisit[initVisits.size()];
    int i = 0;
    for (json::iterator it = initVisits.begin(); it != initVisits.end(); ++it) {
        visits[i].elId = strdup(it.key().c_str());
        visits[i].visits = it.value().template get<int>();
        i += 1;
    }
    return visits;
}

std::string test(json testCase, size_t caseIndex, UVariable* initVars, size_t initVarLen) {
    std::stringstream errorOutput;

    const char* code = strdup(testCase["code"].template get<std::string>().c_str());
    UVisit* visits = nullptr;
    size_t visitsLen = 0;
    const char* currentElement = nullptr;
    if (testCase.contains("elementId")) {
        currentElement = strdup(testCase["elementId"].template get<std::string>().c_str());
    }
    else {
        currentElement = strdup("TestElement");
    }
    if (testCase.contains("visits")) {
        visits = getVisits(testCase["visits"]);
        visitsLen = testCase["visits"].size();
    }

    bool hasError = false;
    std::string errorType = "";
    if (testCase.contains("error")) {
        hasError = true;
        errorType = testCase["error"].template get<std::string>();
    }
    UTranspilerOutput* result = nullptr;
    try {
        result = runScriptExport(code, currentElement, initVars, initVarLen, visits, visitsLen);
    } catch (RuntimeErrorException &e) {
        if (!hasError) {
            errorOutput << "Unexpected Runtime Error: " << e.what() << std::endl;
        } else {
            if (errorType != "runtime") {
                errorOutput << "Received Runtime Error: " << e.what() << std::endl;
            }
        }
    } catch (ParseErrorException &e) {
        if (!hasError) {
            errorOutput << "Unexpected Parse Error: " << e.what() << std::endl;
        } else {
            if (errorType != "parse") {
                errorOutput << "Received Parse Error: " << e.what() << std::endl;
            }
        }
    } catch (std::exception &e) {
        if (!hasError) {
            errorOutput << "Unexpected Exception: " << e.what() << std::endl;
        } else {
            if (errorType != "exception") {
                errorOutput << "Received Exception: " << e.what() << std::endl;
            }
        }
    }

    if (result == nullptr) {
        std::stringstream temp;

        if (errorOutput.str().length() > 0) {
            temp << "Test case " << caseIndex << " failed: \"" << code << "\"" << std::endl << errorOutput.rdbuf();
            errorOutput.swap(temp);
        }
        return errorOutput.str();
    }

    if (hasError) {
        errorOutput << "Test case " << caseIndex << " failed: \"" << code << "\"" << std::endl;
        errorOutput << "Expected error of type: " << errorType << " but no error thrown." << std::endl;

        return errorOutput.str();
    }

    if (testCase.contains("output"))
    {
        std::string output = testCase["output"].template get<std::string>();
        if (output.compare(result->output) != 0)
        {
            errorOutput << "Different Text Output" << std::endl;
            errorOutput << "EXPECTED:\t\"" << output << "\"" << std::endl << "ACTUAL:\t\t\"" << result->output << "\"" << std::endl;
        }
    }

    if (testCase.contains("changes")) {
        json changes = testCase["changes"];

        for (json::iterator it = changes.begin(); it != changes.end(); ++it) {
            std::string expectedChangeKey = it.key();
            json expectedChangeValue = it.value();
            UVariableChange change;
            bool found = false;
            for (int i = 0; i < result->changesLen; i++) {
                if (result->changes[i].varId == expectedChangeKey) {
                    change = result->changes[i];
                    found = true;
                    break;
                }
            }
            if (!found) {
                errorOutput << "Variable change not found: " << expectedChangeKey << ": " << expectedChangeValue << std::endl;
                continue;
            }

            if (change.type == VariableType::AW_STRING) {
                std::string expectedValue = expectedChangeValue.template get<std::string>();
                if (expectedValue.compare(change.string_result) != 0) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected \"" << expectedValue << "\", got \"" << change.string_result << "\"" << std::endl;
                }
            } else if (change.type == VariableType::AW_INTEGER) {
                int expectedValue = expectedChangeValue.template get<int>();
                if (expectedValue != change.int_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected " << expectedValue << ", got " << change.int_result << std::endl;
                }
            } else if (change.type == VariableType::AW_DOUBLE) {
                double expectedValue = expectedChangeValue.template get<double>();
                if (expectedValue != change.double_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected " << expectedValue << ", got " << change.double_result << std::endl;
                }
            } else if (change.type == VariableType::AW_BOOLEAN) {
                bool expectedValue = expectedChangeValue.template get<bool>();
                if (expectedValue != change.bool_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected " << expectedValue << ", got " << change.bool_result << std::endl;
                }
            }
        }
    }

    if (testCase.contains("result")) {
        bool expectedResult = testCase["result"].template get<bool>();
        if (result->conditionResult != expectedResult) {
            errorOutput << "Condition result mismatch: expected " << expectedResult << ", got " << result->conditionResult << std::endl;
        }
    }

    if (visits != nullptr) {
        for (int i = 0; i < visitsLen; i++) {
            free((char*)visits[i].elId);
        }
        delete visits;
    }
    free(const_cast<char *>(currentElement));

    deallocateOutput(result);

    std::stringstream temp;

    if (errorOutput.str().length() > 0) {
        temp << "Test case " << caseIndex << " failed: \"" << code << "\"" << std::endl << errorOutput.rdbuf();
        errorOutput.swap(temp);
    }

    free(const_cast<char *>(code));

    return errorOutput.str();
}

int testFile(std::filesystem::path path, int testIndex = -1) {
    std::ifstream f(path);
    json data = json::parse(f);

    std::cout << "Testing file: " << path;

    json initVarsJson = data["initialVars"];
    UVariable* initVars = getInitialVars(initVarsJson);
    size_t initVarLen = initVarsJson.size();
    size_t casesLen = data["cases"].size();
    size_t caseIndex = 0;

    if (testIndex >= 0) {
        std::string errorOutput = test(data["cases"][testIndex], testIndex, initVars, initVarLen);

        if (errorOutput.length() > 0) {
            std::cout << errorOutput << std::endl;
        }

        return 0;
    }

    bool fileError = false;
    for (json::iterator it = data["cases"].begin(); it != data["cases"].end(); ++it) {

        json testCase = *it;

        std::string errorOutput = test(testCase, caseIndex, initVars, initVarLen);

        if (errorOutput.length() > 0) {
            fileError = true;
            std::cout << std::endl << errorOutput;
        }
        caseIndex += 1;
    }

    if (!fileError) {
        std::cout << "\t\t\tSuccess" << std::endl;
    } else {
        std::cout << std::endl;
    }



    for (int j = 0; j < initVarLen; j++) {
        free((char*)initVars[j].id);
        free((char*)initVars[j].name);
        if (initVars[j].type == VariableType::AW_STRING) {
            free((char*)initVars[j].string_val);
        }
    }
    delete initVars;

    if (fileError) {
        return 1;
    }

    return 0;
}



int main(int argc, char* argv[])
{
    // Create an array of the test path files
    std::vector<std::filesystem::path> testPaths = {
        "./tests/valid.json",
        "./tests/conditions.json",
        "./tests/stringConcat.json",
        "./tests/runtimeErrors.json",
        "./tests/parseErrors.json",
    };
    bool hasErrors = false;
    for (auto path : testPaths) {
        if (!std::filesystem::exists(path)) {
            std::cout << "File not found: " << path << std::endl;
            continue;
        }
        auto result = testFile(path);
        if (result != 0) {
            hasErrors = true;
        }
    }
    if (hasErrors) {
        return 1;
    }
}
