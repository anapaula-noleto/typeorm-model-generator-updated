import * as Handlebars from "handlebars";
import * as Prettier from "prettier";
import * as changeCase from "change-case";
import * as fs from "fs";
import * as path from "path";
import { EOL } from "os";
import IConnectionOptions from "./IConnectionOptions";
import IGenerationOptions, { eolConverter } from "./IGenerationOptions";
import { Entity } from "./models/Entity";
import { Relation } from "./models/Relation";
import pluralize = require("pluralize");
import { string } from "yargs";

const prettierOptions: Prettier.Options = {
    parser: "typescript",
    endOfLine: "auto",
};

export default function GenerationPhase(
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions,
    databaseModel: Entity[]
): void {
    createHandlebarsHelpers(generationOptions);

    const resultPath = generationOptions.resultsPath;
    const modelPath = generationOptions.modelsPath;
    if (!fs.existsSync(modelPath)) {
        console.error(`ModelPath '${modelPath}' does not exist`);
    }
    if (!fs.existsSync(resultPath)) {
        fs.mkdirSync(resultPath);
    }
    let entitySchemasPath = resultPath;
    if (!generationOptions.noConfigs) {
        const tsconfigPath = path.resolve(resultPath, "tsconfig.json");
        const typeormConfigPath = path.resolve(resultPath, "ormconfig.json");

        createTsConfigFile(tsconfigPath);
        createTypeOrmConfig(typeormConfigPath, connectionOptions);
        entitySchemasPath = path.resolve(resultPath, "./entities");
        if (!fs.existsSync(entitySchemasPath)) {
            fs.mkdirSync(entitySchemasPath);
        }
    }
    if (generationOptions.indexFile) {
        createIndexFile(databaseModel, generationOptions, entitySchemasPath);
    }

    let modelsPath = path.resolve("./models");
    if (!fs.existsSync(modelsPath)) {
        fs.mkdirSync(modelsPath);
    }

    // console.log(databaseModel[0].relations)
    // console.log(databaseModel[0].fileImports)
    generateSchemas(databaseModel, generationOptions, entitySchemasPath);
    generateModels(databaseModel, generationOptions, modelsPath);
}

function generateSchemas(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    entitiesPath: string
) {
    const entityTemplatePath = path.resolve(
        __dirname,
        "templates",
        "entity-schema.mst"
    );
    const entityTemplate = fs.readFileSync(entityTemplatePath, "utf-8");
    const entityCompiledTemplate = Handlebars.compile(entityTemplate, {
        noEscape: true,
    });
    databaseModel.forEach((element) => {
        let casedFileName = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                casedFileName = changeCase.camelCase(
                    element.fileName + "Schema"
                );
                break;
            case "param":
                casedFileName = changeCase.paramCase(
                    element.fileName + "Schema"
                );
                break;
            case "pascal":
                casedFileName = changeCase.pascalCase(
                    element.fileName + "Schema"
                );
                break;
            case "none":
                casedFileName = element.fileName;
                break;
            default:
                throw new Error("Unknown case style");
        }
        const resultFilePath = path.resolve(
            entitiesPath,
            `${casedFileName}.ts`
        );
        const rendered = entityCompiledTemplate(element);

        const withImportStatements = removeUnusedImports(
            EOL !== eolConverter[generationOptions.convertEol]
                ? rendered.replace(
                      /(\r\n|\n|\r)/gm,
                      eolConverter[generationOptions.convertEol]
                  )
                : rendered
        );
        let formatted = "";
        try {
            formatted = Prettier.format(withImportStatements, prettierOptions);
        } catch (error) {
            console.error(
                "There were some problems with model generation for table: ",
                element.sqlName
            );
            console.error(error);
            formatted = withImportStatements;
        }
        fs.writeFileSync(resultFilePath, formatted, {
            encoding: "utf-8",
            flag: "w",
        });
    });
}

function generateModels(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    modelsPath: string
) {
    const entityTemplatePath = path.resolve(
        __dirname,
        "templates",
        "model.mst"
    );
    const entityTemplate = fs.readFileSync(entityTemplatePath, "utf-8");
    const entityCompiledTemplate = Handlebars.compile(entityTemplate, {
        noEscape: true,
    });
    databaseModel.forEach((element) => {
        let casedFileName = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                casedFileName = changeCase.camelCase(element.fileName);
                break;
            case "param":
                casedFileName = changeCase.paramCase(element.fileName);
                break;
            case "pascal":
                casedFileName = changeCase.pascalCase(element.fileName);
                break;
            case "none":
                casedFileName = element.fileName;
                break;
            default:
                throw new Error("Unknown case style");
        }
        const resultFilePath = path.resolve(modelsPath, `${casedFileName}.ts`);
        const rendered = entityCompiledTemplate(element);
        const withImportStatements = removeUnusedImports(
            EOL !== eolConverter[generationOptions.convertEol]
                ? rendered.replace(
                      /(\r\n|\n|\r)/gm,
                      eolConverter[generationOptions.convertEol]
                  )
                : rendered
        );
        let formatted = "";
        try {
            formatted = Prettier.format(withImportStatements, prettierOptions);
        } catch (error) {
            console.error(
                "There were some problems with model generation for table: ",
                element.sqlName
            );
            console.error(error);
            formatted = withImportStatements;
        }
        fs.writeFileSync(resultFilePath, formatted, {
            encoding: "utf-8",
            flag: "w",
        });
    });
}

function createIndexFile(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    entitiesPath: string
) {
    const templatePath = path.resolve(__dirname, "templates", "index.mst");
    const template = fs.readFileSync(templatePath, "utf-8");
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true,
    });
    const rendered = compliedTemplate({ entities: databaseModel });
    const formatted = Prettier.format(rendered, prettierOptions);
    let fileName = "index";
    switch (generationOptions.convertCaseFile) {
        case "camel":
            fileName = changeCase.camelCase(fileName);
            break;
        case "param":
            fileName = changeCase.paramCase(fileName);
            break;
        case "pascal":
            fileName = changeCase.pascalCase(fileName);
            break;
        default:
    }
    const resultFilePath = path.resolve(entitiesPath, `${fileName}.ts`);
    fs.writeFileSync(resultFilePath, formatted, {
        encoding: "utf-8",
        flag: "w",
    });
}

function removeUnusedImports(rendered: string) {
    const importStartIndex = rendered.indexOf("import");
    const openBracketIndex = rendered.indexOf("{", importStartIndex) + 1;
    const closeBracketIndex = rendered.indexOf("}", openBracketIndex);

    if (openBracketIndex === 0 || closeBracketIndex === -1) {
        return rendered;
    }

    const imports = rendered
        .substring(openBracketIndex, closeBracketIndex)
        .split(",")
        .map((v) => v.trim()) // Trim any whitespace around imports
        .filter((v) => v); // Remove any empty strings

    const restOfEntityDefinition = rendered.substring(closeBracketIndex);
    let distinctImports = imports.filter(
        (v) =>
            restOfEntityDefinition.indexOf(`@${v}(`) !== -1 ||
            (v === "BaseEntity" && restOfEntityDefinition.indexOf(v) !== -1)
    );

    // If no distinct imports remain, remove the entire import line
    if (distinctImports.length === 0) {
        const importEndIndex = rendered.indexOf(";", closeBracketIndex) + 1;
        return `${rendered.substring(0, importStartIndex)}${rendered
            .substring(importEndIndex)
            .trim()}`;
    }

    return `${rendered.substring(0, openBracketIndex)}${distinctImports.join(
        ","
    )}${rendered.substring(closeBracketIndex)}`;
}

function createHandlebarsHelpers(generationOptions: IGenerationOptions): void {
    Handlebars.registerHelper("json", (context) => {
        const json = JSON.stringify(context);
        const withoutQuotes = json.replace(/"([^(")"]+)":/g, "$1:");
        return withoutQuotes.slice(1, withoutQuotes.length - 1);
    });
    Handlebars.registerHelper("jsonStringify", function (context) {
        return JSON.stringify(context);
    });
    Handlebars.registerHelper("toparamCase", (str) => {
        return changeCase.paramCase(str);
    });
    Handlebars.registerHelper("singularize", (str) => {
        return pluralize.singular(str);
    });
    Handlebars.registerHelper("toLowerCase", (str) => {
        return str.toLowerCase();
    });
    Handlebars.registerHelper("getModelPath", () => {
        return generationOptions.modelsPath;
    });
    Handlebars.registerHelper("toEntityName", (str) => {
        str = pluralize.singular(str);
        let retStr = "";
        switch (generationOptions.convertCaseEntity) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
            default:
                throw new Error("Unknown case style");
        }
        return retStr;
    });
    Handlebars.registerHelper("toFileName", (str) => {
        return pluralize.singular(changeCase.camelCase(str));
    });
    Handlebars.registerHelper("printPropertyVisibility", () =>
        generationOptions.propertyVisibility !== "none"
            ? `${generationOptions.propertyVisibility} `
            : ""
    );

    Handlebars.registerHelper(
        "firstLetterToUppercase",
        (str) => str.charAt(0).toUpperCase() + str.slice(1)
    );

    Handlebars.registerHelper("toPropertyName", (str) => {
        let retStr = "";
        switch (generationOptions.convertCaseProperty) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
            case "snake":
                retStr = changeCase.snakeCase(str);
                break;
            default:
                throw new Error("Unknown case style");
        }
        return retStr;
    });
    Handlebars.registerHelper(
        "toRelation",
        (entityType: string, relationType: Relation["relationType"]) => {
            let retVal = entityType;
            if (relationType === "ManyToMany" || relationType === "OneToMany") {
                retVal = `${retVal}[]`;
            }
            if (generationOptions.lazy) {
                retVal = `Promise<${retVal}>`;
            }
            return retVal;
        }
    );
    Handlebars.registerHelper("defaultExport", () =>
        generationOptions.exportType === "default" ? "default" : ""
    );
    Handlebars.registerHelper(
        "localImport",
        (entityName: string) => `{${entityName}}`
    );
    Handlebars.registerHelper("strictMode", () =>
        generationOptions.strictMode !== "none"
            ? generationOptions.strictMode
            : ""
    );
    Handlebars.registerHelper({
        and: (v1, v2) => v1 && v2,
        eq: (v1, v2) => v1 === v2,
        gt: (v1, v2) => v1 > v2,
        gte: (v1, v2) => v1 >= v2,
        lt: (v1, v2) => v1 < v2,
        lte: (v1, v2) => v1 <= v2,
        ne: (v1, v2) => v1 !== v2,
        or: (v1, v2) => v1 || v2,
    });
    Handlebars.registerHelper("isRelationArray", (relationType) => {
        return relationType === "ManyToMany" || relationType === "OneToMany";
    });
}

function createTsConfigFile(tsconfigPath: string): void {
    if (fs.existsSync(tsconfigPath)) {
        console.warn(
            `\x1b[33m[${new Date().toLocaleTimeString()}] WARNING: Skipping generation of tsconfig.json file. File already exists. \x1b[0m`
        );
        return;
    }
    const templatePath = path.resolve(__dirname, "templates", "tsconfig.mst");
    const template = fs.readFileSync(templatePath, "utf-8");
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true,
    });
    const rendered = compliedTemplate({});
    const formatted = Prettier.format(rendered, { parser: "json" });
    fs.writeFileSync(tsconfigPath, formatted, {
        encoding: "utf-8",
        flag: "w",
    });
}
function createTypeOrmConfig(
    typeormConfigPath: string,
    connectionOptions: IConnectionOptions
): void {
    if (fs.existsSync(typeormConfigPath)) {
        console.warn(
            `\x1b[33m[${new Date().toLocaleTimeString()}] WARNING: Skipping generation of ormconfig.json file. File already exists. \x1b[0m`
        );
        return;
    }
    const templatePath = path.resolve(__dirname, "templates", "ormconfig.mst");
    const template = fs.readFileSync(templatePath, "utf-8");
    const compiledTemplate = Handlebars.compile(template, {
        noEscape: true,
    });
    const rendered = compiledTemplate(connectionOptions);
    const formatted = Prettier.format(rendered, { parser: "json" });
    fs.writeFileSync(typeormConfigPath, formatted, {
        encoding: "utf-8",
        flag: "w",
    });
}
