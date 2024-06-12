import * as Handlebars from "handlebars";
import * as Prettier from "prettier";
import * as changeCase from "change-case";
import * as fs from "fs";
import * as path from "path";
import IConnectionOptions from "./IConnectionOptions";
import IGenerationOptions from "./IGenerationOptions";
import { Entity } from "./models/Entity";
import { Relation } from "./models/Relation";
import pluralize = require("pluralize");
import { FileProcessor } from "../test/utils/FileProcessor";

export default function GenerationPhase(
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions,
    databaseModel: Entity[]
): void {
    createHandlebarsHelpers(generationOptions);

    const schemaPath = generationOptions.schemasPath;
    const modelPath = generationOptions.modelsPath;
    if (!fs.existsSync(modelPath)) {
        console.error(`ModelPath '${modelPath}' does not exist`);
    }
    if (!fs.existsSync(schemaPath)) {
        fs.mkdirSync(schemaPath);
    }
    let entitySchemasPath = schemaPath;
    if (!generationOptions.noConfigs) {
        const tsconfigPath = path.resolve(schemaPath, "tsconfig.json");
        const typeormConfigPath = path.resolve(schemaPath, "ormconfig.json");

        createTsConfigFile(tsconfigPath);
        createTypeOrmConfig(typeormConfigPath, connectionOptions);
        entitySchemasPath = path.resolve(schemaPath, "./entities");
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

    generateFile(
        databaseModel,
        generationOptions,
        entitySchemasPath,
        "entity-schema.mst",
        "schema"
    );
    generateFile(databaseModel, generationOptions, modelsPath, "model.mst");
}

function generateFile(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    modelsPath: string,
    templateName: string,
    fileNameEndsWith?: string
) {
    const templatePath = path.resolve(__dirname, "templates", templateName);
    const template = fs.readFileSync(templatePath, "utf-8");
    const compiledTemplate = Handlebars.compile(template, {
        noEscape: true,
    });

    databaseModel.forEach((element) => {
        const fileName = fileNameEndsWith
            ? `${element.fileName}-${fileNameEndsWith}`
            : element.fileName;
        const casedFileName = setFileNameWithCase(generationOptions, fileName);
        const resultFilePath = path.resolve(modelsPath, `${casedFileName}.ts`);

        if (
            generationOptions.generateMissingTables &&
            fileAlreadyCreated(resultFilePath)
        ) {
            return;
        }

        const renderedText = compiledTemplate(element);

        const finalFileText = new FileProcessor(renderedText, generationOptions)
            .removeUnusedImports()
            .convertEOL()
            .prettierFormat()
            .getRenderedFile();

        fs.writeFileSync(resultFilePath, finalFileText, {
            encoding: "utf-8",
            flag: "w",
        });
    });
}

function setFileNameWithCase(
    generationOptions: IGenerationOptions,
    fileName: string
): string {
    let casedFileName = "";
    switch (generationOptions.convertCaseFile) {
        case "camel":
            casedFileName = changeCase.camelCase(fileName);
            break;
        case "param":
            casedFileName = changeCase.paramCase(fileName);
            break;
        case "pascal":
            casedFileName = changeCase.pascalCase(fileName);
            break;
        case "none":
            casedFileName = fileName;
            break;
        default:
            throw new Error("Unknown case style");
    }
    return casedFileName;
}

function fileAlreadyCreated(filePath: string) {
    return fs.existsSync(filePath);
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
    const formatted = new FileProcessor(rendered, generationOptions)
        .prettierFormat()
        .getRenderedFile();
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
