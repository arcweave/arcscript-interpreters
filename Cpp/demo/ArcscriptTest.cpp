// ArcscriptTranspilerTest.cpp: This file contains the 'main' function. Program execution begins and ends there.
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
        std::string id = it.value()["id"].get<std::string>();
        std::string name = it.value()["name"].get<std::string>();
        std::string type = it.value()["type"].get<std::string>();

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
            initVars[i].string_val = strdup(it.value()["value"].get<std::string>().c_str());
        }
        else if (initVars[i].type == VariableType::AW_INTEGER) {
            initVars[i].int_val = it.value()["value"].get<int>();
        }
        else if (initVars[i].type == VariableType::AW_DOUBLE) {
            initVars[i].double_val= it.value()["value"].get<double>();
        }
        else if (initVars[i].type == VariableType::AW_BOOLEAN) {
            initVars[i].bool_val = it.value()["value"].get<bool>();
        }
        i += 1;
    }

    return initVars;
}

std::map<std::string, std::any> getExpectedChanges(json changes) {
    std::map<std::string, std::any> expectedChanges;

    for (json::iterator it = changes.begin(); it != changes.end(); ++it) {
        const std::string& varId = it.key();
        const json& value = it.value();

        if (value.type() == json::value_t::string) {
            expectedChanges[varId] = value.get<std::string>();
        }
        else if (value.type() == json::value_t::number_float || value.type() == json::value_t::number_integer) {
            expectedChanges[varId] = value.get<float>();
        }
        else if (value.type() == json::value_t::boolean) {
            expectedChanges[varId] = value.get<bool>();
        }
    }
    return expectedChanges;
}

UVisit* getVisits(json initVisits) {
    if (initVisits.empty()) return nullptr;
    auto visits = new UVisit[initVisits.size()];
    int i = 0;
    for (json::iterator it = initVisits.begin(); it != initVisits.end(); ++it) {
        visits[i].elId = strdup(it.key().c_str());
        visits[i].visits = it.value().get<int>();
        i += 1;
    }
    return visits;
}

std::vector<std::string> events;

void onEvent(const char* eventName) {
    events.emplace_back(eventName);
}

void resetEvents() {
    events.clear();
}

std::string test(json testCase, size_t caseIndex, UVariable* initVars, size_t initVarLen) {
    std::stringstream errorOutput;

    const char* code = strdup(testCase["code"].get<std::string>().c_str());
    UVisit* visits = nullptr;
    size_t visitsLen = 0;
    const char* currentElement = nullptr;
    if (testCase.contains("elementId")) {
        currentElement = strdup(testCase["elementId"].get<std::string>().c_str());
    }
    else {
        currentElement = strdup("TestElement");
    }
    if (testCase.contains("visits")) {
        visits = getVisits(testCase["visits"]);
        visitsLen = testCase["visits"].size();
    }

    resetEvents();

    bool hasError = false;
    std::string errorType;
    if (testCase.contains("error")) {
        hasError = true;
        errorType = testCase["error"].get<std::string>();
    }
    UTranspilerOutput* result = nullptr;
    try {
        result = runScriptExport(code, currentElement, initVars, initVarLen, visits, visitsLen, onEvent);
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
        if (!errorOutput.str().empty()) {
            std::stringstream temp;
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
        std::string output = testCase["output"].get<std::string>();
        if (output != result->output)
        {
            errorOutput << "Different Text Output" << std::endl;
            errorOutput << "EXPECTED:\t\"" << output << "\"" << std::endl << "ACTUAL:\t\t\"" << result->output << "\"" << std::endl;
        }
    }

    if (testCase.contains("changes")) {
        json changes = testCase["changes"];

        for (json::iterator it = changes.begin(); it != changes.end(); ++it) {
            const std::string& expectedChangeKey = it.key();
            const json& expectedChangeValue = it.value();
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
                std::string expectedValue = expectedChangeValue.get<std::string>();
                if (expectedValue != change.string_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected \"" << expectedValue << "\", got \"" << change.string_result << "\"" << std::endl;
                }
            } else if (change.type == VariableType::AW_INTEGER) {
                int expectedValue = expectedChangeValue.get<int>();
                if (expectedValue != change.int_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected " << expectedValue << ", got " << change.int_result << std::endl;
                }
            } else if (change.type == VariableType::AW_DOUBLE) {
                double expectedValue = expectedChangeValue.get<double>();
                if (expectedValue != change.double_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected " << expectedValue << ", got " << change.double_result << std::endl;
                }
            } else if (change.type == VariableType::AW_BOOLEAN) {
                bool expectedValue = expectedChangeValue.get<bool>();
                if (expectedValue != change.bool_result) {
                    errorOutput << "Variable change mismatch for " << expectedChangeKey << ": expected " << expectedValue << ", got " << change.bool_result << std::endl;
                }
            }
        }
    }

    if (testCase.contains("events")) {
        std::vector<std::string> expectedEvents;
        for (auto event_json: testCase["events"]) {
            expectedEvents.push_back(event_json["name"].get<std::string>());
        }

        if (expectedEvents.size() != events.size()) {
            errorOutput << "Event count mismatch: expected " << expectedEvents.size() << ", got " << events.size() << std::endl;
        } else {
            for (size_t i = 0; i < expectedEvents.size(); i++) {
                if (expectedEvents[i] != events[i]) {
                    errorOutput << "Event mismatch at index " << i << ": expected \"" << expectedEvents[i] << "\", got \"" << events[i] << "\"" << std::endl;
                }
            }
        }
    }

    if (testCase.contains("result")) {
        bool expectedResult = testCase["result"].get<bool>();
        if (result->conditionResult != expectedResult) {
            errorOutput << "Condition result mismatch: expected " << expectedResult << ", got " << result->conditionResult << std::endl;
        }
    }

    if (visits != nullptr) {
        for (int i = 0; i < visitsLen; i++) {
            free(const_cast<char *>(visits[i].elId));
        }
        delete visits;
    }
    free(const_cast<char *>(currentElement));

    deallocateOutput(result);

    if (!errorOutput.str().empty()) {
        std::stringstream temp;
        temp << "Test case " << caseIndex << " failed: \"" << code << "\"" << std::endl << errorOutput.rdbuf();
        errorOutput.swap(temp);
    }

    free(const_cast<char *>(code));

    return errorOutput.str();
}

int testFile(const std::filesystem::path& path, int testIndex = -1) {
    std::ifstream f(path);
    json data = json::parse(f);

    std::cout << "Testing file: " << path;

    json initVarsJson = data["initialVars"];
    UVariable* initVars = getInitialVars(initVarsJson);
    size_t initVarLen = initVarsJson.size();
    size_t caseIndex = 0;

    if (testIndex >= 0) {
        std::string errorOutput = test(data["cases"][testIndex], testIndex, initVars, initVarLen);

        if (!errorOutput.empty()) {
            std::cout << errorOutput << std::endl;
            return 1;
        }

        return 0;
    }

    bool fileError = false;
    for (const auto& testCase : data["cases"]) {

        std::string errorOutput = test(testCase, caseIndex, initVars, initVarLen);

        if (!errorOutput.empty()) {
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
        free(const_cast<char *>(initVars[j].id));
        free(const_cast<char *>(initVars[j].name));
        if (initVars[j].type == VariableType::AW_STRING) {
            free(const_cast<char *>(initVars[j].string_val));
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
    for (const auto& path : testPaths) {
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
